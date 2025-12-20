import fs from 'node:fs';
import { execSync } from 'node:child_process';
import inquirer from 'inquirer';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('node:fs');
vi.mock('node:child_process');
vi.mock('inquirer');

const ROOT_DIR = process.cwd();
const ENV_DEV_SOURCE = `${ROOT_DIR}/envFiles/.env.devcontainer`;
const ENV_DEST = `${ROOT_DIR}/.env`;

describe('setupLocal', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('needsSudoForDocker', () => {
    it('should return false when docker works without sudo', async () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from(''));

      const { needsSudoForDocker } = await import('./setupLocal.js');

      expect(needsSudoForDocker()).toBe(false);
      expect(execSync).toHaveBeenCalledWith('docker ps', { stdio: 'ignore' });
    });

    it('should return true when docker requires sudo', async () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const { needsSudoForDocker } = await import('./setupLocal.js');

      expect(needsSudoForDocker()).toBe(true);
    });
  });

  describe('runCommand', () => {
    it('should execute command successfully', async () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from(''));

      const { runCommand } = await import('./setupLocal.js');

      runCommand('pnpm install');

      expect(execSync).toHaveBeenCalledWith(
        'pnpm install',
        expect.objectContaining({ stdio: 'inherit', cwd: ROOT_DIR })
      );
    });

    it('should prefix docker commands with sudo when needed', async () => {
      vi.mocked(execSync)
        .mockImplementationOnce(() => {
          throw new Error('Permission denied');
        })
        .mockReturnValueOnce(Buffer.from(''));

      const { runCommand } = await import('./setupLocal.js');

      runCommand('docker ps');

      expect(execSync).toHaveBeenCalledWith(
        'sudo docker ps',
        expect.objectContaining({ stdio: 'inherit' })
      );
    });

    it('should exit process on error when throwOnError is true', async () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Command failed');
      });

      const { runCommand } = await import('./setupLocal.js');

      expect(() => runCommand('invalid-command')).toThrow('process.exit called');
      expect(console.error).toHaveBeenCalledWith('❌ Command failed: invalid-command');
    });

    it('should throw error when throwOnError is false', async () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Command failed');
      });

      const { runCommand } = await import('./setupLocal.js');

      expect(() => runCommand('invalid-command', false)).toThrow('Command failed');
    });
  });

  describe('main function', () => {
    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(`
API_POSTGRES_HOST=postgres
API_POSTGRES_TEST_HOST=postgres_test
API_REDIS_HOST=redis
API_REDIS_TEST_HOST=redis_test
API_MINIO_END_POINT=minio
API_MINIO_TEST_END_POINT=minio_test
COMPOSE_PROFILES=api,minio,postgres,redis
`);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(execSync).mockReturnValue(Buffer.from(''));
      vi.mocked(inquirer.prompt)
        .mockResolvedValueOnce({ addSampleData: false })
        .mockResolvedValueOnce({ startServer: false });
    });

    it('should exit if source env file does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const setupLocal = await import('./setupLocal.js');

      expect(() => setupLocal.main()).toThrow('process.exit called');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error: Source file not found')
      );
    });

    it('should run setup.ts before modifying env file', async () => {
      const setupLocal = await import('./setupLocal.js');
      await setupLocal.main();

      const setupCall = vi.mocked(execSync).mock.calls.find(
        call => call[0] === 'pnpm tsx setup.ts'
      );

      expect(setupCall).toBeDefined();
    });

    it('should override database host keys to localhost', async () => {
      const setupLocal = await import('./setupLocal.js');
      await setupLocal.main();

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      expect(writeCall).toBeDefined();

      const content = writeCall[1] as string;
      expect(content).toContain('API_POSTGRES_HOST=localhost');
      expect(content).toContain('API_POSTGRES_TEST_HOST=localhost');
      expect(content).toContain('API_REDIS_HOST=localhost');
      expect(content).toContain('API_REDIS_TEST_HOST=localhost');
      expect(content).toContain('API_MINIO_END_POINT=localhost');
      expect(content).toContain('API_MINIO_TEST_END_POINT=localhost');
    });

    it('should update COMPOSE_PROFILES to exclude api service', async () => {
      const setupLocal = await import('./setupLocal.js');
      await setupLocal.main();

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const content = writeCall[1] as string;

      expect(content).toContain('COMPOSE_PROFILES=minio,minio_test,postgres,postgres_test,redis_test,redis');
      expect(content).not.toContain('COMPOSE_PROFILES=api');
    });

    it('should install devcontainer CLI', async () => {
      const setupLocal = await import('./setupLocal.js');
      await setupLocal.main();

      const installCall = vi.mocked(execSync).mock.calls.find(
        call => call[0] === 'pnpm install -g @devcontainers/cli'
      );

      expect(installCall).toBeDefined();
    });

    it('should add user to docker group on Linux when sudo is needed', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });
      process.env.USER = 'testuser';

      vi.mocked(execSync)
        .mockImplementationOnce(() => {
          throw new Error('Permission denied');
        })
        .mockReturnValue(Buffer.from(''));

      const setupLocal = await import('./setupLocal.js');
      await setupLocal.main();

      const usermodCall = vi.mocked(execSync).mock.calls.find(
        call => call[0]?.includes('usermod')
      );

      expect(usermodCall).toBeDefined();
      expect(usermodCall[0]).toContain('sudo usermod -a -G docker testuser');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should not add user to docker group on non-Linux platforms', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const setupLocal = await import('./setupLocal.js');
      await setupLocal.main();

      const usermodCall = vi.mocked(execSync).mock.calls.find(
        call => call[0]?.includes('usermod')
      );

      expect(usermodCall).toBeUndefined();

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should start database containers using devcontainer up', async () => {
      const setupLocal = await import('./setupLocal.js');
      await setupLocal.main();

      const devcontainerCall = vi.mocked(execSync).mock.calls.find(
        call => call[0] === 'devcontainer up --workspace-folder . --skip-post-create'
      );

      expect(devcontainerCall).toBeDefined();
    });

    it('should wait for postgres to be ready', async () => {
      const setupLocal = await import('./setupLocal.js');
      await setupLocal.main();

      const pgReadyCall = vi.mocked(execSync).mock.calls.find(
        call => call[0] === 'docker exec talawa-postgres-1 pg_isready -U postgres'
      );

      expect(pgReadyCall).toBeDefined();
    });

    it('should retry postgres health check up to 10 times', async () => {
      vi.mocked(execSync).mockImplementation((cmd) => {
        if (cmd === 'docker exec talawa-postgres-1 pg_isready -U postgres') {
          throw new Error('Not ready');
        }
        return Buffer.from('');
      });

      const setupLocal = await import('./setupLocal.js');
      await setupLocal.main();

      const pgReadyCalls = vi.mocked(execSync).mock.calls.filter(
        call => call[0] === 'docker exec talawa-postgres-1 pg_isready -U postgres'
      );

      expect(pgReadyCalls.length).toBe(10);
    });

    it('should apply database migrations', async () => {
      const setupLocal = await import('./setupLocal.js');
      await setupLocal.main();

      const migrateCall = vi.mocked(execSync).mock.calls.find(
        call => call[0] === 'pnpm run apply_drizzle_migrations'
      );

      expect(migrateCall).toBeDefined();
    });

    it('should seed sample data when user chooses yes', async () => {
      vi.mocked(inquirer.prompt)
        .mockResolvedValueOnce({ addSampleData: true })
        .mockResolvedValueOnce({ startServer: false });

      const setupLocal = await import('./setupLocal.js');
      await setupLocal.main();

      const seedCall = vi.mocked(execSync).mock.calls.find(
        call => call[0] === 'pnpm run add:sample_data'
      );

      expect(seedCall).toBeDefined();
    });

    it('should not seed sample data when user chooses no', async () => {
      vi.mocked(inquirer.prompt)
        .mockResolvedValueOnce({ addSampleData: false })
        .mockResolvedValueOnce({ startServer: false });

      const setupLocal = await import('./setupLocal.js');
      await setupLocal.main();

      const seedCall = vi.mocked(execSync).mock.calls.find(
        call => call[0] === 'pnpm run add:sample_data'
      );

      expect(seedCall).toBeUndefined();
    });

    it('should handle sample data seeding errors gracefully', async () => {
      vi.mocked(inquirer.prompt)
        .mockResolvedValueOnce({ addSampleData: true })
        .mockResolvedValueOnce({ startServer: false });

      vi.mocked(execSync).mockImplementation((cmd) => {
        if (cmd === 'pnpm run add:sample_data') {
          throw new Error('Seeding failed');
        }
        return Buffer.from('');
      });

      const setupLocal = await import('./setupLocal.js');

      await expect(setupLocal.main()).resolves.not.toThrow();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Sample data seeding failed')
      );
    });

    it('should start development server when user chooses yes', async () => {
      vi.mocked(inquirer.prompt)
        .mockResolvedValueOnce({ addSampleData: false })
        .mockResolvedValueOnce({ startServer: true });

      vi.mocked(execSync).mockImplementation((cmd) => {
        if (cmd === 'pnpm run start_development_server') {
          throw new Error('User interrupted');
        }
        return Buffer.from('');
      });

      const setupLocal = await import('./setupLocal.js');
      await setupLocal.main();

      const serverCall = vi.mocked(execSync).mock.calls.find(
        call => call[0] === 'pnpm run start_development_server'
      );

      expect(serverCall).toBeDefined();
      expect(console.log).toHaveBeenCalledWith('\nServer stopped.');
    });

    it('should show restart message when user chooses not to start server', async () => {
      vi.mocked(inquirer.prompt)
        .mockResolvedValueOnce({ addSampleData: false })
        .mockResolvedValueOnce({ startServer: false });

      const setupLocal = await import('./setupLocal.js');
      await setupLocal.main();

      expect(console.log).toHaveBeenCalledWith(
        '⚠️  Restart your terminal to use pnpm manually.'
      );
    });
  });
});