## Stop Samaritan Services
# This PowerShell script stops the API, Dashboard, and Desktop Tracker services that were started by start-samaritan.ps1.
# It reads the state file (.runtime/services.json) to get the process IDs and then terminates them.

[CmdletBinding()]
param()

# Determine repository root (directory containing this script)
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RuntimeDir = Join-Path $RepoRoot ".runtime"
$StateFile = Join-Path $RuntimeDir "services.json"
$DesktopPidFile = Join-Path $RuntimeDir "desktop.pid"

function Write-Step {
  param([string]$Message)
  Write-Host "[Samaritan] $Message" -ForegroundColor Magenta
}

function Stop-ProcessIfRunning {
  param(
    [int]$ProcessId,
    [string]$Name
  )
  if ($ProcessId -and (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)) {
    Write-Step "Stopping $Name (PID $ProcessId)..."
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
  } else {
    Write-Step "No running $Name process found (PID $ProcessId)."
  }
}

# Ensure the state file exists
if (-not (Test-Path $StateFile)) {
  Write-Step "State file not found at $StateFile. Nothing to stop."
  exit 0
}

# Load state JSON
try {
  $state = Get-Content $StateFile -Raw | ConvertFrom-Json
} catch {
  Write-Step "Failed to read state file: $($_.Exception.Message)"
  exit 1
}

# Stop services based on stored PIDs
Stop-ProcessIfRunning $state.api.pid "API"
Stop-ProcessIfRunning $state.dashboard.pid "Dashboard"
Stop-ProcessIfRunning $state.tracker.pid "Desktop Tracker"

# Clean up PID file for desktop tracker if it exists
if (Test-Path $DesktopPidFile) {
  Write-Step "Removing desktop PID file."
  Remove-Item $DesktopPidFile -Force -ErrorAction SilentlyContinue
}

# Remove the state file
if (Test-Path $StateFile) {
  Write-Step "Removing state file."
  Remove-Item $StateFile -Force -ErrorAction SilentlyContinue
}

Write-Step "All Samaritan services have been stopped."
