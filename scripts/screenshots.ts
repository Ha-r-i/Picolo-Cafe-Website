import { mkdir } from 'node:fs/promises';
import { chromium, devices, expect } from '@playwright/test';

// Start `npm run dev` first. This captures public pages without signing in
// or creating reservations, so no customer information enters the README.
const baseUrl = 'http://localhost:3000';
const output = 'docs/screenshots';
const pages = [
  { name: 'home', path: '/', heading: 'A little coffee. A little joy.' },
  { name: 'menu', path: '/menu', heading: 'The menu.' },
  { name: 'booking', path: '/booking', heading: 'Save your seat.' },
  { name: 'account', path: '/account', heading: 'Make yourself at home.' },
];

await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  for (const size of ['desktop', 'mobile']) {
    const context = await browser.newContext(
      size === 'mobile'
        ? { ...devices['iPhone 13'], deviceScaleFactor: 1 }
        : { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 },
    );
    try {
      const page = await context.newPage();
      for (const screen of pages) {
        await page.goto(`${baseUrl}${screen.path}`);
        await expect(page.getByRole('heading', { name: screen.heading, exact: true })).toBeVisible();
        if (screen.name === 'menu') {
          await expect(page.locator('.menu-card').first()).toBeVisible();
        }
        if (screen.name === 'booking') {
          await expect(page.getByLabel('Full name')).toBeVisible();
        }
        if (screen.name === 'account') {
          await expect(page.getByLabel('Email', { exact: true })).toBeEnabled();
        }
        await page.evaluate(async () => {
          await document.fonts.ready;
          await Promise.all(Array.from(document.images, (image) => image.decode().catch(() => {})));
        });
        await page.screenshot({ path: `${output}/${screen.name}-${size}.png`, fullPage: true });
        console.log(`Saved ${screen.name}-${size}.png`);
      }
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
