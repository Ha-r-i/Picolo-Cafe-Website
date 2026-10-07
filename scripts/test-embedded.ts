import { spawn } from 'node:child_process';
import { startNative } from './native-db.js';
const postgres = await startNative();
try {
  await new Promise<void>((done, reject) => {
    const child = spawn(
      process.execPath,
      ['node_modules/vitest/vitest.mjs', 'run', 'tests/integration', '--no-file-parallelism'],
      {
        windowsHide: true,
        stdio: 'inherit',
        env: { ...process.env, TEST_DATABASE_URL: postgres.url, DATABASE_SSL: 'false' },
      },
    );
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? done() : reject(new Error(`Database tests exited ${code}`)),
    );
  });
} finally {
  await postgres.stop();
}
