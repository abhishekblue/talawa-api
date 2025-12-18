import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

// Path Definitions
const ROOT_DIR = process.cwd();
const ENV_DEV_SOURCE = path.join(ROOT_DIR, 'envFiles', '.env.devcontainer');
const ENV_CI_SOURCE = path.join(ROOT_DIR, 'envFiles', '.env.ci');
const ENV_DEST = path.join(ROOT_DIR, '.env');

// Helper to check if we need sudo for docker
const needsSudoForDocker = (): boolean => {
  try {
    execSync('docker ps', { stdio: 'ignore' });
    return false; // Docker works without sudo
  } catch {
    return true; // Need sudo for docker
  }
};

// Helper for shell commands
const runCommand = (command: string) => {
  try {
    // Auto-prefix docker commands with sudo if needed
    let finalCommand = command;
    if (command.includes('docker') && needsSudoForDocker()) {
      finalCommand = `sudo ${command}`;
      console.log('ℹ️  Using sudo for Docker commands (run without sudo after logging out/in)');
    }
    execSync(finalCommand, { stdio: 'inherit', cwd: ROOT_DIR });
  } catch (error) {
    console.error(`❌ Command failed: ${command}`);
    process.exit(1);
  }
};

async function main() {
  console.log('\n🚀 Talawa API DevContainer Setup\n');

  // Check if running in CI environment
  const isCI = process.env.CI;

  if (isCI) {
    console.log('✅ CI environment detected - using CI/Testing mode');
    const source = fs.existsSync(ENV_CI_SOURCE) ? ENV_CI_SOURCE : ENV_DEV_SOURCE;
    fs.copyFileSync(source, ENV_DEST);
    console.log('✅ .env configured for CI');
    return;
  }

  console.log('📄 Configuring Environment Variables...');

  if (!fs.existsSync(ENV_DEV_SOURCE)) {
    console.error(`❌ Error: Source file not found at ${ENV_DEV_SOURCE}`);
    process.exit(1);
  }

  fs.copyFileSync(ENV_DEV_SOURCE, ENV_DEST);
  console.log('✅ .env created for DevContainer setup');

  console.log('\n📦 Installing DevContainer CLI...');
  runCommand('pnpm install -g @devcontainers/cli');

  console.log('\n🐳 Building DevContainer...');
  runCommand('devcontainer build --workspace-folder .');

  console.log('\n🚀 Starting DevContainer...');
  runCommand('devcontainer up --workspace-folder .');

  console.log('\n🚀 Starting API Server...');
  runCommand('docker exec talawa-api-1 /bin/bash -c "nohup pnpm run start_development_server > /dev/null 2>&1 &"');

  console.log('\n⏳ Waiting for server to start...');
  runCommand('sleep 5');

  console.log('\n✅ DevContainer Setup Complete!');
  console.log('------------------------------------------------');
  console.log('✓ API Server is running at: http://localhost:4000');
  console.log('✓ GraphQL Playground: http://localhost:4000/graphql');
  console.log('');
  console.log('Useful Commands:');
  console.log('  View logs:    docker logs -f talawa-api-1');
  console.log('  Stop server:  docker exec talawa-api-1 pkill -f "pnpm run start_development_server"');
  console.log('  Restart:      docker restart talawa-api-1');
  console.log('------------------------------------------------');
}

main();
