[CmdletBinding()]
param(
  [switch]$InstallDependencies,
  [switch]$SkipDatabase,
  [switch]$SkipSetup,
  [switch]$SkipTracker,
  [switch]$OpenDashboard,
  [ValidateRange(10, 300)]
  [int]$StartupTimeoutSeconds = 60
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ApiDirectory = Join-Path $RepoRoot "api"
$DashboardDirectory = Join-Path $RepoRoot "dashboard"
$DesktopDirectory = Join-Path $RepoRoot "desktop"
$RuntimeDirectory = Join-Path $RepoRoot ".runtime"
$LogDirectory = Join-Path $RuntimeDirectory "logs"
$DesktopPidFile = Join-Path $RuntimeDirectory "desktop.pid"
$StateFile = Join-Path $RuntimeDirectory "services.json"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

function Write-Step {
  param([string]$Message)
  Write-Host "[Samaritan] $Message" -ForegroundColor Magenta
}

function Assert-Command {
  param([string]$Name, [string]$InstallHint)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found. $InstallHint"
  }
}

function Test-TcpPort {
  param([string]$ComputerName, [int]$Port, [int]$TimeoutMilliseconds = 500)
  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $connection = $client.ConnectAsync($ComputerName, $Port)
    if (-not $connection.Wait($TimeoutMilliseconds)) { return $false }
    return $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Test-HttpEndpoint {
  param([string]$Url)
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 400
  } catch {
    return $false
  }
}

function Wait-HttpEndpoint {
  param([string]$Name, [string]$Url, [int]$TimeoutSeconds)
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-HttpEndpoint -Url $Url) { return $true }
    Start-Sleep -Milliseconds 750
  }
  Write-Warning "$Name did not become ready at $Url within $TimeoutSeconds seconds."
  return $false
}

function Wait-TcpPort {
  param([string]$Name, [int]$Port, [int]$TimeoutSeconds)
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-TcpPort -ComputerName "localhost" -Port $Port) { return $true }
    Start-Sleep -Milliseconds 750
  }
  Write-Warning "$Name did not open localhost:$Port within $TimeoutSeconds seconds."
  return $false
}

function Assert-NodeModules {
  param([string]$Name, [string]$Directory)
  $nodeModules = Join-Path $Directory "node_modules"
  if (Test-Path -LiteralPath $nodeModules) { return }
  if (-not $InstallDependencies) {
    throw "$Name dependencies are missing. Run this script with -InstallDependencies once."
  }
  Write-Step "Installing $Name dependencies"
  & npm.cmd --prefix $Directory install
  if ($LASTEXITCODE -ne 0) { throw "npm install failed for $Name." }
}

function Show-LogTail {
  param([string]$Path)
  if (Test-Path -LiteralPath $Path) {
    Write-Host "--- $Path" -ForegroundColor DarkGray
    Get-Content -LiteralPath $Path -Tail 30
  }
}

