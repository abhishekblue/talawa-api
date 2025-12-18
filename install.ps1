<#
.SYNOPSIS
    Talawa-API Automated Installer for Windows
.DESCRIPTION
    Installs Git, Docker, Node.js (via fnm), and pnpm using Winget and PowerShell.
    Sets up the local environment and runs the project setup script.
#>

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Talawa-API Automated Installer (Windows)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# ----------------------------------------------------------------
# 1. Check & Install System Dependencies (Git, Docker)
# We use 'winget' (Windows Package Manager) or 'choco' (Chocolatey) as fallback.
# ----------------------------------------------------------------

# Determine which package manager to use
$useWinget = $false
$useChoco = $false

if (Get-Command "winget" -ErrorAction SilentlyContinue) {
    Write-Host "✅ Using winget (Windows Package Manager)" -ForegroundColor Green
    $useWinget = $true
} elseif (Get-Command "choco" -ErrorAction SilentlyContinue) {
    Write-Host "✅ Using Chocolatey package manager" -ForegroundColor Green
    $useChoco = $true
} else {
    Write-Host "No package manager found. Installing Chocolatey..." -ForegroundColor Yellow
    Write-Host "This requires Administrator privileges." -ForegroundColor Yellow

    # Install Chocolatey
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    try {
        Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        $useChoco = $true

        # Refresh environment to find choco
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    } catch {
        Write-Error "Failed to install Chocolatey. Please install either 'winget' or 'chocolatey' manually and re-run this script."
        exit 1
    }
}

# Install Git
if (-not (Get-Command "git" -ErrorAction SilentlyContinue)) {
    Write-Host "Git not found. Installing Git..." -ForegroundColor Yellow
    if ($useWinget) {
        winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements --disable-interactivity
    } else {
        choco install git -y
    }

    # Refresh Path for the current session so we can use git immediately
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
} else {
    Write-Host "✅ Git is already installed." -ForegroundColor Green
}

# Install Docker Desktop
if (-not (Get-Command "docker" -ErrorAction SilentlyContinue)) {
    Write-Host "Docker not found. Installing Docker Desktop..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "Docker Desktop License Agreement" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "This installer will download and install Docker Desktop."
    Write-Host "By pressing Enter, you agree to Docker's Subscription Service Agreement."
    Write-Host "License: https://www.docker.com/legal/docker-subscription-service-agreement"
    Write-Host ""
    Write-Host "Press [Enter] to accept and continue, or Ctrl+C to cancel..." -ForegroundColor Yellow
    Read-Host

    # Download Docker Desktop installer
    $dockerInstaller = "$env:TEMP\DockerDesktopInstaller.exe"
    Write-Host "Downloading Docker Desktop..."
    Invoke-WebRequest -Uri "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe" -OutFile $dockerInstaller

    # Install with --accept-license flag
    Write-Host "Installing Docker Desktop..." -ForegroundColor Yellow
    Start-Process -FilePath $dockerInstaller -ArgumentList "install", "--quiet", "--accept-license" -Wait

    # Clean up
    Remove-Item $dockerInstaller

    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

    Write-Host "Starting Docker Desktop..." -ForegroundColor Yellow
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"

    Write-Host "Waiting for Docker daemon to be ready..." -ForegroundColor Yellow
    $dockerTimeout = 120
    $dockerElapsed = 0
    while ($true) {
        try {
            docker info 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                break
            }
        } catch {
            # Docker command failed, continue waiting
        }

        if ($dockerElapsed -ge $dockerTimeout) {
            Write-Error "Error: Docker daemon did not start within $dockerTimeout seconds."
            exit 1
        }

        Write-Host "  Waiting for Docker... ($dockerElapsed/$dockerTimeout seconds)"
        Start-Sleep -Seconds 5
        $dockerElapsed += 5
    }

    Write-Host "✓ Docker Desktop is running!" -ForegroundColor Green
} else {
    Write-Host "✅ Docker is installed." -ForegroundColor Green

    # Verify Docker daemon is running
    Write-Host "Checking Docker daemon status..." -ForegroundColor Yellow
    try {
        docker info 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Docker daemon not responding" }
        Write-Host "✓ Docker daemon is already running." -ForegroundColor Green
    } catch {
        Write-Host "Docker daemon is not running. Starting Docker Desktop..." -ForegroundColor Yellow
        Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"

        Write-Host "Waiting for Docker daemon to be ready..." -ForegroundColor Yellow
        $dockerTimeout = 60
        $dockerElapsed = 0
        while ($true) {
            try {
                docker info 2>&1 | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    break
                }
            } catch {
                # Docker command failed, continue waiting
            }

            if ($dockerElapsed -ge $dockerTimeout) {
                Write-Error "Error: Docker daemon did not start within $dockerTimeout seconds."
                exit 1
            }

            Write-Host "  Waiting for Docker... ($dockerElapsed/$dockerTimeout seconds)"
            Start-Sleep -Seconds 3
            $dockerElapsed += 3
        }
        Write-Host "✓ Docker Desktop is running!" -ForegroundColor Green
    }
}

