#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "=========================================="
echo "Talawa-API Automated Installer"
echo "=========================================="

# Detect OS and run appropriate installer
OS="$(uname -s)"
case "${OS}" in
    Linux*)
        echo "Detected: Linux"
        echo "Running Linux installer (install-linux.sh)..."
        echo ""
        chmod +x ./install-linux.sh
        exec ./install-linux.sh
        ;;
    Darwin*)
        echo "Detected: macOS"
        echo "Running macOS installer (install-macos.sh)..."
        echo ""
        chmod +x ./install-macos.sh
        exec ./install-macos.sh
        ;;
    *)
        echo "Error: Unsupported Operating System: ${OS}"
        echo ""
        echo "This installer supports:"
        echo "  - Ubuntu/Debian (use install-linux.sh)"
        echo "  - macOS (use install-macos.sh)"
        echo "  - Windows (use install.ps1)"
        exit 1
        ;;
esac