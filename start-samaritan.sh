#!/usr/bin/env bash
#
# Samaritan Linux launcher.
#
#   ./start-samaritan.sh               Production mode: compiled API + static dashboard
#   ./start-samaritan.sh --dev         Hot-reload dev servers (ts-node-dev, next dev)
#   ./start-samaritan.sh --seed        Also seed categorization patterns and demo data
#   ./start-samaritan.sh --rebuild     Force a rebuild of the API and dashboard
#   ./start-samaritan.sh --no-desktop  Start the backend and dashboard only
#
# Environment:
#   SAMARITAN_DASHBOARD_PORT  Dashboard port (default 4001)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
API_DIR="$REPO_ROOT/api"
DASHBOARD_DIR="$REPO_ROOT/dashboard"
DESKTOP_DIR="$REPO_ROOT/desktop"
RUNTIME_DIR="$REPO_ROOT/.runtime"
LOG_DIR="$RUNTIME_DIR/logs"
PID_FILE="$RUNTIME_DIR/services.pid"
COMPOSE_FILE="$REPO_ROOT/docker-compose.yml"
ELECTRON_BIN="$DESKTOP_DIR/node_modules/electron/dist/electron"

API_PORT=4000
DB_PORT=5432
DASHBOARD_PORT="${SAMARITAN_DASHBOARD_PORT:-4001}"
DASHBOARD_URL="http://localhost:$DASHBOARD_PORT"

MODE=prod
RUN_SEED=false
FORCE_REBUILD=false
START_DESKTOP=true

usage() {
    sed -n '3,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

for arg in "$@"; do
    case $arg in
        --seed|-s|--demo) RUN_SEED=true ;;
        --dev|-d) MODE=dev ;;
        --rebuild) FORCE_REBUILD=true ;;
        --no-desktop) START_DESKTOP=false ;;
        -h|--help) usage; exit 0 ;;
        *) echo "Unknown option: $arg" >&2; usage >&2; exit 1 ;;
    esac
done

mkdir -p "$LOG_DIR"
find "$LOG_DIR" -name '*.log' -mtime +14 -delete 2>/dev/null || true
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
SETUP_LOG="$LOG_DIR/setup-$TIMESTAMP.log"

log_info() {
    echo -e "\033[1;35m[Samaritan Linux Launcher]\033[0m $1"
}

log_success() {
    echo -e "\033[1;32m[Samaritan]\033[0m $1"
}

log_warn() {
    echo -e "\033[1;33m[Samaritan Warning]\033[0m $1"
}

log_error() {
    echo -e "\033[1;31m[Samaritan Error]\033[0m $1" >&2
}

fail_with_log() {
    local message=$1 logfile=$2
    log_error "$message"
    if [ -f "$logfile" ]; then
        echo "---- last lines of $logfile ----" >&2
        tail -n 25 "$logfile" >&2
        echo "--------------------------------" >&2
    fi
    exit 1
}

# Runs a setup command, logging its output; aborts with the log tail on failure.
run_step() {
    local description=$1
    shift
    echo "### $description: $*" >>"$SETUP_LOG"
    if ! "$@" >>"$SETUP_LOG" 2>&1; then
        fail_with_log "$description failed" "$SETUP_LOG"
    fi
}

