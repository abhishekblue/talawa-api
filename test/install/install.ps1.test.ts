import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Integration tests for install.ps1
 * These tests verify the PowerShell script logic and requirements
 */
describe('install.ps1 integration tests', () => {
  const INSTALL_SCRIPT = path.join(process.cwd(), 'install.ps1');
  const PACKAGE_JSON = path.join(process.cwd(), 'package.json');

  describe('Script Existence and Structure', () => {
    it('should exist at project root', () => {
      expect(fs.existsSync(INSTALL_SCRIPT)).toBe(true);
    });

    it('should have PowerShell file extension', () => {
      expect(INSTALL_SCRIPT.endsWith('.ps1')).toBe(true);
    });

    it('should have synopsis documentation', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('.SYNOPSIS');
      expect(content).toContain('Talawa-API Automated Installer for Windows');
    });

    it('should have description documentation', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('.DESCRIPTION');
    });

    it('should have error action preference set to Stop', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('$ErrorActionPreference = "Stop"');
    });
  });

  describe('Winget Package Manager', () => {
    it('should check for winget availability', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('Get-Command "winget"');
    });

    it('should provide error message if winget not found', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain("'winget' is required but not found");
      expect(content).toContain('App Installer');
    });

    it('should exit if winget not available', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('exit 1');
    });
  });

  describe('Git Installation', () => {
    it('should check if Git is already installed', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('Get-Command "git"');
    });

    it('should install Git using winget', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('winget install --id Git.Git');
    });

    it('should use exact match for Git installation', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('-e --source winget');
    });

    it('should accept package agreements automatically', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('--accept-package-agreements');
      expect(content).toContain('--accept-source-agreements');
    });

    it('should disable interactivity', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('--disable-interactivity');
    });

    it('should refresh PATH after Git installation', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('$env:Path =');
      expect(content).toContain('[System.Environment]::GetEnvironmentVariable("Path"');
    });

    it('should display success message if Git already installed', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('✅ Git is already installed');
    });
  });

  describe('Docker Desktop Installation', () => {
    it('should check if Docker is already installed', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('Get-Command "docker"');
    });

    it('should install Docker Desktop using winget', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('winget install --id Docker.DockerDesktop');
    });

    it('should prompt user to start Docker Desktop', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('ACTION REQUIRED: Docker Desktop has been installed');
      expect(content).toContain("Please open 'Docker Desktop' from your Start Menu");
      expect(content).toContain('Wait until the engine is fully running');
    });

    it('should check Docker daemon status', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('docker info');
      expect(content).toContain('Checking Docker status');
    });

    it('should handle Docker daemon not responding', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('Docker daemon not responding');
    });

    it('should wait for user to start Docker if stopped', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('Docker Desktop seems to be stopped');
      expect(content).toContain('Press Enter once you have started it');
    });

    it('should verify Docker twice if initially stopped', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('# Check one more time');
      expect(content).toContain('docker info | Out-Null');
    });

    it('should display success message if Docker already installed', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('✅ Docker is installed');
    });
  });

  describe('fnm (Fast Node Manager) Installation', () => {
    it('should check if fnm is already installed', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('Get-Command "fnm"');
    });

    it('should install fnm using winget', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('winget install Schniz.fnm');
    });

    it('should refresh PATH after fnm installation', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      const fnmSection = content.substring(content.indexOf('Install FNM'));
      expect(fnmSection).toContain('$env:Path =');
    });

    it('should initialize fnm for current session', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('fnm env --use-on-cd');
      expect(content).toContain('Invoke-Expression');
    });

    it('should display success message if fnm already installed', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('✅ fnm is already installed');
    });
  });

  describe('Version Parsing from package.json', () => {
    it('should check for package.json existence', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('Test-Path "package.json"');
    });

    it('should exit if package.json not found', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('Error: package.json not found');
    });

    it('should use native PowerShell JSON parsing', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('Get-Content "package.json" -Raw');
      expect(content).toContain('ConvertFrom-Json');
    });

    it('should parse Node version from engines.node', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('$pkg.engines.node');
      expect(content).toContain('$nodeEngine');
    });

    it('should extract numeric version from Node engine string', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain("if ($nodeEngine -match '(\\d+)')");
      expect(content).toContain('$matches[1]');
    });

    it('should default to "lts" if Node version not parsed', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('"lts"');
    });

    it('should parse pnpm version from packageManager field', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('$pkg.packageManager');
      expect(content).toContain('$pnpmString');
    });

    it('should extract version from pnpm@ prefix', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain("$pnpmString -match 'pnpm@(.*)'");
      expect(content).toContain('$matches[1]');
    });

    it('should default to "latest" for pnpm if not specified', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('$pnpmVer = "latest"');
    });

    it('should display target versions', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('Target Node Version:');
      expect(content).toContain('Target pnpm Version:');
    });
  });

  describe('Node.js and pnpm Installation', () => {
    it('should install Node.js using fnm', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('fnm install $cleanNodeVer');
    });

    it('should activate installed Node version', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('fnm use $cleanNodeVer');
    });

    it('should install pnpm globally with specific version', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('npm install -g "pnpm@$pnpmVer"');
    });
  });

  describe('Project Setup', () => {
    it('should install project dependencies', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('pnpm install');
    });

    it('should run setup script using tsx', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('pnpm exec tsx src/install/setup.ts');
    });

    it('should use pnpm exec for local tsx', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain("# Use 'pnpm exec' to ensure we use the local tsx");
    });
  });

  describe('User Feedback and Messages', () => {
    it('should display banner with colors', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('Talawa-API Automated Installer (Windows)');
      expect(content).toContain('-ForegroundColor Cyan');
    });

    it('should use color coding for different message types', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('-ForegroundColor Yellow');
      expect(content).toContain('-ForegroundColor Green');
      expect(content).toContain('-ForegroundColor Cyan');
    });

    it('should use Write-Warning for important notices', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('Write-Warning');
    });

    it('should display completion message', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('Installation Complete!');
    });

    it('should show progress for each major step', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('Installing Git');
      expect(content).toContain('Installing Docker Desktop');
      expect(content).toContain('Installing fnm');
      expect(content).toContain('Installing Node.js');
      expect(content).toContain('Installing pnpm');
      expect(content).toContain('Installing project dependencies');
      expect(content).toContain('Running Setup Script');
    });
  });

  describe('Script Sections and Comments', () => {
    it('should have numbered sections with dividers', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('# ----------------------------------------------------------------');
      expect(content).toContain('# 1. Check & Install System Dependencies');
      expect(content).toContain('# 2. Install FNM');
      expect(content).toContain('# 3. Read Versions from package.json');
      expect(content).toContain('# 4. Install Node & pnpm');
      expect(content).toContain('# 5. Project Setup');
    });

    it('should follow logical execution order', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      const depsIndex = content.indexOf('# 1. Check & Install System Dependencies');
      const fnmIndex = content.indexOf('# 2. Install FNM');
      const versionsIndex = content.indexOf('# 3. Read Versions');
      const installIndex = content.indexOf('# 4. Install Node & pnpm');
      const setupIndex = content.indexOf('# 5. Project Setup');

      expect(depsIndex).toBeLessThan(fnmIndex);
      expect(fnmIndex).toBeLessThan(versionsIndex);
      expect(versionsIndex).toBeLessThan(installIndex);
      expect(installIndex).toBeLessThan(setupIndex);
    });

    it('should have inline comments explaining key steps', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('# Refresh Path');
      expect(content).toContain('# Check one more time');
      expect(content).toContain('# Initialize fnm for this session');
    });
  });

  describe('Error Handling', () => {
    it('should use try-catch for Docker status check', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('try {');
      expect(content).toContain('} catch {');
      expect(content).toContain('$LASTEXITCODE -ne 0');
    });

    it('should use Write-Error for error messages', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('Write-Error');
    });

    it('should check command availability with SilentlyContinue', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('-ErrorAction SilentlyContinue');
    });

    it('should use $LASTEXITCODE for command success verification', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('$LASTEXITCODE');
    });
  });

  describe('PowerShell Best Practices', () => {
    it('should use approved PowerShell verbs', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('Get-Command');
      expect(content).toContain('Get-Content');
      expect(content).toContain('Test-Path');
      expect(content).toContain('Write-Host');
      expect(content).toContain('Write-Warning');
      expect(content).toContain('Write-Error');
    });

    it('should use Out-String for piping', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('Out-String');
    });

    it('should use Out-Null to suppress output', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('Out-Null');
    });

    it('should use Read-Host for user input', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('Read-Host');
    });

    it('should use PowerShell variables correctly', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('$ErrorActionPreference');
      expect(content).toContain('$env:Path');
      expect(content).toContain('$pkg');
      expect(content).toContain('$cleanNodeVer');
      expect(content).toContain('$pnpmVer');
    });
  });

  describe('Security Considerations', () => {
    it('should use HTTPS for all downloads', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      const httpMatches = content.match(/http:\/\//g);
      expect(httpMatches).toBeNull();
    });

    it('should use official winget source', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('--source winget');
    });

    it('should not contain hardcoded credentials', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content.toLowerCase()).not.toMatch(/password\s*=\s*['"]/);
      expect(content.toLowerCase()).not.toMatch(/api[_-]?key\s*=\s*['"]/);
      expect(content.toLowerCase()).not.toMatch(/secret\s*=\s*['"]/);
    });

    it('should set ErrorActionPreference early', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      const lines = content.split('\n');
      const errorActionLine = lines.findIndex(line =>
        line.includes('$ErrorActionPreference = "Stop"')
      );
      const firstCommandLine = lines.findIndex(line =>
        line.includes('Write-Host') || line.includes('Get-Command')
      );
      expect(errorActionLine).toBeGreaterThan(-1);
      expect(errorActionLine).toBeLessThan(firstCommandLine);
    });
  });

  describe('Idempotency', () => {
    it('should check if tools are already installed', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('if (-not (Get-Command "git"');
      expect(content).toContain('if (-not (Get-Command "docker"');
      expect(content).toContain('if (-not (Get-Command "fnm"');
    });

    it('should display messages for already installed tools', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('✅ Git is already installed');
      expect(content).toContain('✅ Docker is installed');
      expect(content).toContain('✅ fnm is already installed');
    });

    it('should use checkmarks for success messages', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      const checkmarks = content.match(/✅/g);
      expect(checkmarks).not.toBeNull();
      expect(checkmarks?.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Windows-Specific Features', () => {
    it('should handle both Machine and User PATH variables', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('GetEnvironmentVariable("Path","Machine")');
      expect(content).toContain('GetEnvironmentVariable("Path","User")');
    });

    it('should mention Start Menu for Docker Desktop', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('Start Menu');
    });

    it('should reference taskbar for Docker status', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('taskbar');
    });

    it('should handle Windows-style output redirection', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      expect(content).toContain('2>&1');
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
  });

  describe('Comparison with Bash Script', () => {
    const BASH_SCRIPT = path.join(process.cwd(), 'install.sh');

    it('both scripts should exist', () => {
      expect(fs.existsSync(BASH_SCRIPT)).toBe(true);
      expect(fs.existsSync(INSTALL_SCRIPT)).toBe(true);
    });

    it('should have equivalent functionality to bash script', () => {
      const psContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      const bashContent = fs.readFileSync(BASH_SCRIPT, 'utf-8');

      // Both should install same dependencies
      expect(psContent).toContain('Git');
      expect(bashContent).toContain('git');

      expect(psContent).toContain('Docker');
      expect(bashContent).toContain('docker');

      expect(psContent).toContain('fnm');
      expect(bashContent).toContain('fnm');
    });

    it('should call same setup script', () => {
      const psContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      const bashContent = fs.readFileSync(BASH_SCRIPT, 'utf-8');

      expect(psContent).toContain('src/install/setup.ts');
      expect(bashContent).toContain('src/install/setup.ts');
    });

    it('PowerShell script should have more robust Docker checking', () => {
      const psContent = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');

      // PS1 checks daemon status explicitly
      expect(psContent).toContain('docker info');
      expect(psContent).toContain('Docker daemon not responding');
      expect(psContent).toContain('# Check one more time');
    });
  });
});