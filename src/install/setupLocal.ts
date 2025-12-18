import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import inquirer from 'inquirer';

// Path Definitions
const ROOT_DIR = process.cwd();
const ENV_DEV_SOURCE = path.join(ROOT_DIR, 'envFiles', '.env.devcontainer');
const ENV_DEST = path.join(ROOT_DIR, '.env');
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
  console.log('\n🚀 Talawa API Local Setup\n');

  console.log('📄 Configuring Environment Variables...');

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

  console.log('> Using file: docker/compose.devcontainer.yaml');
  console.log(`> Starting services: ${services}`);

  runCommand(`docker compose -f ${DOCKER_COMPOSE_FILE} up -d ${services}`);

  console.log('⏳ Waiting 10s for containers to initialize...');
  runCommand('sleep 10');

  // Sample Data
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

  console.log('\n✅ Setup Complete!');
  console.log('------------------------------------------------');
  console.log('To start the server, run:');
  console.log('   pnpm run start_development_server');
  console.log('------------------------------------------------');
}

main();