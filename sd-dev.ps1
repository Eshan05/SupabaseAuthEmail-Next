param (
  [string]$Mode = "service" # Options: 'service' or 'dev'
)

function Load-EnvFile {
  param([string]$Path = ".env.local")
  if (Test-Path $Path) {
    Write-Host "-- Loading environment variables from: $Path" -ForegroundColor Cyan
    Get-Content $Path | ForEach-Object {
      if ($_ -match "^\s*([^#][^=]*)=(.*)$") {
        $key, $value = $matches[1..2]
        [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
      }
    }
  } else {
    Write-Host "△  Warning: $Path not found" -ForegroundColor Red
  }
}

function Test-DockerContainerRunning {
    param([string]$ContainerName)
    $runningContainers = docker ps --format "{{.Names}}"
    return $runningContainers | Select-String -Pattern "^$ContainerName$" -Quiet
}

# $supabaseConfigPath = Join-Path $PSScriptRoot "supabase" "config.toml"
function Get-SupabaseProjectId {
  $configFile = "supabase\config.toml"
  if (Test-Path $configFile) {
    $content = Get-Content $configFile -Raw
    if ($content -match "project_id\s*=\s*['""]?([^'""]+)['""]?") {
      return $matches[1]
    }
  }
  Write-Warning "Could not find Project ID from $configFile."
  return "1609"
}

try {
  Load-EnvFile
  $supabaseProjectId = Get-SupabaseProjectId

  Write-Host "△  Checking for running local Supabase (ID: $supabaseProjectId)..." -ForegroundColor Cyan
  $supabaseContainer = docker ps --format "{{.Names}}" | Select-String -Pattern "^${supabaseProjectId}_"

  if ($supabaseContainer) {
    Write-Host "-- Local Supabase containers are already running." -ForegroundColor Green
  } else {
    Write-Host "-- Starting local Supabase (ID: $supabaseProjectId)..." -ForegroundColor Cyan
    Start-Process supabase start -NoNewWindow -Wait -ErrorAction SilentlyContinue

    Start-Sleep -Seconds 10 
    Write-Host "△  Local Supabase should be running." -ForegroundColor Green
  }

  $redisContainer = docker ps --format "{{.Names}}" | Select-String -Pattern "^redis-stack-server$"
  if ($redisContainer) {
    Write-Host "-- Redis Stack container is already running." -ForegroundColor Green
  } else {
    Write-Host "-- Starting Redis Stack (<8.0)..." -ForegroundColor Cyan
    Write-Host "△  Stopping any existing Redis container..." -ForegroundColor Red
    docker ps -q -f name=redis-stack-server | ForEach-Object { docker stop $_ }
    docker ps -aq -f name=redis-stack-server | ForEach-Object { docker rm $_ }

    $redisId = docker run -d --rm --name redis-stack-server -p 6379:6379 -p 8001:8001 redis/redis-stack:latest
    $shortId = $redisId.Substring(0,12)
    Write-Host "△  Redis Stack started (Container ID: $shortId)" -ForegroundColor Green

    $attempts = 0
    while ($attempts -lt 10) {
      $response = docker exec redis-stack-server redis-cli ping 2>$null
      if ($response -eq "PONG") {
        Write-Host "-- Redis is ready!" -ForegroundColor Green
        break
      } else {
        Write-Host "   Waiting for Redis to be ready..." -ForegroundColor DarkGray
        Start-Sleep -Seconds 1
        $attempts++
      }
    }

    if ($attempts -eq 10) {
      Write-Host "△  Redis did not start properly after 10 seconds." -ForegroundColor Red
    }
  }

  Start-Sleep -Seconds 5

  if ($Mode -eq "dev") {
    Write-Host "△  Starting in DEV mode" -ForegroundColor Blue
    Write-Host "-- Checking for any type errors..." -ForegroundColor Cyan
    pnpm lint:ts
    Start-Sleep -Seconds 3
    pnpm dev
  } else {
    Write-Host "△  Running in SERVICE mode" -ForegroundColor Blue
    Write-Host "-- To start the app, run: pnpm dev" -ForegroundColor Cyan

    while ($true) {
      Start-Sleep -Seconds 60
    }
  }

} catch {
  Write-Error $_
  exit 1
} finally {
  Write-Host "`n△  Cleaning up..." -ForegroundColor Cyan
  $supabaseProjectId = Get-SupabaseProjectId

  Write-Host "-- Stopping local Supabase (project ID: $supabaseProjectId)..." -ForegroundColor Red
  Start-Process supabase stop -NoNewWindow -Wait -ErrorAction SilentlyContinue
  Write-Host "△  Local Supabase stopped." -ForegroundColor Yellow

  Write-Host "-- Stopping Redis Stack..." -ForegroundColor Red
  $redisId = docker ps -q -f name=redis-stack-server
  if ($redisId) {
    Write-Host "-- Stopping Redis Stack (Container ID: $redisId)" -ForegroundColor Yellow
    docker stop $redisId > $null 2>&1
    docker rm $redisId > $null 2>&1  
  } else {
    Write-Host "△  Redis Stack container not found." -ForegroundColor Yellow
  }
}

# docker run -it redis:alpine redis-cli --tls -u redis://default:********@<endpoint>.upstash.io:<port>