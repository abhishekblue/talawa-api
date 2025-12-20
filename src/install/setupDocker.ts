import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT_DIR = process.cwd();
const ENV_DEV_SOURCE = path.join(ROOT_DIR, 'envFiles', '.env.devcontainer');
const ENV_CI_SOURCE = path.join(ROOT_DIR, 'envFiles', '.env.ci');
const ENV_DEST = path.join(ROOT_DIR, '.env');

const needsSudoForDocker = (): boolean => {
  try {
    execSync('docker ps', { stdio: 'ignore' });
    return false;
  } catch {
    return true;
  }
};

// const runCommand = (command: string) => {
//   try {
//     let finalCommand = command;
//     if (command.includes('docker') && needsSudoForDocker()) {
//       finalCommand = `sudo ${command}`;
//       console.log('ℹ️  Using sudo for Docker commands (run without sudo after logging out/in)');
//     }
//     execSync(finalCommand, { stdio: 'inherit', cwd: ROOT_DIR });
//   } catch (error) {
//     console.error(`❌ Command failed: ${command}`);
//     process.exit(1);
//   }
// };

async function main() {
  console.log('\n🚀 Talawa API DevContainer Setup\n');

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
  execSync('pnpm install -g @devcontainers/cli');

  if (process.platform === 'linux' && needsSudoForDocker()) {
    console.log('\n🔧 Adding user to docker group...');

    execSync('sudo usermod -a -G docker $USER}');
    console.log('==========sud command check 1===========')
    execSync ('sudo su $USER -')
    console.log('==========sud command check pass===========')

  }

  console.log('\n🐳 Building DevContainer...');
  execSync('devcontainer build --workspace-folder .');

  console.log('\n🚀 Starting DevContainer...');
  execSync('devcontainer up --workspace-folder .');

  console.log('\n🚀 Starting API Server...');
  execSync('docker exec talawa-api-1 /bin/bash -c "nohup pnpm run start_development_server > /dev/null 2>&1 &"');

  console.log('\n⏳ Waiting for server to start...');
  await new Promise(resolve => setTimeout(resolve, 5000));

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
