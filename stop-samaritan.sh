#!/usr/bin/env bash
#
# Stops the services started by start-samaritan.sh.
#
#   ./stop-samaritan.sh        Stop the tracker, dashboard and API
#   ./stop-samaritan.sh --db   Also stop the PostgreSQL container

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
RUNTIME_DIR="$REPO_ROOT/.runtime"
PID_FILE="$RUNTIME_DIR/services.pid"
ELECTRON_BIN="$REPO_ROOT/desktop/node_modules/electron/dist/electron"

STOP_DB=false

for arg in "$@"; do
    case $arg in
        --db|--all) STOP_DB=true ;;
        -h|--help) sed -n '3,6p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) echo "Unknown option: $arg" >&2; exit 1 ;;
    esac
done

log_info() {
    echo -e "\033[1;35m[Samaritan Linux Stopper]\033[0m $1"
}

group_alive() {
    kill -0 -- "-$1" 2>/dev/null
}

# Stops a service's process group, force-killing whatever survives 15s.
stop_group() {
    local name=$1 pid=$2
    log_info "Stopping $name (process group $pid)"
    # Signal the session leader alone first. Electron quits gracefully (and
    # flushes the open session) on one SIGTERM but dies on a second, which is
    # what a group-wide signal plus a wrapper forwarding it would deliver.
    kill -TERM "$pid" 2>/dev/null || true
    for _ in $(seq 1 20); do
        kill -0 "$pid" 2>/dev/null || break
        sleep 0.5
    done
    kill -TERM -- "-$pid" 2>/dev/null || true
    for _ in $(seq 1 10); do
        group_alive "$pid" || return 0
        sleep 0.5
    done
    log_info "$name did not exit in time; forcing"
    kill -KILL -- "-$pid" 2>/dev/null || true
}

if [ -f "$PID_FILE" ]; then
    log_info "Stopping background services..."
    entries=()
    while read -r name pid; do
        # Older launchers wrote bare PIDs, one per line.
        if [ -z "${pid:-}" ]; then pid=$name; name=service; fi
        [[ "$pid" =~ ^[0-9]+$ ]] && entries+=("$name $pid")
    done <"$PID_FILE"

    # Reverse start order: the tracker flushes its open session to the API
    # on shutdown, so the API must outlive it.
    for ((i = ${#entries[@]} - 1; i >= 0; i--)); do
        read -r name pid <<<"${entries[i]}"
        if group_alive "$pid"; then
            stop_group "$name" "$pid"
        elif kill -0 "$pid" 2>/dev/null; then
            kill -TERM "$pid" 2>/dev/null || true
        fi
    done
    rm -f "$PID_FILE"
fi

# Electron instances of this checkout that were started outside the launcher.
pkill -TERM -f -- "^$ELECTRON_BIN" >/dev/null 2>&1 || true

if [ "$STOP_DB" = true ]; then
    log_info "Stopping PostgreSQL container..."
    docker compose -f "$REPO_ROOT/docker-compose.yml" stop postgres
fi

log_info "Samaritan services stopped."
