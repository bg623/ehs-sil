import { test, expect } from '@playwright/test';
import path from 'node:path';

const baseUrl = process.env.GLOSSARY_BASE_URL || 'http://127.0.0.1:8765/tools/ehs-glossary.html';
const screenshots = path.resolve('test-results/glossary-screenshots');

async function load(page, url = baseUrl) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await expect(page.locator('#resultSummary')).toContainText('445');
}

async function search(page, query) {
  await page.locator('#glossarySearch').fill(query);
  await page.getByRole('button', { name: '查询术语' }).click();
}

test('desktop search, deep link, learning, and download flows work', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1100 });
  await load(page);
  await page.screenshot({ path: path.join(screenshots, 'ehs-glossary-desktop-1440.png') });

  for (const query of ['LOTO', '上锁挂牌', 'Line of Fire', '伤害路径', 'HAZOP', 'LOPA', 'SIL', '旁路']) {
    await search(page, query);
    await expect(page.locator('#termResults .term-card').first()).toBeVisible();
  }

  await search(page, 'EAP');
  await expect(page.locator('#termResults .term-card')).toHaveCount(2);
  await search(page, 'EPR');
  await expect(page.locator('#termResults .term-card')).toHaveCount(2);
  await search(page, '不存在的测试词');
  await expect(page.locator('#termResults .empty-state')).toBeVisible();

  await search(page, 'LOTO');
  await page.locator('#term-220 summary').click();
  await expect(page).toHaveURL(/term=220/);
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('#term-220')).toHaveAttribute('open', '');

  await page.getByRole('tab', { name: '每日学习' }).click();
  await page.locator('.learning-card').first().getByRole('button', { name: '我认识' }).click();
  await expect(page.locator('#learningProgress')).toContainText('1/10');
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('#learningProgress')).toContainText('1/10');

  await load(page);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-glossary-download]').first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('EHS术语中英文对照大全-445词.xlsx');
  expect(pageErrors).toEqual([]);
});

for (const viewport of [
  { width: 390, height: 844, name: 'mobile-390' },
  { width: 768, height: 900, name: 'tablet-768' },
]) {
  test(`${viewport.width}px layout has no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await load(page);
    const dimensions = await page.evaluate(() => ({ innerWidth: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
    if (viewport.width === 390) await page.screenshot({ path: path.join(screenshots, 'ehs-glossary-mobile-390.png') });
  });
}
