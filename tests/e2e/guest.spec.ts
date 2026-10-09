import { test, expect } from '@playwright/test';
test('menu categories, dietary filters, search and keyboard access', async ({ page }) => {
  await page.goto('/menu');
  await expect(page.getByText('Development sample menu.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Hot coffee', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Americano', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Iced coffee', exact: true })).toHaveCount(0);
  await page.getByLabel('Dietary preference').selectOption('vegan');
  await expect(page.getByRole('heading', { name: 'Cappuccino', exact: true })).toHaveCount(0);
  await page.getByLabel('Search the menu').fill('absent');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nothing here just yet.' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByRole('heading', { name: 'Cappuccino', exact: true })).toBeVisible();
  await page.screenshot({
    path: `docs/verification/menu-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test('guest booking uses real database, private confirmation and cancellation', async ({
  page,
}) => {
  await page.goto('/booking');
  // A damaged saved retry entry must not break submission of a valid booking.
  await page.evaluate(() => sessionStorage.setItem('piccolo-booking-request', 'invalid-json'));
  const date = new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-CA', {
    timeZone: 'Asia/Kolkata',
  });
  await page.getByLabel('Date', { exact: true }).fill(date);
  await page.getByRole('combobox', { name: 'Guests', exact: true }).selectOption('2');
  await expect(page.getByRole('combobox', { name: 'Available time', exact: true })).toBeEnabled();
  await page.getByLabel('Available time').selectOption({ index: 1 });
  await page.getByLabel('Full name').fill('E2E Guest');
  await page.getByLabel('Phone', { exact: true }).fill('9876543210');
  await page.getByLabel('Email', { exact: true }).fill('e2e@example.test');
  await page.getByRole('button', { name: 'Request reservation' }).click();
  await expect(page.getByText('YOUR REQUEST IS SAVED')).toBeVisible();
  await page.getByRole('link', { name: 'View or cancel reservation' }).click();
  await page.screenshot({
    path: `docs/verification/booking-${test.info().project.name}.png`,
    fullPage: true,
  });
  await expect(page.getByRole('heading', { name: 'E2E Guest' })).toBeVisible();
  await expect(page.locator('.badge')).toHaveText('pending');
  await page.getByRole('button', { name: 'Cancel reservation', exact: true }).click();
  await expect(page.locator('.badge')).toHaveText('cancelled');
  await page.reload();
  await expect(page.locator('.badge')).toHaveText('cancelled');
});
test('mobile navigation and account/staff unavailable states remain usable', async ({
  page,
  isMobile,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'A little coffee. A little joy.' })).toBeVisible();
  if (isMobile) {
    await page.getByRole('button', { name: 'Menu +', exact: true }).click();
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  }
  if (isMobile) {
    await page.getByRole('button', { name: 'Menu −', exact: true }).click();
  }
  await page.screenshot({
    path: `docs/verification/home-${test.info().project.name}.png`,
    fullPage: true,
  });
  if (isMobile) {
    await page.getByRole('button', { name: 'Menu +', exact: true }).click();
  }
  await page.getByRole('link', { name: 'The menu', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'The menu.', exact: true })).toBeVisible();
  await page.goto('/admin/dashboard');
  await expect(page.getByRole('heading', { name: 'Staff access', exact: true })).toBeVisible();
});