function Start-NpmService {
  param(
    [string]$Name,
    [string]$Directory,
    [string[]]$Arguments,
    [int]$Port,
    [string]$HealthUrl
  )

  if (Test-TcpPort -ComputerName "localhost" -Port $Port) {
    if (-not (Test-HttpEndpoint -Url $HealthUrl)) {
      throw "Port $Port is occupied, but it is not responding as the $Name service."
    }
    Write-Step "$Name is already running on port $Port"
    return $null
  }

  $slug = $Name.ToLowerInvariant().Replace(" ", "-")
  $stdout = Join-Path $LogDirectory "$slug-$Timestamp.out.log"
  $stderr = Join-Path $LogDirectory "$slug-$Timestamp.err.log"
  Write-Step "Starting $Name"
  $process = Start-Process `
    -FilePath "npm.cmd" `
    -ArgumentList $Arguments `
    -WorkingDirectory $Directory `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr `
    -PassThru

  if (-not (Wait-HttpEndpoint -Name $Name -Url $HealthUrl -TimeoutSeconds $StartupTimeoutSeconds)) {
    Show-LogTail -Path $stderr
    Show-LogTail -Path $stdout
    throw "$Name failed to start."
  }

  return [pscustomobject]@{
    Name = $Name
    Id = $process.Id
    StandardOutput = $stdout
    StandardError = $stderr
  }
}

function Get-ExistingTrackerProcess {
  if (Test-Path -LiteralPath $DesktopPidFile) {
    $savedPid = 0
    if ([int]::TryParse((Get-Content -LiteralPath $DesktopPidFile -Raw).Trim(), [ref]$savedPid)) {
      $savedProcess = Get-Process -Id $savedPid -ErrorAction SilentlyContinue
      if ($savedProcess -and -not $savedProcess.HasExited) { return $savedProcess }
    }
    Remove-Item -LiteralPath $DesktopPidFile -Force -ErrorAction SilentlyContinue
  }

  try {
    $escapedDirectory = [regex]::Escape($DesktopDirectory)
    $existing = Get-CimInstance Win32_Process -Filter "Name = 'electron.exe'" -ErrorAction Stop |
      Where-Object { $_.CommandLine -match $escapedDirectory } |
      Select-Object -First 1
    if ($existing) { return Get-Process -Id $existing.ProcessId -ErrorAction SilentlyContinue }
  } catch {
    # Process command lines may require elevated WMI permissions. The PID file remains the fallback.
  }

  return $null
}

try {
  Assert-Command -Name "node.exe" -InstallHint "Install Node.js 20 or newer."
  Assert-Command -Name "npm.cmd" -InstallHint "Install npm with Node.js."
  $nodeMajor = [int]((& node.exe --version).TrimStart("v").Split(".")[0])
  if ($nodeMajor -lt 20) { throw "Node.js 20 or newer is required; found Node.js $nodeMajor." }

  New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
  Assert-NodeModules -Name "API" -Directory $ApiDirectory
  Assert-NodeModules -Name "dashboard" -Directory $DashboardDirectory
  Assert-NodeModules -Name "desktop tracker" -Directory $DesktopDirectory

  if (-not $SkipDatabase -and -not (Test-TcpPort -ComputerName "localhost" -Port 5432)) {
    Assert-Command -Name "docker.exe" -InstallHint "Start Docker Desktop or use -SkipDatabase with an external PostgreSQL instance."
    Write-Step "Starting PostgreSQL"
    & docker compose -f (Join-Path $RepoRoot "docker-compose.yml") up -d postgres
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose could not start PostgreSQL." }
    if (-not (Wait-TcpPort -Name "PostgreSQL" -Port 5432 -TimeoutSeconds $StartupTimeoutSeconds)) {
      throw "PostgreSQL failed to start."
    }
  }

  $apiAlreadyRunning = Test-TcpPort -ComputerName "localhost" -Port 4000
  if (-not $SkipSetup -and -not $apiAlreadyRunning) {
    Write-Step "Applying database migrations"
    Push-Location $ApiDirectory
    try {
      & npx.cmd prisma migrate deploy
      if ($LASTEXITCODE -ne 0) { throw "Prisma migrations failed." }
      & npx.cmd prisma generate
      if ($LASTEXITCODE -ne 0) { throw "Prisma client generation failed." }
      & npm.cmd run bootstrap:user
      if ($LASTEXITCODE -ne 0) { throw "Local user bootstrap failed." }
    } finally {
      Pop-Location
    }
  }

  $apiProcess = Start-NpmService `
    -Name "API" `
    -Directory $ApiDirectory `
    -Arguments @("run", "dev") `
    -Port 4000 `
    -HealthUrl "http://localhost:4000/health"

  $dashboardProcess = Start-NpmService `
    -Name "Dashboard" `
    -Directory $DashboardDirectory `
    -Arguments @("run", "dev") `
    -Port 3000 `
    -HealthUrl "http://localhost:3000"

  $trackerProcess = $null
  $trackerLog = $null
  if ($SkipTracker) {
    Write-Step "Skipping desktop tracker"
  } else {
    $trackerProcess = Get-ExistingTrackerProcess
  }
  if ($trackerProcess) {
    Write-Step "Desktop tracker is already running (PID $($trackerProcess.Id))"
  } elseif (-not $SkipTracker) {
    $trackerStdout = Join-Path $LogDirectory "desktop-$Timestamp.out.log"
    $trackerStderr = Join-Path $LogDirectory "desktop-$Timestamp.err.log"
    Write-Step "Starting desktop tracker"
    $trackerProcess = Start-Process `
      -FilePath "npm.cmd" `
      -ArgumentList @("start") `
      -WorkingDirectory $DesktopDirectory `
      -WindowStyle Hidden `
      -RedirectStandardOutput $trackerStdout `
      -RedirectStandardError $trackerStderr `
      -PassThru
    Start-Sleep -Seconds 2
    if ($trackerProcess.HasExited) {
      Show-LogTail -Path $trackerStderr
      Show-LogTail -Path $trackerStdout
      throw "Desktop tracker exited during startup."
    }
    Set-Content -LiteralPath $DesktopPidFile -Value $trackerProcess.Id -Encoding ASCII
    $trackerLog = $trackerStdout
  }

  $apiPid = if ($apiProcess) { $apiProcess.Id } else { $null }
  $dashboardPid = if ($dashboardProcess) { $dashboardProcess.Id } else { $null }
  $trackerPid = if ($trackerProcess) { $trackerProcess.Id } else { $null }
  $state = [ordered]@{
    startedAt = (Get-Date).ToString("o")
    api = @{ url = "http://localhost:4000"; pid = $apiPid; reused = $null -eq $apiProcess }
    dashboard = @{ url = "http://localhost:3000"; pid = $dashboardPid; reused = $null -eq $dashboardProcess }
    tracker = @{ pid = $trackerPid; log = $trackerLog; skipped = [bool]$SkipTracker }
    logDirectory = $LogDirectory
  }
  $state | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $StateFile -Encoding UTF8

  Write-Host ""
  Write-Host "Samaritan is ready." -ForegroundColor Green
  Write-Host "Dashboard : http://localhost:3000"
  Write-Host "API       : http://localhost:4000"
  Write-Host "Logs      : $LogDirectory"
  Write-Host "State     : $StateFile"

  if ($OpenDashboard) {
    Start-Process "http://localhost:3000"
  }
} catch {
  Write-Host ""
  Write-Host "Samaritan startup failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
