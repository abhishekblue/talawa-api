import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Integration tests for install.sh
 * These tests verify the shell script logic and requirements
 */
describe('install.sh integration tests', () => {
  const INSTALL_SCRIPT = path.join(process.cwd(), 'install.sh');
  const PACKAGE_JSON = path.join(process.cwd(), 'package.json');

  describe('Script Existence and Permissions', () => {
    it('should exist at project root', () => {
      expect(fs.existsSync(INSTALL_SCRIPT)).toBe(true);
    });

    it('should be executable', () => {
      if (process.platform !== 'win32') {
        const stats = fs.statSync(INSTALL_SCRIPT);
        const isExecutable = (stats.mode & 0o111) !== 0;
        expect(isExecutable).toBe(true);
      }
    });

    it('should have bash shebang', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content.startsWith('#!/bin/bash')).toBe(true);
    });

    it('should have error handling enabled (set -e)', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('set -e');
    });
  });

  describe('OS Detection Logic', () => {
    it('should detect Linux systems', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('Linux*)     MACHINE=Linux');
    });

    it('should detect Mac systems', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('Darwin*)    MACHINE=Mac');
    });

    it('should handle unknown OS', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('MACHINE="UNKNOWN:${OS}"');
    });

    it('should use uname -s for OS detection', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('OS="$(uname -s)"');
    });
  });

  describe('Linux Dependencies', () => {
    it('should update package lists on Linux', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('sudo apt-get update');
    });

    it('should install required packages on Linux', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('git curl jq unzip');
      expect(scriptContent).toContain('apt-get install -y');
    });

    it('should check for Docker before installing', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('if ! command -v docker');
    });

    it('should install Docker using get.docker.com', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('curl -fsSL https://get.docker.com | sh');
    });

    it('should add user to docker group', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('sudo usermod -aG docker $USER');
    });

    it('should check for Debian-based systems', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('if [ -f /etc/debian_version ]');
    });
  });

  describe('macOS Dependencies', () => {
    it('should check for Homebrew', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('if ! command -v brew');
    });

    it('should install Homebrew if missing', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh');
    });

    it('should install Git and JQ via Homebrew', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('brew install git jq');
    });

    it('should install Docker Desktop via Homebrew', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('brew install --cask docker');
    });

    it('should prompt user to start Docker Desktop', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('Press [Enter] here once Docker is running');
    });

    it('should handle Apple Silicon brew path', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('/opt/homebrew/bin/brew');
    });
  });

  describe('fnm (Fast Node Manager) Installation', () => {
    it('should check if fnm is already installed', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('if ! command -v fnm');
    });

    it('should install fnm from official source', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('curl -fsSL https://fnm.vercel.app/install | bash');
    });

    it('should activate fnm for current session', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('eval "$(fnm env --use-on-cd)"');
    });

    it('should add fnm to PATH', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('export PATH="$HOME/.local/share/fnm:$PATH"');
    });
  });

  describe('Version Parsing from package.json', () => {
    it('should check for package.json existence', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('if [ ! -f "package.json" ]');
    });

    it('should exit if package.json not found', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('Error: package.json not found');
      expect(scriptContent).toContain('exit 1');
    });

    it('should extract Node version from package.json', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain("jq -r '.engines.node");
    });

    it('should extract pnpm version from packageManager field', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain("jq -r '.packageManager'");
    });

    it('should parse Node version number', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain("grep -oE '[0-9]+' | head -1");
    });

    it('should handle pnpm@ prefix in packageManager', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('if [[ "$PNPM_FULL_STRING" == pnpm@* ]]');
      expect(scriptContent).toContain('PNPM_VERSION=${PNPM_FULL_STRING#pnpm@}');
    });

    it('should default to "latest" for pnpm if not specified', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('PNPM_VERSION="latest"');
    });

    it('should default to "lts" for Node if not specified', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('.engines.node // "lts"');
    });
  });

  describe('Node.js and pnpm Installation', () => {
    it('should install Node.js using fnm', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('fnm install $CLEAN_NODE_VERSION');
    });

    it('should activate installed Node version', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('fnm use $CLEAN_NODE_VERSION');
    });

    it('should install pnpm globally with specific version', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('npm install -g "pnpm@$PNPM_VERSION"');
    });
  });

  describe('Project Setup', () => {
    it('should install project dependencies', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('pnpm install');
    });

    it('should run setup script using tsx', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('pnpm exec tsx src/install/setup.ts');
    });

    it('should use pnpm exec for setup script', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('pnpm exec tsx');
    });
  });

  describe('User Feedback and Messages', () => {
    it('should display banner', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('Talawa-API Automated Installer');
    });

    it('should show detected OS', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('echo "Detected OS: $MACHINE"');
    });

    it('should show target versions', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('echo "Target Node Version:');
      expect(scriptContent).toContain('echo "Target pnpm Version:');
    });

    it('should display completion message', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('Installation Complete!');
    });

    it('should show progress messages', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('Installing Git');
      expect(scriptContent).toContain('Installing Node.js');
      expect(scriptContent).toContain('Installing pnpm');
      expect(scriptContent).toContain('Installing project dependencies');
    });
  });

  describe('Error Handling', () => {
    it('should exit on unsupported OS', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('Unsupported Operating System');
    });

    it('should exit on non-Debian Linux', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('This script currently only supports Ubuntu/Debian');
    });

    it('should use set -e for automatic error exit', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      const lines = scriptContent.split('\n');
      const setELine = lines.find(line => line.trim() === 'set -e');
      expect(setELine).toBeDefined();
    });
  });

  describe('Integration with package.json', () => {
    it('package.json should exist', () => {
      expect(fs.existsSync(PACKAGE_JSON)).toBe(true);
    });

    it('package.json should have engines.node field', () => {
      const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8'));
      expect(pkg.engines).toBeDefined();
      expect(pkg.engines.node).toBeDefined();
    });

    it('package.json should have packageManager field', () => {
      const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8'));
      expect(pkg.packageManager).toBeDefined();
      expect(pkg.packageManager).toMatch(/^pnpm@/);
    });

    it('should have valid Node version format', () => {
      const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8'));
      const nodeVersion = pkg.engines.node;
      expect(nodeVersion).toMatch(/\d+/);
    });

    it('should have valid pnpm version format', () => {
      const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8'));
      const packageManager = pkg.packageManager;
      expect(packageManager).toMatch(/^pnpm@\d+\.\d+\.\d+$/);
    });
  });

  describe('Script Structure', () => {
    it('should have numbered sections', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('# 1. Detect OS');
      expect(scriptContent).toContain('# 2. Install System Dependencies');
      expect(scriptContent).toContain('# 3. Install fnm');
      expect(scriptContent).toContain('# 4. Read Versions');
      expect(scriptContent).toContain('# 5. Install Node and pnpm');
    });

    it('should follow logical execution order', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      const osDetectionIndex = scriptContent.indexOf('# 1. Detect OS');
      const depsIndex = scriptContent.indexOf('# 2. Install System Dependencies');
      const fnmIndex = scriptContent.indexOf('# 3. Install fnm');
      const versionsIndex = scriptContent.indexOf('# 4. Read Versions');
      const installIndex = scriptContent.indexOf('# 5. Install Node and pnpm');

      expect(osDetectionIndex).toBeLessThan(depsIndex);
      expect(depsIndex).toBeLessThan(fnmIndex);
      expect(fnmIndex).toBeLessThan(versionsIndex);
      expect(versionsIndex).toBeLessThan(installIndex);
    });
  });

  describe('Security Considerations', () => {
    it('should use HTTPS for all downloads', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      const httpMatches = scriptContent.match(/http:\/\//g);
      expect(httpMatches).toBeNull();
    });

    it('should use official sources for installations', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('https://get.docker.com');
      expect(scriptContent).toContain('https://fnm.vercel.app/install');
      expect(scriptContent).toContain('https://raw.githubusercontent.com/Homebrew');
    });

    it('should not contain hardcoded credentials', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent.toLowerCase()).not.toMatch(/password\s*=\s*['"]/);
      expect(scriptContent.toLowerCase()).not.toMatch(/api[_-]?key\s*=\s*['"]/);
      expect(scriptContent.toLowerCase()).not.toMatch(/secret\s*=\s*['"]/);
    });
  });

  describe('Idempotency', () => {
    it('should check if tools are already installed', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('if ! command -v docker');
      expect(scriptContent).toContain('if ! command -v brew');
      expect(scriptContent).toContain('if ! command -v fnm');
    });

    it('should display messages for already installed tools', () => {
      const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(scriptContent).toContain('Docker is already installed');
      expect(scriptContent).toContain('fnm is already installed');
    });
  });
});