import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeAll } from 'vitest';
import {
  commandExists,
  isExecutable,
  readPackageVersions,
  validateScriptStructure,
  checkSecurityIssues,
  validateHttpsUrls,
} from './helpers';

const SCRIPT_PATH = path.join(process.cwd(), 'install-linux.sh');

describe('install-linux.sh', () => {
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

    it('should check for Debian/Ubuntu before proceeding', () => {
      expect(scriptContent).toContain('/etc/debian_version');
      expect(scriptContent).toContain('only supports Ubuntu/Debian');
    });
  });

  describe('System Dependencies', () => {
    it('should update package lists before installing', () => {
      expect(scriptContent).toContain('sudo apt-get update');
    });

    it('should install required dependencies', () => {
      const requiredDeps = ['git', 'curl', 'jq', 'unzip'];
      for (const dep of requiredDeps) {
        expect(scriptContent).toContain(dep);
      }
    });

    it('should check if Docker is installed before installing', () => {
      expect(scriptContent).toContain('command -v docker');
      expect(scriptContent).toContain('Docker not found');
    });

    it('should install Docker using official script', () => {
      expect(scriptContent).toContain('https://get.docker.com');
    });

    it('should add user to docker group', () => {
      expect(scriptContent).toContain('usermod -aG docker');
      expect(scriptContent).toContain('$USER');
    });

    it('should inform user about docker group changes', () => {
      expect(scriptContent).toContain('log out and back in');
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
    it('should install pnpm globally', () => {
      expect(scriptContent).toContain('npm install -g');
      expect(scriptContent).toContain('pnpm@$PNPM_VERSION');
    });

    it('should configure pnpm in .bashrc', () => {
      expect(scriptContent).toContain('.bashrc');
      expect(scriptContent).toContain('PNPM_HOME');
    });

    it('should check if pnpm is already configured before adding', () => {
      expect(scriptContent).toContain('grep -q "PNPM_HOME"');
      expect(scriptContent).toContain('pnpm already configured');
    });

    it('should export pnpm paths for current session', () => {
      expect(scriptContent).toContain('export PNPM_HOME=');
      expect(scriptContent).toContain('export PATH="$PNPM_HOME:$PATH"');
    });

    it('should add pnpm to PATH correctly', () => {
      expect(scriptContent).toContain('case ":$PATH:" in');
      expect(scriptContent).toContain('*":$PNPM_HOME:"*)');
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
    it('should exit with error if not on Debian/Ubuntu', () => {
      expect(scriptContent).toContain('exit 1');
      expect(scriptContent).toContain('only supports Ubuntu/Debian');
    });

    it('should exit with error if package.json is missing', () => {
      const packageJsonCheck = scriptContent.includes('package.json not found') &&
                               scriptContent.includes('exit 1');
      expect(packageJsonCheck).toBe(true);
    });

    it('should handle Docker installation errors gracefully', () => {
      expect(scriptContent).toContain('set -e');
    });
  });

  describe('User Experience', () => {
    it('should display clear section headers', () => {
      expect(scriptContent).toContain('==========================================');
      expect(scriptContent).toContain('Talawa-API Automated Installer (Ubuntu)');
    });

    it('should provide informative messages during installation', () => {
      const messages = [
        'Updating package lists',
        'Installing Git',
        'Installing fnm',
        'Reading configuration',
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
  });

  describe('Script Execution Order', () => {
    it('should install system dependencies before fnm', () => {
      const aptGetIndex = scriptContent.indexOf('apt-get install');
      const fnmIndex = scriptContent.indexOf('Installing fnm');
      expect(aptGetIndex).toBeLessThan(fnmIndex);
    });

    it('should install fnm before reading package.json', () => {
      const fnmIndex = scriptContent.indexOf('Installing fnm');
      const packageJsonIndex = scriptContent.indexOf('package.json');
      expect(fnmIndex).toBeLessThan(packageJsonIndex);
    });

    it('should read versions before installing pnpm', () => {
      const readVersionsIndex = scriptContent.indexOf('Reading configuration');
      const pnpmInstallIndex = scriptContent.indexOf('Installing pnpm');
      expect(readVersionsIndex).toBeLessThan(pnpmInstallIndex);
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
    it('should use apt-get for Ubuntu/Debian', () => {
      expect(scriptContent).toContain('apt-get');
    });

    it('should check for Debian version file', () => {
      expect(scriptContent).toContain('/etc/debian_version');
    });

    it('should add user to docker group on Linux', () => {
      expect(scriptContent).toContain('usermod -aG docker');
    });

    it('should configure .bashrc for shell configuration', () => {
      expect(scriptContent).toContain('$HOME/.bashrc');
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
});