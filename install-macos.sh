#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "=========================================="
echo "Talawa-API Automated Installer (macOS)"
echo "=========================================="

# 1. Install System Dependencies (Git, JQ, Docker Desktop)
# Check for Homebrew
if ! command -v brew &> /dev/null; then
    echo "Homebrew not found. Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    if [ -f "/opt/homebrew/bin/brew" ]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
fi

echo "Installing Git and JQ..."
brew install git jq

# Install Docker Desktop if missing
if ! command -v docker &> /dev/null; then
    echo "Docker not found. Installing Docker Desktop..."
    brew install --cask docker

    echo "--------------------------------------------------------"
    echo "ACTION REQUIRED: Docker Desktop has been installed."
    echo "Please open 'Docker' from your Applications folder now."
    echo "Wait until the engine is running (whale icon stops animating)."
    echo "Press [Enter] here once Docker is running..."
    echo "--------------------------------------------------------"
    read -r
else
    echo "Docker is already installed."
fi

# 2. Install fnm (Fast Node Manager)
if ! command -v fnm &> /dev/null; then
    echo "Installing fnm..."
    curl -fsSL https://fnm.vercel.app/install | bash

    # Activate fnm for this session
    export PATH="$HOME/.local/share/fnm:$PATH"
    eval "$(fnm env --use-on-cd)"
else
    echo "fnm is already installed."
    eval "$(fnm env --use-on-cd)"
fi

# 3. Read Versions from package.json
if [ ! -f "package.json" ]; then
    echo "Error: package.json not found in current directory."
    exit 1
fi

echo "Reading configuration from package.json..."
# Extract just the version number (e.g. "18.x" -> "18")
NODE_VERSION=$(jq -r '.engines.node // "lts"' package.json)
CLEAN_NODE_VERSION=$(echo "$NODE_VERSION" | grep -oE '[0-9]+' | head -1)

# Extract pnpm version (e.g. "pnpm@8.1.0" -> "8.1.0")
PNPM_FULL_STRING=$(jq -r '.packageManager' package.json)
if [[ "$PNPM_FULL_STRING" == pnpm@* ]]; then
    PNPM_VERSION=${PNPM_FULL_STRING#pnpm@}
else
    PNPM_VERSION="latest"
fi

echo "Target Node Version: $CLEAN_NODE_VERSION"
echo "Target pnpm Version: $PNPM_VERSION"

# 4. Install Node and pnpm
echo "Installing Node.js..."
fnm install $CLEAN_NODE_VERSION
fnm use $CLEAN_NODE_VERSION

echo "Installing pnpm..."
npm install -g "pnpm@$PNPM_VERSION"

# Configure pnpm (setup global bin directory)
echo "Configuring pnpm..."
pnpm setup

# Add pnpm to PATH for current session
export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME:$PATH"

# 5. Install Project Dependencies
echo "Installing project dependencies..."
pnpm install

# 6. Run Setup Script
echo "Running Setup Script..."
# We use 'pnpm exec' to ensure we use the local tsx package
pnpm exec tsx src/install/setup.ts

echo "=========================================="
echo "Installation Complete!"
echo "=========================================="
