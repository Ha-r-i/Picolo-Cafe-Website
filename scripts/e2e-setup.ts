import { readFile } from 'node:fs/promises';
import { localFixture } from './local-fixture.js';

// Playwright owns the fixture in its runner process. A Windows webServer
// subprocess is forcibly terminated, which skips that child's signal cleanup.
export default async function setup() {
  const fixture = await localFixture();
  let api: Awaited<ReturnType<typeof fixture.api>> | undefined;
  const cleanup = async () => {
    try {
      if (api) await api.app.close();
    } finally {
      try {
        await Promise.all([api?.pool.end(), fixture.owner.end()]);
      } finally {
        await fixture.native.stop();
      }
    }
  };
  try {
    await fixture.owner.query(await readFile('supabase/seed.sql', 'utf8'));
    api = await fixture.api(true);
    await api.app.listen({ host: '127.0.0.1', port: 3001 });
    process.stdout.write(
      'E2E guest API ready with real isolated PostgreSQL; Supabase Auth/Storage HTTP are not available.\n',
    );
  } catch (error) {
    await cleanup();
    throw error;
  }
  return cleanup;
}
