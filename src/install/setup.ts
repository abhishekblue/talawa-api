import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import inquirer from 'inquirer';

// 1. Path Definitions
const ROOT_DIR = process.cwd();
const ENV_DEV_SOURCE = path.join(ROOT_DIR, 'envFiles', '.env.devcontainer');
const ENV_CI_SOURCE = path.join(ROOT_DIR, 'envFiles', '.env.ci');
const ENV_DEST = path.join(ROOT_DIR, '.env');
// Crucial: Correct path based on your screenshot
const DOCKER_COMPOSE_FILE = path.join(ROOT_DIR, 'docker', 'compose.devcontainer.yaml');

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
  console.log('\n🚀 Talawa API Setup Wizard\n');

  // Auto-select CI mode if running in CI environment
  let mode = process.env.CI ? 'ci' : null;

  if (!mode) {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'mode',
        message: 'Select your setup mode:',
        choices: [
          { name: 'Docker (DevContainer - Full containerized setup)', value: 'docker' },
          { name: 'Local (API on host, databases in Docker)', value: 'local' },
          { name: 'CI/Testing Pipeline', value: 'ci' },
        ],
      },
    ]);
    mode = answers.mode;
  } else {
    console.log('✅ CI environment detected - using CI/Testing mode');
  }

  const isDocker = mode === 'docker';
  const isLocal = mode === 'local';

  console.log('\n📄 Configuring Environment Variables...');

  if (isDocker) {
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
    return;
  }

  if (isLocal) {
    if (!fs.existsSync(ENV_DEV_SOURCE)) {
      console.error(`❌ Error: Source file not found at ${ENV_DEV_SOURCE}`);
      process.exit(1);
    }

    let envContent = fs.readFileSync(ENV_DEV_SOURCE, 'utf-8');

    console.log('🔄 Adjusting .env for local machine access...');

    envContent = envContent
      .replace(/=postgres-test$/gm, '=localhost')
      .replace(/=postgres$/gm, '=localhost')
      .replace(/=minio-test$/gm, '=localhost')
      .replace(/=minio$/gm, '=localhost')
      .replace(/=redis-test$/gm, '=localhost')
      .replace(/=redis$/gm, '=localhost')
      .replace(/=mongo$/gm, '=localhost');

    fs.writeFileSync(ENV_DEST, envContent);
    console.log('✅ .env created: Services pointed to localhost');

    console.log('\n🐳 Starting Docker Containers...');

    if (!fs.existsSync(DOCKER_COMPOSE_FILE)) {
        console.error(`❌ Error: Docker file not found at ${DOCKER_COMPOSE_FILE}`);
        process.exit(1);
    }

    const services = 'postgres minio redis postgres-test minio-test redis-test';

    console.log("> Using file: docker/compose.devcontainer.yaml");
    console.log(`> Starting services: ${services}`);

    runCommand(`docker compose -f ${DOCKER_COMPOSE_FILE} up -d ${services}`);

    console.log('⏳ Waiting 10s for containers to initialize...');
    runCommand('sleep 10');

  } else {
    const source = fs.existsSync(ENV_CI_SOURCE) ? ENV_CI_SOURCE : ENV_DEV_SOURCE;
    fs.copyFileSync(source, ENV_DEST);
    console.log('✅ .env configured for CI');
  }

  // 4. Sample Data
  if (isLocal && !process.env.CI) {
    const dataAnswer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'addSampleData',
        message: 'Do you want to seed the database with sample data?',
        default: true,
      },
    ]);

    if (dataAnswer.addSampleData) {
      console.log('\n🌱 Seeding Sample Data...');
      runCommand('pnpm run add:sample_data');
    }
  }

  console.log('\n✅ Setup Complete!');
  console.log('------------------------------------------------');
  console.log('To start the server, run:');
  console.log('   pnpm run start_development_server');
  console.log('------------------------------------------------');
}

main();