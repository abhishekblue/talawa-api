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

// Helper for shell commands (WSL-specific with sudo -E to preserve PATH)
const runCommand = (command: string, throwOnError = true) => {
  try {
    // Auto-prefix docker/devcontainer commands with sudo if needed
    let finalCommand = command;
    if ((command.includes('docker') || command.includes('devcontainer')) && needsSudoForDocker()) {
      // Use sudo -E to preserve environment (especially PATH for pnpm/devcontainer)
      finalCommand = `sudo -E ${command}`;
      console.log('ℹ️  Using sudo for Docker commands (run without sudo after logging out/in)');
    }
    execSync(finalCommand, { stdio: 'inherit', cwd: ROOT_DIR, env: process.env });
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
  console.log('\n🚀 Talawa API Local Setup (Windows WSL)\n');

  console.log('📄 Configuring Environment Variables...');

  if (!fs.existsSync(ENV_DEV_SOURCE)) {
    console.error(`❌ Error: Source file not found at ${ENV_DEV_SOURCE}`);
    process.exit(1);
  }

  console.log('\n⚙️  Running database setup (generating JWT secret, configuring services)...');
  // Let setup.ts run normally and ask all questions
  runCommand('pnpm tsx setup.ts');

  console.log('\n🔄 Adjusting .env for local machine access...');
  // NOW read the .env file that setup.ts just created
  let envContent = fs.readFileSync(ENV_DEST, 'utf-8');

  // Split file into lines
  const lines = envContent.split(/\r?\n/);

  // DEFINE KEYS TO OVERRIDE - these must point to localhost for local setup
  const keysToReset = [
    'API_POSTGRES_HOST',
    'API_POSTGRES_TEST_HOST',
    'API_REDIS_HOST',
    'API_REDIS_TEST_HOST',
    'API_MINIO_END_POINT',
    'API_MINIO_TEST_END_POINT'
  ];

  // DELETE OLD KEYS (Filter them out completely)
  const cleanLines = lines.filter(line => {
    // Get the key part (before the =)
    const key = (line.split('=')[0] ?? '').trim();
    // If this line is one of our keys, TRASH IT.
    return !keysToReset.includes(key);
  });

  // APPEND NEW CORRECT VALUES (localhost instead of container names)
  cleanLines.push('API_POSTGRES_HOST=localhost');
  cleanLines.push('API_POSTGRES_TEST_HOST=localhost');
  cleanLines.push('API_REDIS_HOST=localhost');
  cleanLines.push('API_REDIS_TEST_HOST=localhost');
  cleanLines.push('API_MINIO_END_POINT=localhost');
  cleanLines.push('API_MINIO_TEST_END_POINT=localhost');

  // Rejoin the file
  envContent = cleanLines.join('\n');

  // Fix Docker Profiles to exclude API service (runs on host, not in Docker)
  envContent = envContent.replace(
    /^COMPOSE_PROFILES=.*/gm,
    'COMPOSE_PROFILES=minio,minio_test,postgres,postgres_test,redis_test,redis'
  );

  // Write the modified .env file
  fs.writeFileSync(ENV_DEST, envContent);
  console.log('✅ .env updated: Database services point to localhost');

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
        // Cross-platform sleep - works on Windows, macOS, and Linux
        await new Promise(resolve => setTimeout(resolve, 2000));
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
    // We use stdio: 'inherit' so the user interacts with the server directly
    try {
        // This works because the script context ALREADY has the correct PATH
        execSync('pnpm run start_development_server', { stdio: 'inherit' });
    } catch (e) {
        // This catch block handles when the user presses Ctrl+C to stop the server
        console.log('\nServer stopped.');
    }
  } else {
      console.log('⚠️  Restart your terminal to use pnpm manually.');
  }
}

main();
