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
const runCommand = (command: string, throwOnError = true) => {
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
    if (throwOnError) {
      process.exit(1);
    } else {
      throw error;
    }
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
    // Database Host Replacements (Exact matches from your .env file)
    .replace('API_MINIO_END_POINT=minio', 'API_MINIO_END_POINT=localhost')
    .replace('API_MINIO_TEST_END_POINT=minio-test', 'API_MINIO_TEST_END_POINT=localhost')
    .replace('API_POSTGRES_HOST=postgres', 'API_POSTGRES_HOST=localhost')
    .replace('API_POSTGRES_TEST_HOST=postgres-test', 'API_POSTGRES_TEST_HOST=localhost')
    .replace('API_REDIS_HOST=redis', 'API_REDIS_HOST=localhost')
    .replace('API_REDIS_TEST_HOST=redis-test', 'API_REDIS_TEST_HOST=localhost')

    // Profile Replacement: Only start databases, exclude API/Caddy
    .replace(
      'COMPOSE_PROFILES=api,caddy,cloudbeaver,minio,minio_test,postgres,postgres_test,redis_test,redis', 
      'COMPOSE_PROFILES=minio,minio_test,postgres,postgres_test,redis_test,redis'
    );

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
  runCommand('devcontainer up --workspace-folder . --skip-post-create');

  console.log('\n⏳ Waiting for database services to be healthy...');
  // Wait for postgres to be ready (max 20 seconds)
  let retries = 10;
  while (retries > 0) {
    try {
      execSync('docker exec talawa-postgres-1 pg_isready -U postgres', { stdio: 'ignore' });
      console.log('✅ Database services are ready');
      break;
    } catch {
      retries--;
      if (retries === 0) {
        console.log('⚠️  Database may not be fully ready, continuing anyway...');
      } else {
        execSync('sleep 2', { stdio: 'ignore' });
      }
    }
  }

  console.log('\n📊 Applying database migrations...');
  runCommand('pnpm run apply_drizzle_migrations');

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
    try {
      runCommand('pnpm run add:sample_data', false);
      console.log('✅ Sample data seeded successfully');
    } catch (error) {
      console.log('⚠️  Sample data seeding failed, but you can run it manually later:');
      console.log('   pnpm run add:sample_data');
    }
  }
const startAnswer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'startServer',
      message: 'Do you want to start the development server now?',
      default: true,
    },
  ]);

  if (startAnswer.startServer) {
    console.log('\n🚀 Starting Development Server...');
    try {
      // stdio: 'inherit' lets the user see logs and interact (Ctrl+C to stop)
      execSync('pnpm run start_development_server', { stdio: 'inherit' });
    } catch (error) {
      // Catch allows the script to finish gracefully if user stops server with Ctrl+C
      console.log('\nServer stopped.');
    }
  }
}

main();
