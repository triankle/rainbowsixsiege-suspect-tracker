import { expect, test } from '@playwright/test';

test('analyzes a ranked profile through the server engine', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Username (optional)').fill('E2E.Player');
  await page.getByLabel('K/D (ranked)').fill('1.72');
  await page.getByLabel('Win rate % (ranked)').fill('63');
  await page.getByLabel('Ranked matches played').fill('180');
  await page.getByLabel('Account level').fill('92');
  await page.getByLabel('Current rank (optional)').selectOption('emerald');
  await page.getByLabel('Season 17').check();
  await page.getByLabel('Season 18 (current)').check();

  await page.getByRole('button', { name: 'Analyze profile' }).click();

  await expect(page.getByRole('heading', { name: 'Result' })).toBeVisible();
  await expect(page.locator('#result-content')).toContainText('Classification:');
  await expect(page.locator('#result-content')).toContainText('Cheat axis:');
  await expect(page.getByRole('button', { name: 'Save to database' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy report' })).toBeVisible();
});
