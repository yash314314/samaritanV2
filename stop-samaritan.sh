#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$REPO_ROOT/.runtime"
PID_FILE="$RUNTIME_DIR/services.pid"

log_info() {
    echo -e "\033[1;35m[Samaritan Linux Stopper]\033[0m $1"
}

if [ -f "$PID_FILE" ]; then
    log_info "Stopping background services..."
    while read -r pid; do
        if [ -n "$pid" ] && kill -0 "$pid" >/dev/null 2>&1; then
            kill "$pid" >/dev/null 2>&1 || true
        fi
    done < "$PID_FILE"
    rm -f "$PID_FILE"
fi

# Kill any leftover Samaritan Node / Electron processes
pkill -f "samaritanv2.*electron" >/dev/null 2>&1 || true

log_info "Samaritan services stopped."
