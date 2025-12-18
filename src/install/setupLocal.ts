import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import inquirer from 'inquirer';

// Path Definitions
const ROOT_DIR = process.cwd();
const ENV_DEV_SOURCE = path.join(ROOT_DIR, 'envFiles', '.env.devcontainer');
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
    .replace(/=mongo$/gm, '=localhost')
    // Set COMPOSE_PROFILES to only start database services (exclude api)
    .replace(/^COMPOSE_PROFILES=.*/gm, 'COMPOSE_PROFILES=minio,minio_test,postgres,postgres_test,redis_test,redis');

  fs.writeFileSync(ENV_DEST, envContent);
  console.log('✅ .env created: Services pointed to localhost');

  console.log('\n⚙️  Running database setup...');
  runCommand('pnpm tsx setup.ts');

  console.log('\n📦 Installing DevContainer CLI...');
  runCommand('pnpm install -g @devcontainers/cli');

  // Add user to docker group if needed (Linux only)
  if (process.platform === 'linux' && needsSudoForDocker()) {
    console.log('\n🔧 Adding user to docker group...');
    const username = process.env.USER || process.env.USERNAME || 'ubuntu';
    runCommand(`sudo usermod -a -G docker ${username}`);
    console.log('ℹ️  You may need to log out and back in for docker group changes to take effect');
  }

  console.log('\n🐳 Starting Database Containers...');
  runCommand('devcontainer up --workspace-folder .');

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