# ----------------------------------------------------------------
# 2. Install FNM (Fast Node Manager)
# ----------------------------------------------------------------
if (-not (Get-Command "fnm" -ErrorAction SilentlyContinue)) {
    Write-Host "Installing fnm..." -ForegroundColor Yellow
    if ($useWinget) {
        winget install Schniz.fnm --accept-package-agreements --accept-source-agreements --disable-interactivity
    } else {
        choco install fnm -y
    }

    # Refresh Path again to find fnm
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
} else {
    Write-Host "✅ fnm is already installed." -ForegroundColor Green
}

# Initialize fnm for this session
# We invoke the env command and evaluate the output to set variables in current scope
fnm env --use-on-cd | Out-String | Invoke-Expression

# ----------------------------------------------------------------
# 3. Read Versions from package.json
# PowerShell has native JSON support, so we don't need 'jq'.
# ----------------------------------------------------------------
if (-not (Test-Path "package.json")) {
    Write-Error "Error: package.json not found in current directory."
    exit 1
}

Write-Host "Reading configuration from package.json..."
$pkg = Get-Content "package.json" -Raw | ConvertFrom-Json

# Parse Node Version (e.g. "23.7.0" -> "23.7.0", ">=18.0.0" -> "18")
$nodeEngine = $pkg.engines.node
if ($nodeEngine -match '^[\^>=]+') {
    # Version starts with >= or ^, extract major version only
    $cleanNodeVer = if ($nodeEngine -match '(\d+)') { $matches[1] } else { "lts" }
} else {
    # Exact version, use as-is
    $cleanNodeVer = $nodeEngine
}

# Parse pnpm Version (handles "pnpm@8.x.x")
$pnpmString = $pkg.packageManager
if ($null -ne $pnpmString -and $pnpmString -match 'pnpm@(.*)') {
    $pnpmVer = $matches[1]
} else {
    $pnpmVer = "latest"
}

Write-Host "Target Node Version: $cleanNodeVer" -ForegroundColor Cyan
Write-Host "Target pnpm Version: $pnpmVer" -ForegroundColor Cyan

# ----------------------------------------------------------------
# 4. Install Node & pnpm
# ----------------------------------------------------------------
Write-Host "Installing Node.js..."
fnm install $cleanNodeVer
fnm use $cleanNodeVer

Write-Host "Installing pnpm..."
npm install -g "pnpm@$pnpmVer"

# Configure pnpm (setup global bin directory)
Write-Host "Configuring pnpm..."
pnpm setup

# Refresh Path to ensure pnpm global packages are accessible
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# ----------------------------------------------------------------
# 5. Project Setup
# ----------------------------------------------------------------
Write-Host "Installing project dependencies..." -ForegroundColor Yellow
pnpm install

Write-Host "Running Setup Script..." -ForegroundColor Yellow
# Use 'pnpm exec' to ensure we use the local tsx
pnpm exec tsx src/install/setupLocal.ts

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Installation Complete!" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan