/**
 * Test helpers for installation script tests
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Check if a command exists on the system
 */
export function commandExists(command: string): boolean {
  try {
    if (process.platform === 'win32') {
      execSync(`where ${command}`, { stdio: 'ignore' });
    } else {
      execSync(`which ${command}`, { stdio: 'ignore' });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the version of a command
 */
export function getCommandVersion(command: string, versionFlag = '--version'): string | null {
  try {
    const output = execSync(`${command} ${versionFlag}`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    return output.trim();
  } catch {
    return null;
  }
}

/**
 * Check if Docker daemon is running
 */
export function isDockerRunning(): boolean {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse version number from a string
 * Examples: "18.x" -> "18", ">=20.0.0" -> "20", "pnpm@8.1.0" -> "8.1.0"
 */
export function parseVersionNumber(versionString: string): string | null {
  // Try to extract pnpm version first (pnpm@8.1.0 format)
  const pnpmMatch = versionString.match(/pnpm@([\d.]+)/);
  if (pnpmMatch) {
    return pnpmMatch[1];
  }

  // Try to extract first number
  const numberMatch = versionString.match(/(\d+)/);
  if (numberMatch) {
    return numberMatch[1];
  }

  return null;
}

/**
 * Validate environment variable transformations
 */
export function validateEnvTransformation(
  originalContent: string,
  transformedContent: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check if postgres was replaced
  if (originalContent.includes('=postgres') && transformedContent.includes('=postgres')) {
    errors.push('postgres hostname was not replaced with localhost');
  }

  // Check if minio was replaced
  if (originalContent.includes('=minio') && transformedContent.includes('=minio')) {
    errors.push('minio hostname was not replaced with localhost');
  }

  // Check if redis was replaced
  if (originalContent.includes('=redis') && transformedContent.includes('=redis')) {
    errors.push('redis hostname was not replaced with localhost');
  }

  // Check if mongo was replaced
  if (originalContent.includes('=mongo') && transformedContent.includes('=mongo')) {
    errors.push('mongo hostname was not replaced with localhost');
  }

  // Verify localhost is present
  if (!transformedContent.includes('=localhost')) {
    errors.push('transformed content does not contain localhost');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create a mock environment file for testing
 */
export function createMockEnvFile(includeTestServices = true): string {
  let content = `
# Database Configuration
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=talawa
POSTGRES_PASSWORD=talawa
POSTGRES_DB=talawa_db

# MinIO Configuration
MINIO_HOST=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379

# MongoDB Configuration
MONGO_HOST=mongo
MONGO_PORT=27017
`;

  if (includeTestServices) {
    content += `
# Test Database Configuration
POSTGRES_HOST_TEST=postgres-test
POSTGRES_PORT_TEST=5433

# Test MinIO Configuration
MINIO_HOST_TEST=minio-test
MINIO_PORT_TEST=9001

# Test Redis Configuration
REDIS_HOST_TEST=redis-test
REDIS_PORT_TEST=6380
`;
  }

  return content;
}

/**
 * Transform environment file for local development
 * Mimics the transformation done in setup.ts
 */
export function transformEnvForLocal(content: string): string {
  return content
    .replace(/=postgres-test/g, '=localhost')
    .replace(/=postgres/g, '=localhost')
    .replace(/=minio-test/g, '=localhost')
    .replace(/=minio/g, '=localhost')
    .replace(/=redis-test/g, '=localhost')
    .replace(/=redis/g, '=localhost')
    .replace(/=mongo/g, '=localhost');
}

/**
 * Check if a file is executable (Unix-like systems only)
 */
export function isExecutable(filePath: string): boolean {
  if (process.platform === 'win32') {
    // Windows doesn't have the same execute bit concept
    return true;
  }

  try {
    const stats = fs.statSync(filePath);
    return (stats.mode & 0o111) !== 0;
  } catch {
    return false;
  }
}

/**
 * Read package.json and extract version information
 */
export function readPackageVersions(packageJsonPath: string): {
  nodeVersion: string | null;
  pnpmVersion: string | null;
} {
  try {
    const content = fs.readFileSync(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content);

    const nodeVersion = pkg.engines?.node || null;
    const pnpmVersion = pkg.packageManager?.replace('pnpm@', '') || null;

    return { nodeVersion, pnpmVersion };
  } catch {
    return { nodeVersion: null, pnpmVersion: null };
  }
}

/**
 * Validate script structure and common patterns
 */
export function validateScriptStructure(scriptPath: string, expectedSections: string[]): {
  valid: boolean;
  missingSections: string[];
} {
  const content = fs.readFileSync(scriptPath, 'utf-8');
  const missingSections: string[] = [];

  for (const section of expectedSections) {
    if (!content.includes(section)) {
      missingSections.push(section);
    }
  }

  return {
    valid: missingSections.length === 0,
    missingSections,
  };
}

/**
 * Check if a URL uses HTTPS
 */
export function validateHttpsUrls(content: string): {
  valid: boolean;
  insecureUrls: string[];
} {
  const urlPattern = /http:\/\/[^\s"')]+/g;
  const insecureUrls = content.match(urlPattern) || [];

  // Filter out localhost URLs as they're okay to be HTTP
  const filteredUrls = insecureUrls.filter(
    (url) => !url.includes('localhost') && !url.includes('127.0.0.1')
  );

  return {
    valid: filteredUrls.length === 0,
    insecureUrls: filteredUrls,
  };
}

/**
 * Mock inquirer responses for testing
 */
export function createMockInquirerResponses(mode: 'local' | 'ci', addSampleData = false) {
  return [
    { mode },
    ...(mode === 'local' ? [{ addSampleData }] : []),
  ];
}

/**
 * Verify Docker Compose command structure
 */
export function validateDockerComposeCommand(command: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!command.includes('docker compose')) {
    errors.push('Command does not use docker compose');
  }

  if (!command.includes('-f')) {
    errors.push('Command does not specify compose file with -f flag');
  }

  if (!command.includes('up -d')) {
    errors.push('Command does not run containers in detached mode');
  }

  const expectedServices = ['postgres', 'minio', 'redis', 'postgres-test', 'minio-test', 'redis-test'];
  const missingServices = expectedServices.filter(service => !command.includes(service));

  if (missingServices.length > 0) {
    errors.push(`Command missing services: ${missingServices.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check for common security issues in scripts
 */
export function checkSecurityIssues(content: string): {
  secure: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check for hardcoded credentials
  const credentialPatterns = [
    /password\s*=\s*['"][^'"]+['"]/i,
    /api[_-]?key\s*=\s*['"][^'"]+['"]/i,
    /secret\s*=\s*['"][^'"]+['"]/i,
    /token\s*=\s*['"][^'"]+['"]/i,
  ];

  for (const pattern of credentialPatterns) {
    if (pattern.test(content)) {
      issues.push(`Potential hardcoded credential found matching pattern: ${pattern.source}`);
    }
  }

  // Check for HTTP URLs (except localhost)
  const httpCheck = validateHttpsUrls(content);
  if (!httpCheck.valid) {
    issues.push(`Insecure HTTP URLs found: ${httpCheck.insecureUrls.join(', ')}`);
  }

  // Check for unsafe shell practices (if bash script)
  if (content.includes('#!/bin/bash')) {
    if (!content.includes('set -e')) {
      issues.push('Bash script does not use "set -e" for error handling');
    }
  }

  // Check for unsafe PowerShell practices
  if (content.includes('.SYNOPSIS')) {
    if (!content.includes('$ErrorActionPreference')) {
      issues.push('PowerShell script does not set $ErrorActionPreference');
    }
  }

  return {
    secure: issues.length === 0,
    issues,
  };
}

/**
 * Compare feature parity between scripts
 */
export function compareScriptFeatures(bashPath: string, ps1Path: string): {
  parity: boolean;
  bashOnly: string[];
  ps1Only: string[];
  common: string[];
} {
  const bashContent = fs.readFileSync(bashPath, 'utf-8');
  const ps1Content = fs.readFileSync(ps1Path, 'utf-8');

  const features = [
    'git',
    'docker',
    'fnm',
    'pnpm',
    'package.json',
    'setup.ts',
    'Node',
  ];

  const bashFeatures = features.filter(f => bashContent.toLowerCase().includes(f.toLowerCase()));
  const ps1Features = features.filter(f => ps1Content.toLowerCase().includes(f.toLowerCase()));

  const common = bashFeatures.filter(f => ps1Features.includes(f));
  const bashOnly = bashFeatures.filter(f => !ps1Features.includes(f));
  const ps1Only = ps1Features.filter(f => !bashFeatures.includes(f));

  return {
    parity: bashOnly.length === 0 && ps1Only.length === 0,
    bashOnly,
    ps1Only,
    common,
  };
}