check_port() {
    (exec 3<>"/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1 \
        || (exec 3<>"/dev/tcp/::1/$1") >/dev/null 2>&1
}

port_owner_pid() {
    ss -Hltnp "sport = :$1" 2>/dev/null | grep -o 'pid=[0-9]*' | head -n 1 | cut -d= -f2
}

# True when the process listening on the port runs from the given directory,
# i.e. it is this Samaritan checkout and not another app on the same port.
port_owned_by() {
    local pid
    pid=$(port_owner_pid "$1")
    [ -n "$pid" ] && [[ "$(readlink -f "/proc/$pid/cwd" 2>/dev/null)" == "$2"* ]]
}

describe_port_owner() {
    local pid
    pid=$(port_owner_pid "$1")
    if [ -z "$pid" ]; then
        echo "a process owned by another user or a container"
    else
        echo "pid $pid ($(tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null | cut -c1-80)) in $(readlink -f "/proc/$pid/cwd" 2>/dev/null)"
    fi
}

wait_for_http() {
    local url=$1 name=$2 pid=$3 logfile=$4 retries=$5
    while [ "$retries" -gt 0 ]; do
        if curl -fsS -o /dev/null --max-time 2 "$url" 2>/dev/null; then
            return 0
        fi
        if ! kill -0 "$pid" 2>/dev/null; then
            fail_with_log "$name exited during startup" "$logfile"
        fi
        sleep 1
        retries=$((retries - 1))
    done
    fail_with_log "Timeout waiting for $name at $url" "$logfile"
}

# Starts a long-running service in its own session so stop-samaritan.sh can
# terminate its whole process tree, and waits until it answers HTTP.
start_service() {
    local name=$1 dir=$2 port=$3 health_url=$4 timeout=$5
    shift 5

    if check_port "$port"; then
        if port_owned_by "$port" "$dir"; then
            log_info "$name is already running on port $port"
            return 0
        fi
        log_error "Port $port is held by $(describe_port_owner "$port")."
        if [ "$port" = "$DASHBOARD_PORT" ]; then
            log_error "Stop that program or choose another port: SAMARITAN_DASHBOARD_PORT=4002 $0"
        else
            log_error "Stop that program and run the launcher again."
        fi
        exit 1
    fi

    local logfile="$LOG_DIR/$name-$TIMESTAMP.log"
    log_info "Starting $name on port $port..."
    (cd "$dir" && exec setsid "$@" >"$logfile" 2>&1) &
    local pid=$!
    echo "$name $pid" >>"$PID_FILE"
    wait_for_http "$health_url" "$name" "$pid" "$logfile" "$timeout"
}

prune_pid_file() {
    [ -f "$PID_FILE" ] || return 0
    local tmp="$PID_FILE.tmp"
    : >"$tmp"
    while read -r name pid; do
        if [ -n "${pid:-}" ] && kill -0 -- "-$pid" 2>/dev/null; then
            echo "$name $pid" >>"$tmp"
        fi
    done <"$PID_FILE"
    mv "$tmp" "$PID_FILE"
}

# Newer-than check used to skip rebuilds when sources are unchanged.
needs_build() {
    local artifact=$1
    shift
    [ "$FORCE_REBUILD" = true ] && return 0
    [ -f "$artifact" ] || return 0
    [ -n "$(find "$@" -newer "$artifact" -type f -print -quit 2>/dev/null)" ]
}

# ---------------------------------------------------------------------------
# 0. Prerequisites
# ---------------------------------------------------------------------------

log_info "Checking Linux prerequisites..."

for cmd in node npm curl setsid; do
    command -v "$cmd" >/dev/null 2>&1 || { log_error "$cmd is not installed"; exit 1; }
done
command -v ss >/dev/null 2>&1 || log_warn "ss (iproute2) not found; cannot verify which program owns a busy port"

NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if [ "$NODE_MAJOR" -lt 20 ]; then
    log_error "Node.js 20 or newer is required (found $(node -v))"
    exit 1
fi

if [ -n "${HYPRLAND_INSTANCE_SIGNATURE:-}" ] && ! command -v hypridle >/dev/null 2>&1; then
    log_warn "hypridle is not installed; idle time will be recorded as active on Hyprland"
fi

prune_pid_file

# ---------------------------------------------------------------------------
# 1. Dependencies and configuration
# ---------------------------------------------------------------------------

for dir in "$API_DIR" "$DASHBOARD_DIR" "$DESKTOP_DIR"; do
    if [ ! -d "$dir/node_modules" ]; then
        log_info "Installing dependencies in ${dir#"$REPO_ROOT"/}..."
        (cd "$dir" && run_step "npm ci (${dir#"$REPO_ROOT"/})" npm ci --no-audit --no-fund)
    fi
done

if [ "$START_DESKTOP" = true ] && [ ! -x "$ELECTRON_BIN" ]; then
    log_info "Downloading the Electron runtime..."
    (cd "$DESKTOP_DIR" && run_step "Electron binary install" node node_modules/electron/install.js)
fi

if [ ! -f "$API_DIR/.env" ]; then
    cp "$API_DIR/.env.example" "$API_DIR/.env"
    log_info "Created api/.env from api/.env.example"
fi

# ---------------------------------------------------------------------------
# 2. PostgreSQL
# ---------------------------------------------------------------------------

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    log_info "Ensuring PostgreSQL container is up..."
    run_step "Start PostgreSQL" docker compose -f "$COMPOSE_FILE" up -d --wait postgres
elif check_port "$DB_PORT"; then
    log_warn "Docker is unavailable; using the PostgreSQL already listening on port $DB_PORT"
else
    log_error "PostgreSQL is not running on port $DB_PORT and the Docker daemon is not reachable."
    log_error "Start Docker (Docker Desktop or 'systemctl start docker') and try again."
    exit 1
fi

# ---------------------------------------------------------------------------
# 3. Database migrations and local user
# ---------------------------------------------------------------------------

log_info "Deploying database migrations & bootstrapping local user..."
(
    cd "$API_DIR"
    run_step "Prisma migrate deploy" node_modules/.bin/prisma migrate deploy
    run_step "Prisma generate" node_modules/.bin/prisma generate
    run_step "Local user bootstrap" npm run --silent bootstrap:user

    if [ "$RUN_SEED" = true ]; then
        log_info "Seeding default categorization patterns & demo dataset..."
        run_step "Seed patterns" npm run --silent seed:patterns
        run_step "Seed demo data" npm run --silent seed:demo
        log_success "Database seeded successfully!"
    fi
)

# ---------------------------------------------------------------------------
# 4. Builds (production mode)
# ---------------------------------------------------------------------------

if [ "$MODE" = prod ]; then
    if needs_build "$API_DIR/dist/index.js" "$API_DIR/src" "$API_DIR/package.json" "$API_DIR/tsconfig.json"; then
        log_info "Building API..."
        (cd "$API_DIR" && run_step "API build" npm run --silent build)
    fi
    if needs_build "$DASHBOARD_DIR/out/index.html" "$DASHBOARD_DIR/app" "$DASHBOARD_DIR/components" \
        "$DASHBOARD_DIR/context" "$DASHBOARD_DIR/lib" "$DASHBOARD_DIR/public" \
        "$DASHBOARD_DIR/next.config.ts" "$DASHBOARD_DIR/package.json" "$DASHBOARD_DIR/.env.local"; then
        log_info "Building dashboard (this takes a minute)..."
        (cd "$DASHBOARD_DIR" && run_step "Dashboard build" npm run --silent build)
    fi
fi

# ---------------------------------------------------------------------------
# 5. API (port 4000) and dashboard
# ---------------------------------------------------------------------------

if [ "$MODE" = prod ]; then
    start_service api "$API_DIR" "$API_PORT" "http://127.0.0.1:$API_PORT/health" 30 \
        node dist/index.js
    start_service dashboard "$DASHBOARD_DIR" "$DASHBOARD_PORT" "http://127.0.0.1:$DASHBOARD_PORT/" 30 \
        env HOST=127.0.0.1 PORT="$DASHBOARD_PORT" node serve.mjs
else
    start_service api "$API_DIR" "$API_PORT" "http://127.0.0.1:$API_PORT/health" 60 \
        node_modules/.bin/ts-node-dev --respawn --transpile-only src/index.ts
    start_service dashboard "$DASHBOARD_DIR" "$DASHBOARD_PORT" "http://127.0.0.1:$DASHBOARD_PORT/" 120 \
        node_modules/.bin/next dev -H 127.0.0.1 -p "$DASHBOARD_PORT"
fi

# ---------------------------------------------------------------------------
# 6. Electron desktop tracker
# ---------------------------------------------------------------------------

if [ "$START_DESKTOP" = true ]; then
    if pgrep -f -- "^$ELECTRON_BIN" >/dev/null 2>&1; then
        log_info "Electron Desktop Tracker is already running"
    else
        log_info "Starting Electron Desktop Tracker..."
        DESKTOP_LOG="$LOG_DIR/desktop-$TIMESTAMP.log"
        # Run the Electron binary directly: the npm CLI wrapper re-forwards
        # SIGTERM, and a second SIGTERM kills Electron before it flushes.
        (cd "$DESKTOP_DIR" && exec setsid env SAMARITAN_DASHBOARD_URL="$DASHBOARD_URL" \
            "$ELECTRON_BIN" . >"$DESKTOP_LOG" 2>&1) &
        DESKTOP_PID=$!
        echo "desktop $DESKTOP_PID" >>"$PID_FILE"
        sleep 3
        kill -0 "$DESKTOP_PID" 2>/dev/null || fail_with_log "Electron Desktop Tracker exited during startup" "$DESKTOP_LOG"
    fi
fi

log_success "Samaritan is running on Linux ($MODE mode)."
echo ""
echo "  Dashboard : $DASHBOARD_URL"
echo "  API       : http://localhost:$API_PORT"
echo "  Logs      : $LOG_DIR"
echo ""
echo "To stop all services, run: ./stop-samaritan.sh"
