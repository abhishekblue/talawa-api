import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeAll } from 'vitest';
import {
  isExecutable,
  readPackageVersions,
  validateScriptStructure,
  checkSecurityIssues,
  validateHttpsUrls,
  compareScriptFeatures,
} from './helpers';

const SCRIPT_PATH = path.join(process.cwd(), 'install-macos.sh');
const LINUX_SCRIPT_PATH = path.join(process.cwd(), 'install-linux.sh');

describe('install-macos.sh', () => {
  let scriptContent: string;

  beforeAll(() => {
    scriptContent = fs.readFileSync(SCRIPT_PATH, 'utf-8');
  });

  describe('File Properties', () => {
    it('should exist', () => {
      expect(fs.existsSync(SCRIPT_PATH)).toBe(true);
    });

    it('should be executable', () => {
      expect(isExecutable(SCRIPT_PATH)).toBe(true);
    });

    it('should have correct shebang', () => {
      expect(scriptContent.startsWith('#!/bin/bash')).toBe(true);
    });

    it('should use set -e for error handling', () => {
      expect(scriptContent).toContain('set -e');
    });
  });

  describe('Required Sections', () => {
    it('should have all required installation sections', () => {
      const expectedSections = [
        'Install System Dependencies',
        'Install fnm',
        'Read Versions from package.json',
        'Install Node and pnpm',
        'Install Project Dependencies',
        'Run Setup Script',
      ];

      const result = validateScriptStructure(SCRIPT_PATH, expectedSections);
      expect(result.valid).toBe(true);
      expect(result.missingSections).toEqual([]);
    });
  });

  describe('Homebrew Installation', () => {
    it('should check if Homebrew is installed', () => {
      expect(scriptContent).toContain('command -v brew');
      expect(scriptContent).toContain('Homebrew not found');
    });

    it('should install Homebrew from official source', () => {
      expect(scriptContent).toContain('https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh');
    });

    it('should handle Apple Silicon Homebrew path', () => {
      expect(scriptContent).toContain('/opt/homebrew/bin/brew');
      expect(scriptContent).toContain('brew shellenv');
    });

    it('should install git and jq via Homebrew', () => {
      expect(scriptContent).toContain('brew install git jq');
    });
  });

  describe('Docker Desktop Installation', () => {
    it('should check if Docker is already installed', () => {
      expect(scriptContent).toContain('command -v docker');
      expect(scriptContent).toContain('Docker is already installed');
    });

    it('should display Docker license agreement', () => {
      expect(scriptContent).toContain('Docker Desktop License Agreement');
      expect(scriptContent).toContain('Subscription Service Agreement');
      expect(scriptContent).toContain('https://www.docker.com/legal/docker-subscription-service-agreement');
    });

    it('should require user acceptance before installing', () => {
      expect(scriptContent).toContain('Press [Enter] to accept');
      expect(scriptContent).toContain('read -r');
    });

    it('should detect system architecture (ARM64 vs AMD64)', () => {
      expect(scriptContent).toContain('uname -m');
      expect(scriptContent).toContain('arm64');
      expect(scriptContent).toContain('amd64');
      expect(scriptContent).toContain('Apple Silicon');
      expect(scriptContent).toContain('Intel');
    });

    it('should download correct Docker Desktop version for architecture', () => {
      expect(scriptContent).toContain('https://desktop.docker.com/mac/main/arm64/Docker.dmg');
      expect(scriptContent).toContain('https://desktop.docker.com/mac/main/amd64/Docker.dmg');
    });

    it('should mount DMG file', () => {
      expect(scriptContent).toContain('hdiutil attach');
      expect(scriptContent).toContain('/tmp/Docker.dmg');
    });

    it('should install Docker with --accept-license flag', () => {
      expect(scriptContent).toContain('--accept-license');
      expect(scriptContent).toContain('--user=$USER');
    });

    it('should unmount DMG after installation', () => {
      expect(scriptContent).toContain('hdiutil detach');
      expect(scriptContent).toContain('/Volumes/Docker');
    });

    it('should clean up DMG file', () => {
      expect(scriptContent).toContain('rm /tmp/Docker.dmg');
    });

    it('should open Docker Desktop application', () => {
      expect(scriptContent).toContain('open -a /Applications/Docker.app');
    });

    it('should verify Docker app installation location', () => {
      expect(scriptContent).toContain('/Applications/Docker.app');
      expect(scriptContent).toContain('Docker Desktop was not installed');
    });
  });

  describe('Docker Daemon Health Check', () => {
    it('should wait for Docker daemon to be ready', () => {
      expect(scriptContent).toContain('docker info');
      expect(scriptContent).toContain('Waiting for Docker daemon');
    });

    it('should have timeout for Docker daemon startup (new install)', () => {
      expect(scriptContent).toContain('DOCKER_TIMEOUT=120');
      expect(scriptContent).toContain('DOCKER_ELAPSED');
    });

    it('should have timeout for Docker daemon startup (already installed)', () => {
      expect(scriptContent).toContain('DOCKER_TIMEOUT=60');
    });

    it('should check Docker info periodically', () => {
      expect(scriptContent).toContain('while ! docker info');
      expect(scriptContent).toContain('sleep');
    });

    it('should display waiting progress to user', () => {
      expect(scriptContent).toContain('Waiting for Docker...');
      expect(scriptContent).toContain('$DOCKER_ELAPSED/$DOCKER_TIMEOUT');
    });

    it('should exit with error if Docker daemon does not start in time', () => {
      expect(scriptContent).toContain('did not start within');
      expect(scriptContent).toContain('exit 1');
    });

    it('should confirm when Docker is running', () => {
      expect(scriptContent).toContain('Docker Desktop is running');
      expect(scriptContent).toContain('Docker daemon is already running');
    });

    it('should start Docker if already installed but not running', () => {
      expect(scriptContent).toContain('Docker daemon is not running');
      expect(scriptContent).toContain('Starting Docker Desktop');
      expect(scriptContent).toContain('open -a Docker');
    });
  });

  describe('fnm Installation', () => {
    it('should check if fnm is already installed', () => {
      expect(scriptContent).toContain('command -v fnm');
      expect(scriptContent).toContain('fnm is already installed');
    });

    it('should install fnm from official source', () => {
      expect(scriptContent).toContain('https://fnm.vercel.app/install');
    });

    it('should activate fnm for current session', () => {
      expect(scriptContent).toContain('fnm env');
      expect(scriptContent).toContain('eval "$(fnm env)"');
    });

    it('should add fnm to PATH', () => {
      expect(scriptContent).toContain('.local/share/fnm');
      expect(scriptContent).toContain('export PATH=');
    });
  });

  describe('Version Management', () => {
    it('should check for package.json existence', () => {
      expect(scriptContent).toContain('! -f "package.json"');
      expect(scriptContent).toContain('package.json not found');
    });

    it('should read Node version from package.json', () => {
      expect(scriptContent).toContain('jq -r \'.engines.node');
      expect(scriptContent).toContain('NODE_VERSION');
    });

    it('should read pnpm version from package.json', () => {
      expect(scriptContent).toContain('jq -r \'.packageManager');
      expect(scriptContent).toContain('PNPM_VERSION');
    });

    it('should handle version number extraction correctly', () => {
      expect(scriptContent).toContain('CLEAN_NODE_VERSION');
      expect(scriptContent).toContain('grep -oE');
    });

    it('should extract pnpm version from packageManager field', () => {
      expect(scriptContent).toContain('pnpm@*');
      expect(scriptContent).toContain('#pnpm@');
    });

    it('should default to latest for pnpm if not specified', () => {
      expect(scriptContent).toContain('PNPM_VERSION="latest"');
    });

    it('should display target versions to user', () => {
      expect(scriptContent).toContain('Target Node Version');
      expect(scriptContent).toContain('Target pnpm Version');
    });
  });

  describe('Node.js and pnpm Installation', () => {
    it('should install Node.js using fnm', () => {
      expect(scriptContent).toContain('fnm install $CLEAN_NODE_VERSION');
      expect(scriptContent).toContain('fnm use $CLEAN_NODE_VERSION');
    });

    it('should install pnpm globally', () => {
      expect(scriptContent).toContain('npm install -g');
      expect(scriptContent).toContain('pnpm@$PNPM_VERSION');
    });

    it('should configure pnpm using pnpm setup', () => {
      expect(scriptContent).toContain('pnpm setup');
      expect(scriptContent).toContain('Configuring pnpm');
    });

    it('should export pnpm paths for current session', () => {
      expect(scriptContent).toContain('export PNPM_HOME=');
      expect(scriptContent).toContain('export PATH="$PNPM_HOME:$PATH"');
    });
  });

  describe('Project Setup', () => {
    it('should install project dependencies using pnpm', () => {
      expect(scriptContent).toContain('pnpm install');
      expect(scriptContent).toContain('Installing project dependencies');
    });

    it('should run setupLocal.ts using pnpm exec tsx', () => {
      expect(scriptContent).toContain('pnpm exec tsx');
      expect(scriptContent).toContain('src/install/setupLocal.ts');
    });

    it('should display completion message', () => {
      expect(scriptContent).toContain('Installation Complete');
    });

    it('should reload shell at the end', () => {
      expect(scriptContent).toContain('exec "$SHELL"');
    });
  });

  describe('Security', () => {
    it('should use HTTPS for all external downloads', () => {
      const httpsCheck = validateHttpsUrls(scriptContent);
      expect(httpsCheck.valid).toBe(true);
      if (!httpsCheck.valid) {
        console.log('Insecure URLs found:', httpsCheck.insecureUrls);
      }
    });

    it('should not contain hardcoded credentials', () => {
      const securityCheck = checkSecurityIssues(scriptContent);
      const credentialIssues = securityCheck.issues.filter(issue =>
        issue.includes('hardcoded credential')
      );
      expect(credentialIssues.length).toBe(0);
    });

    it('should use set -e for error handling', () => {
      const securityCheck = checkSecurityIssues(scriptContent);
      const setEIssue = securityCheck.issues.find(issue =>
        issue.includes('set -e')
      );
      expect(setEIssue).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should exit with error if package.json is missing', () => {
      const packageJsonCheck = scriptContent.includes('package.json not found') &&
                               scriptContent.includes('exit 1');
      expect(packageJsonCheck).toBe(true);
    });

    it('should exit with error if Docker Desktop installation fails', () => {
      expect(scriptContent).toContain('Docker Desktop was not installed');
      expect(scriptContent).toContain('exit 1');
    });

    it('should handle Docker daemon timeout', () => {
      expect(scriptContent).toContain('did not start within');
      expect(scriptContent).toContain('exit 1');
    });
  });

  describe('User Experience', () => {
    it('should display clear section headers', () => {
      expect(scriptContent).toContain('==========================================');
      expect(scriptContent).toContain('Talawa-API Automated Installer (macOS)');
    });

    it('should provide informative messages during installation', () => {
      const messages = [
        'Installing Git',
        'Installing fnm',
        'Reading configuration',
        'Installing Node.js',
        'Installing pnpm',
        'Installing project dependencies',
        'Running Setup Script',
      ];

      for (const message of messages) {
        expect(scriptContent).toContain(message);
      }
    });

    it('should inform user when tools are already installed', () => {
      expect(scriptContent).toContain('already installed');
    });

    it('should show architecture detection', () => {
      expect(scriptContent).toContain('Detected Apple Silicon');
      expect(scriptContent).toContain('Detected Intel');
    });
  });

  describe('Script Execution Order', () => {
    it('should install Homebrew before other dependencies', () => {
      const brewIndex = scriptContent.indexOf('Homebrew');
      const gitIndex = scriptContent.indexOf('brew install git');
      expect(brewIndex).toBeLessThan(gitIndex);
    });

    it('should install system dependencies before fnm', () => {
      const brewIndex = scriptContent.indexOf('brew install');
      const fnmIndex = scriptContent.indexOf('Installing fnm');
      expect(brewIndex).toBeLessThan(fnmIndex);
    });

    it('should install fnm before reading package.json', () => {
      const fnmIndex = scriptContent.indexOf('Installing fnm');
      const packageJsonIndex = scriptContent.indexOf('Reading configuration');
      expect(fnmIndex).toBeLessThan(packageJsonIndex);
    });

    it('should read versions before installing Node', () => {
      const readVersionsIndex = scriptContent.indexOf('Reading configuration');
      const nodeInstallIndex = scriptContent.indexOf('Installing Node.js');
      expect(readVersionsIndex).toBeLessThan(nodeInstallIndex);
    });

    it('should install Node before pnpm', () => {
      const nodeIndex = scriptContent.indexOf('fnm install');
      const pnpmIndex = scriptContent.indexOf('Installing pnpm');
      expect(nodeIndex).toBeLessThan(pnpmIndex);
    });

    it('should install pnpm before project dependencies', () => {
      const pnpmIndex = scriptContent.indexOf('Installing pnpm');
      const depsIndex = scriptContent.indexOf('Installing project dependencies');
      expect(pnpmIndex).toBeLessThan(depsIndex);
    });

    it('should install dependencies before running setup script', () => {
      const depsIndex = scriptContent.indexOf('pnpm install');
      const setupIndex = scriptContent.indexOf('setupLocal.ts');
      expect(depsIndex).toBeLessThan(setupIndex);
    });
  });

  describe('Environment Variables', () => {
    it('should set PNPM_HOME environment variable', () => {
      expect(scriptContent).toContain('PNPM_HOME=');
    });

    it('should update PATH to include pnpm', () => {
      expect(scriptContent).toContain('PATH="$PNPM_HOME:$PATH"');
    });

    it('should update PATH to include fnm', () => {
      expect(scriptContent).toContain('.local/share/fnm:$PATH');
    });
  });

  describe('Platform-Specific Features', () => {
    it('should use Homebrew for package management', () => {
      expect(scriptContent).toContain('brew');
    });

    it('should use hdiutil for DMG handling', () => {
      expect(scriptContent).toContain('hdiutil');
    });

    it('should use open command to launch applications', () => {
      expect(scriptContent).toContain('open -a');
    });

    it('should detect ARM64 vs AMD64 architecture', () => {
      expect(scriptContent).toContain('uname -m');
      expect(scriptContent).toContain('arm64');
      expect(scriptContent).toContain('amd64');
    });

    it('should install fnm using Node.js (not via Homebrew)', () => {
      expect(scriptContent).toContain('fnm install');
      expect(scriptContent).toContain('fnm use');
    });
  });

  describe('Docker-Specific Features', () => {
    it('should handle DMG mounting and unmounting', () => {
      expect(scriptContent).toContain('hdiutil attach');
      expect(scriptContent).toContain('hdiutil detach');
    });

    it('should wait after installation before starting Docker', () => {
      expect(scriptContent).toContain('sleep 3');
    });

    it('should verify Docker daemon health', () => {
      expect(scriptContent).toContain('docker info');
    });
  });

  describe('Integration with package.json', () => {
    it('should match versions with actual package.json', () => {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const versions = readPackageVersions(packageJsonPath);

      expect(versions.nodeVersion).toBeTruthy();
      expect(versions.pnpmVersion).toBeTruthy();
    });
  });

  describe('Feature Parity with Linux Script', () => {
    it('should have similar features to Linux script', () => {
      const comparison = compareScriptFeatures(LINUX_SCRIPT_PATH, SCRIPT_PATH);

      expect(comparison.common).toContain('git');
      expect(comparison.common).toContain('docker');
      expect(comparison.common).toContain('fnm');
      expect(comparison.common).toContain('pnpm');
      expect(comparison.common).toContain('setup.ts');
    });

    it('should both reload shell at the end', () => {
      const linuxScript = fs.readFileSync(LINUX_SCRIPT_PATH, 'utf-8');
      expect(scriptContent).toContain('exec "$SHELL"');
      expect(linuxScript).toContain('exec "$SHELL"');
    });

    it('should both run setupLocal.ts', () => {
      const linuxScript = fs.readFileSync(LINUX_SCRIPT_PATH, 'utf-8');
      expect(scriptContent).toContain('src/install/setupLocal.ts');
      expect(linuxScript).toContain('src/install/setupLocal.ts');
    });
  });
});