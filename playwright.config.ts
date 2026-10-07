import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './scripts/e2e-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: { baseURL: 'http://localhost:3000', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: [
    {
      command: 'npm start',
      url: 'http://localhost:3000',
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
  reporter: [['list'], ['html', { open: 'never' }]],
});
