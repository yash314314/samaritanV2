#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$REPO_ROOT/api"
DASHBOARD_DIR="$REPO_ROOT/dashboard"
DESKTOP_DIR="$REPO_ROOT/desktop"
RUNTIME_DIR="$REPO_ROOT/.runtime"
LOG_DIR="$RUNTIME_DIR/logs"
PID_FILE="$RUNTIME_DIR/services.pid"

RUN_SEED=false

# Parse command line flags
for arg in "$@"; do
    case $arg in
        --seed|-s|--demo)
            RUN_SEED=true
            shift
            ;;
    esac
done

mkdir -p "$LOG_DIR"

log_info() {
    echo -e "\033[1;35m[Samaritan Linux Launcher]\033[0m $1"
}

log_success() {
    echo -e "\033[1;32m[Samaritan]\033[0m $1"
}

log_error() {
    echo -e "\033[1;31m[Samaritan Error]\033[0m $1"
}

check_port() {
    local port=$1
    nc -z localhost "$port" >/dev/null 2>&1 || (exec 3<>/dev/tcp/127.0.0.1/"$port") >/dev/null 2>&1
}

wait_for_port() {
    local port=$1
    local name=$2
    local retries=30
    while [ $retries -gt 0 ]; do
        if check_port "$port"; then
            return 0
        fi
        sleep 1
        retries=$((retries - 1))
    done
    log_error "Timeout waiting for $name on port $port"
    return 1
}

log_info "Checking Linux prerequisites..."

command -v node >/dev/null 2>&1 || { log_error "Node.js is not installed"; exit 1; }
command -v npm >/dev/null 2>&1 || { log_error "npm is not installed"; exit 1; }

# 1. Start PostgreSQL Container
if check_port 5432; then
    log_info "PostgreSQL is already running on port 5432"
else
    if command -v docker >/dev/null 2>&1; then
        log_info "Starting PostgreSQL via Docker Compose..."
        docker compose -f "$REPO_ROOT/docker-compose.yml" up -d postgres
        wait_for_port 5432 "PostgreSQL"
    else
        log_error "PostgreSQL is not running on port 5432 and Docker was not found."
        exit 1
    fi
fi

# 2. Database Migrations & User Bootstrap
log_info "Deploying database migrations & bootstrapping local user..."
(
    cd "$API_DIR"
    npx prisma migrate deploy >/dev/null 2>&1 || true
    npx prisma generate >/dev/null 2>&1 || true
    npm run bootstrap:user >/dev/null 2>&1 || true
    
    if [ "$RUN_SEED" = true ]; then
        log_info "Seeding default categorization patterns & demo dataset..."
        npm run seed:patterns >/dev/null 2>&1 || true
        npm run seed:demo >/dev/null 2>&1 || true
        log_success "Database seeded successfully!"
    fi
)

TIMESTAMP=$(date +"%Y%m%d-%H%M%S")

# 3. Start API Service (Port 4000)
if check_port 4000; then
    log_info "API Service is already running on port 4000"
else
    log_info "Starting Express API Service on port 4000..."
    (
        cd "$API_DIR"
        npm run dev >"$LOG_DIR/api-$TIMESTAMP.out.log" 2>"$LOG_DIR/api-$TIMESTAMP.err.log" &
        echo $! >> "$PID_FILE"
    )
    wait_for_port 4000 "API Service"
fi

# 4. Start Next.js Dashboard (Port 3000)
if check_port 3000; then
    log_info "Next.js Dashboard is already running on port 3000"
else
    log_info "Starting Next.js Dashboard on port 3000..."
    (
        cd "$DASHBOARD_DIR"
        npm run dev >"$LOG_DIR/dashboard-$TIMESTAMP.out.log" 2>"$LOG_DIR/dashboard-$TIMESTAMP.err.log" &
        echo $! >> "$PID_FILE"
    )
    wait_for_port 3000 "Next.js Dashboard"
fi

# 5. Start Electron Desktop Tracker
log_info "Starting Electron Desktop Tracker..."
(
    cd "$DESKTOP_DIR"
    npm start >"$LOG_DIR/desktop-$TIMESTAMP.out.log" 2>"$LOG_DIR/desktop-$TIMESTAMP.err.log" &
    echo $! >> "$PID_FILE"
)

log_success "Samaritan is running cleanly on Linux!"
echo ""
echo "  Dashboard : http://localhost:3000"
echo "  API       : http://localhost:4000"
echo "  Logs      : $LOG_DIR"
echo ""
echo "To stop all services, run: ./stop-samaritan.sh"
