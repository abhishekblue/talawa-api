import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('node:fs');
vi.mock('node:child_process');

const ROOT_DIR = process.cwd();
const ENV_DEV_SOURCE = `${ROOT_DIR}/envFiles/.env.devcontainer`;
const ENV_CI_SOURCE = `${ROOT_DIR}/envFiles/.env.ci`;
const ENV_DEST = `${ROOT_DIR}/.env`;

describe('setupDocker', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    delete process.env.CI;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('needsSudoForDocker', () => {
    it('should return false when docker works without sudo', async () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from(''));

      const { needsSudoForDocker } = await import('./setupDocker.js');

      expect(needsSudoForDocker()).toBe(false);
      expect(execSync).toHaveBeenCalledWith('docker ps', { stdio: 'ignore' });
    });

    it('should return true when docker requires sudo', async () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const { needsSudoForDocker } = await import('./setupDocker.js');

      expect(needsSudoForDocker()).toBe(true);
    });
  });

  describe('runCommand', () => {
    it('should execute command successfully', async () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from(''));

      const { runCommand } = await import('./setupDocker.js');

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

      const { runCommand } = await import('./setupDocker.js');

      runCommand('docker ps');

      expect(execSync).toHaveBeenCalledWith(
        'sudo docker ps',
        expect.objectContaining({ stdio: 'inherit' })
      );
    });

    it('should exit process on error', async () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Command failed');
      });

      const { runCommand } = await import('./setupDocker.js');

      expect(() => runCommand('invalid-command')).toThrow('process.exit called');
      expect(console.error).toHaveBeenCalledWith('❌ Command failed: invalid-command');
    });
  });

  describe('main function - CI mode', () => {
    beforeEach(() => {
      process.env.CI = 'true';
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.copyFileSync).mockImplementation(() => {});
    });

    it('should use CI env file when CI environment is detected', async () => {
      const setupDocker = await import('./setupDocker.js');
      await setupDocker.main();

      expect(console.log).toHaveBeenCalledWith('✅ CI environment detected - using CI/Testing mode');
      expect(fs.copyFileSync).toHaveBeenCalledWith(ENV_CI_SOURCE, ENV_DEST);
    });

    it('should fallback to devcontainer env if CI env does not exist', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        if (path === ENV_CI_SOURCE) return false;
        if (path === ENV_DEV_SOURCE) return true;
        return false;
      });

      const setupDocker = await import('./setupDocker.js');
      await setupDocker.main();

      expect(fs.copyFileSync).toHaveBeenCalledWith(ENV_DEV_SOURCE, ENV_DEST);
    });

    it('should return early after setting up CI env', async () => {
      const setupDocker = await import('./setupDocker.js');
      await setupDocker.main();

      const devcontainerCalls = vi.mocked(execSync).mock.calls.filter(
        call => call[0]?.includes('devcontainer')
      );

      expect(devcontainerCalls.length).toBe(0);
    });
  });

  describe('main function - DevContainer mode', () => {
    beforeEach(() => {
      delete process.env.CI;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.copyFileSync).mockImplementation(() => {});
      vi.mocked(execSync).mockReturnValue(Buffer.from(''));
    });

    it('should exit if source env file does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const setupDocker = await import('./setupDocker.js');

      expect(() => setupDocker.main()).toThrow('process.exit called');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error: Source file not found')
      );
    });

    it('should copy devcontainer env file', async () => {
      const setupDocker = await import('./setupDocker.js');
      await setupDocker.main();

      expect(fs.copyFileSync).toHaveBeenCalledWith(ENV_DEV_SOURCE, ENV_DEST);
      expect(console.log).toHaveBeenCalledWith('✅ .env created for DevContainer setup');
    });

    it('should install devcontainer CLI', async () => {
      const setupDocker = await import('./setupDocker.js');
      await setupDocker.main();

      const installCall = vi.mocked(execSync).mock.calls.find(
        call => call[0] === 'pnpm install -g @devcontainers/cli'
      );

      expect(installCall).toBeDefined();
    });

    it('should build devcontainer', async () => {
      const setupDocker = await import('./setupDocker.js');
      await setupDocker.main();

      const buildCall = vi.mocked(execSync).mock.calls.find(
        call => call[0] === 'devcontainer build --workspace-folder .'
      );

      expect(buildCall).toBeDefined();
    });

    it('should start devcontainer', async () => {
      const setupDocker = await import('./setupDocker.js');
      await setupDocker.main();

      const upCall = vi.mocked(execSync).mock.calls.find(
        call => call[0] === 'devcontainer up --workspace-folder .'
      );

      expect(upCall).toBeDefined();
    });

    it('should start API server inside container using sh', async () => {
      const setupDocker = await import('./setupDocker.js');
      await setupDocker.main();

      const serverCall = vi.mocked(execSync).mock.calls.find(
        call => call[0]?.includes('docker exec talawa-api-1')
      );

      expect(serverCall).toBeDefined();
      expect(serverCall[0]).toContain('sh -c');
      expect(serverCall[0]).toContain('nohup pnpm run start_development_server');
    });

    it('should use sh instead of bash for cross-platform compatibility', async () => {
      const setupDocker = await import('./setupDocker.js');
      await setupDocker.main();

      const serverCall = vi.mocked(execSync).mock.calls.find(
        call => call[0]?.includes('docker exec talawa-api-1')
      );

      expect(serverCall[0]).not.toContain('/bin/bash');
      expect(serverCall[0]).toContain('sh -c');
    });

    it('should wait 5 seconds for server to start', async () => {
      vi.useFakeTimers();

      const setupDocker = await import('./setupDocker.js');
      const mainPromise = setupDocker.main();

      await vi.advanceTimersByTimeAsync(5000);
      await mainPromise;

      expect(console.log).toHaveBeenCalledWith('\n⏳ Waiting for server to start...');

      vi.useRealTimers();
    });

    it('should display completion message with useful commands', async () => {
      const setupDocker = await import('./setupDocker.js');
      await setupDocker.main();

      expect(console.log).toHaveBeenCalledWith('\n✅ DevContainer Setup Complete!');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('API Server is running at: http://localhost:4000'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('GraphQL Playground: http://localhost:4000/graphql'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('View logs:    docker logs -f talawa-api-1'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Stop server:  docker exec talawa-api-1 pkill'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Restart:      docker restart talawa-api-1'));
    });

    it('should execute steps in correct order', async () => {
      const setupDocker = await import('./setupDocker.js');
      await setupDocker.main();

      const calls = vi.mocked(execSync).mock.calls.map(call => call[0]);

      const installIndex = calls.findIndex(c => c === 'pnpm install -g @devcontainers/cli');
      const buildIndex = calls.findIndex(c => c === 'devcontainer build --workspace-folder .');
      const upIndex = calls.findIndex(c => c === 'devcontainer up --workspace-folder .');
      const serverIndex = calls.findIndex(c => c?.includes('docker exec talawa-api-1'));

      expect(installIndex).toBeLessThan(buildIndex);
      expect(buildIndex).toBeLessThan(upIndex);
      expect(upIndex).toBeLessThan(serverIndex);
    });

    it('should handle errors during devcontainer build', async () => {
      vi.mocked(execSync).mockImplementation((cmd) => {
        if (cmd === 'devcontainer build --workspace-folder .') {
          throw new Error('Build failed');
        }
        return Buffer.from('');
      });

      const setupDocker = await import('./setupDocker.js');

      expect(() => setupDocker.main()).toThrow('process.exit called');
      expect(console.error).toHaveBeenCalledWith('❌ Command failed: devcontainer build --workspace-folder .');
    });

    it('should add sudo prefix to docker commands when needed', async () => {
      vi.mocked(execSync)
        .mockImplementationOnce(() => {
          throw new Error('Permission denied');
        })
        .mockReturnValue(Buffer.from(''));

      const setupDocker = await import('./setupDocker.js');
      await setupDocker.main();

      const sudoCalls = vi.mocked(execSync).mock.calls.filter(
        call => call[0]?.startsWith('sudo docker')
      );

      expect(sudoCalls.length).toBeGreaterThan(0);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Using sudo for Docker commands')
      );
    });
  });

  describe('cross-platform compatibility', () => {
    beforeEach(() => {
      delete process.env.CI;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.copyFileSync).mockImplementation(() => {});
      vi.mocked(execSync).mockReturnValue(Buffer.from(''));
    });

    it('should use sh shell which is available on Windows Git Bash', async () => {
      const setupDocker = await import('./setupDocker.js');
      await setupDocker.main();

      const serverCall = vi.mocked(execSync).mock.calls.find(
        call => call[0]?.includes('docker exec')
      );

      expect(serverCall[0]).toContain('sh -c');
    });

    it('should use setTimeout for waiting instead of sleep command', async () => {
      const setupDocker = await import('./setupDocker.js');
      await setupDocker.main();

      const sleepCall = vi.mocked(execSync).mock.calls.find(
        call => call[0]?.includes('sleep')
      );

      expect(sleepCall).toBeUndefined();
    });
  });
});