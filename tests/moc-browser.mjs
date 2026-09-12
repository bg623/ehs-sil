import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// npm install --no-save playwright@1.57.0 && npx playwright install chromium
// Local runtime overrides never enter the production bundle.
const moduleName = process.env.PLAYWRIGHT_MODULE;
const { chromium } = await import(moduleName && path.isAbsolute(moduleName) ? pathToFileURL(moduleName).href : moduleName || 'playwright');
const baseURL = (process.env.MOC_BASE_URL || 'http://127.0.0.1:8769').replace(/\/$/, '');
const toolURL = `${baseURL}/tools/moc-coach.html`;
const evidenceDir = path.resolve(process.env.MOC_QA_DIR || 'test-results/moc-qa');
await fs.mkdir(evidenceDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
});
const results = [];
let activePage;

async function test(name, callback) {
  try {
    await callback();
    results.push({ name, status: 'passed' });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, status: 'failed', error: error.message });
    if (activePage && !activePage.isClosed()) {
      await activePage.screenshot({ path: path.join(evidenceDir, `failure-${results.length}.png`), fullPage: true }).catch(() => {});
    }
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

async function openTool(viewport = { width: 1440, height: 1100 }, options = {}) {
  const context = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  // Every context is isolated and contains only the fictional QA record.
  page.on('dialog', (dialog) => dialog.accept());
  activePage = page;
  if (options.initialStorage !== undefined) await page.addInitScript((raw) => localStorage.setItem('ehs-sil-moc-record-v1', raw), options.initialStorage);
  const errors = [];
  const requests = [];
  const consoleMessages = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    consoleMessages.push(message.text());
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('request', (request) => requests.push({ url: request.url(), method: request.method(), body: request.postData() || '' }));
  await page.goto(toolURL, { waitUntil: 'networkidle' });
  assert.match(await page.title(), /MOC/);
  await page.locator('#workspace').waitFor({ state: 'visible' });
  return { page, context, errors, requests, consoleMessages };
}

async function noHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  assert.ok(dimensions.document <= dimensions.viewport, `${label}: document ${dimensions.document}px > viewport ${dimensions.viewport}px`);
}

async function download(page, button, evidenceName) {
  const pending = page.waitForEvent('download');
  await button.click();
  const result = await pending;
  const target = path.join(evidenceDir, evidenceName || result.suggestedFilename());
  await result.saveAs(target);
  assert.equal(await result.failure(), null);
  return { filename: result.suggestedFilename(), text: await fs.readFile(target, 'utf8'), path: target };
}

async function screenshot(page, filename) {
  await page.screenshot({ path: path.join(evidenceDir, filename), fullPage: true });
}

async function loadDemo(page) {
  await page.locator('#load-demo').click();
  await page.locator('#record-summary').getByText(/循环泵/).waitFor({ state: 'attached' });
}

async function exportRecord(page, name = 'record-backup.json') {
  const result = await download(page, page.locator('#export-json'), name);
  assert.match(result.filename, /^MOC_.+\.json$/);
  assert.ok(!/[<>:"/\\|?*]/.test(result.filename), 'Export filename must be filesystem-safe');
  return JSON.parse(result.text.replace(/^\uFEFF/, ''));
}

async function importRecord(page, record) {
  const fileChooser = page.waitForEvent('filechooser');
  await page.locator('#import-json').click();
  const chooser = await fileChooser;
  await chooser.setFiles({ name: 'moc-qa.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(record)) });
}

async function edit(page, fieldPath, value) {
  const field = page.locator(`[data-field="${fieldPath}"]`);
  const ancestors = await field.locator('xpath=ancestor::details').all();
  for (const details of ancestors) {
    if (!(await details.getAttribute('open'))) {
      // getAttribute returns an empty string for a present boolean attribute.
      const open = await details.evaluate((element) => element.open);
      if (!open) await details.locator(':scope > summary').click();
    }
  }
  const type = await field.evaluate((element) => element.tagName === 'SELECT' ? 'select' : element.type);
  if (type === 'select') await field.selectOption(value === null ? 'null' : String(value));
  else if (type === 'checkbox') await field.setChecked(Boolean(value));
  else { await field.fill(String(value)); await field.press('Tab'); }
}

async function stateAction(page, name, expectedStatus) {
  await page.locator('#record-actor').fill('QA 虚构记录人');
  await page.locator('#transition-note').fill('QA 完整流程核对；所有依据均为虚构测试记录。');
  await page.getByRole('button', { name, exact: true }).click();
  if (expectedStatus) {
    const snapshot = await exportRecord(page, `lifecycle-${expectedStatus}.json`);
    assert.equal(snapshot.meta.status, expectedStatus, await page.locator('#validation').textContent());
    return snapshot;
  }
}

// Acceptance cases follow the public UI and exported JSON backup contract.

try {
  await test('MOC route and local-only shell load', async () => {
    const { page, context, errors, requests } = await openTool();
    assert.equal(await page.locator('body').getAttribute('data-site-shell-features'), 'local');
    assert.equal(requests.filter(({ url }) => new URL(url).origin !== new URL(baseURL).origin).length, 0, 'Local tool must not load third-party requests');
    assert.deepEqual(errors, []);
    await screenshot(page, 'moc-desktop-1440.png');
    await context.close();
  });

  await test('T13 browser refresh preserves draft, state, version and record data', async () => {
    const { page, context, errors } = await openTool();
    await loadDemo(page);
    const before = await exportRecord(page, 'demo-before-refresh.json');
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#workspace').waitFor({ state: 'visible' });
    const after = await exportRecord(page, 'demo-after-refresh.json');
    assert.deepEqual(after, before);
    assert.deepEqual(errors, []);
    await context.close();
  });

  await test('Corrupt local storage is retained and can be exported without overwrite', async () => {
    const raw = '{"meta": "QA corrupted JSON source"';
    const { page, context } = await openTool(undefined, { initialStorage: raw });
    await page.locator('#validation').waitFor({ state: 'visible' });
    assert.match(await page.locator('#validation').innerText(), /原.*保留|原.*未覆盖|原存储未覆盖/);
    assert.equal(await page.evaluate(() => localStorage.getItem('ehs-sil-moc-record-v1')), raw);
    const backup = await download(page, page.locator('#export-json'), 'corrupt-original-backup.json');
    assert.equal(backup.text, raw, 'Recovery export must contain the original damaged bytes');
    assert.equal(await page.evaluate(() => localStorage.getItem('ehs-sil-moc-record-v1')), raw);
    await context.close();
  });

  await test('JSON backup round trip and invalid import preserve the current record', async () => {
    const { page, context, errors } = await openTool();
    await loadDemo(page);
    const before = await exportRecord(page, 'roundtrip-source.json');
    await importRecord(page, before);
    const after = await exportRecord(page, 'roundtrip-restored.json');
    assert.deepEqual(after.changeSummary, before.changeSummary);
    assert.deepEqual(after.riskItems, before.riskItems);
    assert.deepEqual(after.actions, before.actions);
    assert.equal(after.meta.id, before.meta.id);
    assert.equal(after.meta.version, before.meta.version);
    await importRecord(page, { schemaVersion: 999, meta: { title: 'invalid' } });
    await page.locator('#validation').waitFor({ state: 'visible' });
    const invalidResult = await exportRecord(page, 'after-invalid-import.json');
    assert.deepEqual(invalidResult, after, 'Invalid JSON must not partially overwrite data');
    assert.deepEqual(errors, []);
    await context.close();
  });

  await test('Full UI lifecycle, T09 startup action gate and T10 PSSR authorization gate', async () => {
    const { page, context, errors } = await openTool();
    await loadDemo(page);
    const demo = await exportRecord(page, 'lifecycle-start.json');
    const date = new Date().toISOString().slice(0, 10);
    const dateTime = `${date}T09:00`;
    const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const steps = page.locator('#steps button');
    await edit(page, 'meta.title', 'MOC 完整生命周期（虚构测试）');
    await steps.nth(1).click();
    await edit(page, 'classification.confirmedLevel', 'general');
    await steps.nth(2).click();
    for (const [index, item] of demo.impactDomains.entries()) {
      if (item.status === 'unknown') await edit(page, `impactDomains.${index}.status`, 'none');
    }
    await steps.nth(3).click();
    for (const [index] of demo.riskItems.entries()) {
      await edit(page, `riskItems.${index}.acceptanceBy`, 'QA 专业确认人');
      await edit(page, `riskItems.${index}.acceptanceNote`, 'QA 专业评审确认控制条件及残余风险。');
    }
    await steps.nth(5).click();
    for (const [index] of demo.documents.entries()) {
      await edit(page, `documents.${index}.owner`, 'QA 文件负责人');
      await edit(page, `documents.${index}.due`, future);
    }
    for (const [index] of demo.training.entries()) {
      await edit(page, `training.${index}.content`, 'QA 变更边界、操作条件与应急沟通');
      await edit(page, `training.${index}.method`, 'QA 现场交底');
      await edit(page, `training.${index}.date`, date);
      await edit(page, `training.${index}.trainer`, 'QA 讲师');
    }
    await edit(page, 'pssr.confirmedBy', 'QA PSSR 专业确认人');
    await edit(page, 'pssr.confirmedAt', date);
    await steps.nth(4).click();
    for (const [index] of demo.approvals.entries()) {
      await edit(page, `approvals.${index}.name`, `QA 评审岗位 ${index + 1}`);
      await edit(page, `approvals.${index}.opinion`, 'QA 已评审本职责范围内风险与控制条件。');
      await edit(page, `approvals.${index}.conclusion`, 'approved');
      await edit(page, `approvals.${index}.date`, date);
      await edit(page, `approvals.${index}.evidence`, `QA 线下批准记录 ${index + 1}`);
    }
    await stateAction(page, '记录评估完成', 'assessed');
    await stateAction(page, '进入待审批', 'pending_approval');
    const approved = await stateAction(page, '录入线下批准结果', 'approved');
    assert.equal(approved.meta.approvedVersion, approved.meta.version);
    await steps.nth(5).click();
    await stateAction(page, '记录开始实施', 'implementing');
    await steps.nth(3).click();
    for (const [index] of demo.riskItems.entries()) {
      await edit(page, `riskItems.${index}.status`, 'done');
      await edit(page, `riskItems.${index}.evidence`, 'QA 控制措施已验证的虚构证据');
    }
    await steps.nth(5).click();
    await stateAction(page, '确认投用准备就绪');
    assert.match(await page.locator('#validation').innerText(), /行动.*未完成|行动.*缺少证据/);
    assert.equal((await exportRecord(page, 'startup-blocked-action.json')).meta.status, 'implementing');
    for (const [index] of demo.actions.entries()) {
      await edit(page, `actions.${index}.status`, 'done');
      await edit(page, `actions.${index}.evidence`, 'QA 行动关闭的虚构证据');
    }
    for (const [index] of demo.documents.entries()) {
      await edit(page, `documents.${index}.status`, 'done');
      await edit(page, `documents.${index}.approvedBy`, 'QA 文件批准人');
      await edit(page, `documents.${index}.evidence`, 'QA 更新并批准的文件版本');
    }
    for (const [index] of demo.training.entries()) {
      await edit(page, `training.${index}.status`, 'done');
      await edit(page, `training.${index}.evidence`, 'QA 培训签到与能力确认记录');
    }
    await edit(page, 'implementation.startupAuthorizedBy', 'QA 不应保存的提前授权');
    assert.match(await page.locator('#validation').innerText(), /PSSR/);
    assert.equal((await exportRecord(page, 'startup-blocked-pssr.json')).implementation.startupAuthorizedBy, '');
    await edit(page, 'pssr.status', 'passed');
    await edit(page, 'pssr.passedBy', 'QA PSSR 验证人');
    await edit(page, 'pssr.passedAt', date);
    await edit(page, 'pssr.evidence', 'QA PSSR 检查通过及遗留项关闭记录');
    await edit(page, 'implementation.startupAuthorizedBy', 'QA 投用授权人');
    await edit(page, 'implementation.startupAuthorizedAt', dateTime);
    await edit(page, 'implementation.startupAuthorizationEvidence', 'QA 线下投用授权记录');
    await stateAction(page, '确认投用准备就绪', 'ready_for_startup');
    await stateAction(page, '记录已投用', 'in_service');
    await stateAction(page, '进入效果验证', 'verification_due');
    await steps.nth(6).click();
    await edit(page, 'verification.scopeMatches', 'yes');
    await edit(page, 'verification.effectsAchieved', 'yes');
    await edit(page, 'verification.newRisks', 'no');
    await edit(page, 'verification.verifiedBy', 'QA 独立验证人');
    await edit(page, 'verification.verifiedAt', date);
    await edit(page, 'verification.evidence', 'QA 实际运行与检查验证记录');
    await edit(page, 'verification.closeReason', 'QA 控制措施与效果验证完成，记录关闭。');
    const closed = await stateAction(page, '记录验证完成并关闭', 'closed');
    for (const status of ['assessed', 'pending_approval', 'approved', 'implementing', 'ready_for_startup', 'in_service', 'verification_due', 'closed']) {
      assert.ok(closed.auditTrail.some((entry) => entry.action.endsWith(`->${status}`)), `Missing ${status} audit transition`);
    }
    await screenshot(page, 'moc-lifecycle-closed.png');
    await page.reload({ waitUntil: 'networkidle' });
    assert.deepEqual(await exportRecord(page, 'closed-after-refresh.json'), closed);
    assert.deepEqual(errors, []);
    await context.close();
  });

  await test('User content stays local and HTML / spreadsheet formula text stays inert', async () => {
    const { page, context, errors, requests, consoleMessages } = await openTool();
    await loadDemo(page);
    const record = await exportRecord(page, 'security-source.json');
    const marker = 'QA_MOC_LOCAL_ONLY_7B3F';
    record.meta.title = `=${marker}`;
    record.riskItems[0].scenario = `<img src=x onerror="window.__mocInjected=true"> ${marker}`;
    record.actions[0].title = `@${marker}`;
    await importRecord(page, record);
    const imported = await exportRecord(page, 'security-restored.json');
    assert.equal(imported.meta.title, record.meta.title);
    assert.equal(imported.riskItems[0].scenario, record.riskItems[0].scenario);
    await page.locator('#steps button').nth(3).click();
    assert.equal(await page.evaluate(() => window.__mocInjected), undefined);
    assert.equal(await page.locator('#form-content img').count(), 0);
    const register = await download(page, page.locator('#export-register'), 'security-register.csv');
    assert.ok(register.text.includes(`'=${marker}`), 'Spreadsheet formula prefix must be escaped with a literal apostrophe');
    assert.match(register.filename, /\.csv$/);
    const actions = await download(page, page.locator('#export-actions'), 'security-actions.csv');
    assert.match(actions.filename, /\.csv$/);
    assert.ok(actions.text.includes(`'@${marker}`), 'Action CSV formulas must be escaped');
    assert.ok(!requests.some(({ url, body }) => decodeURIComponent(url).includes(marker) || body.includes(marker)), 'User fields must not enter request URLs or payloads');
    assert.ok(!consoleMessages.some((message) => message.includes(marker)), 'User fields must not enter console logs');
    assert.equal(requests.filter(({ url }) => new URL(url).origin !== new URL(baseURL).origin).length, 0);
    assert.equal(await page.evaluate(() => document.location.search), '');
    assert.deepEqual(errors, []);
    await context.close();
  });

  await test('Risk score updates immediately and PSSR exemption remains editable', async () => {
    const { page, context } = await openTool();
    await loadDemo(page);
    await page.locator('#steps button').nth(3).click();
    await edit(page, 'riskItems.0.residualLikelihood', 5);
    assert.match(await page.locator('.moc-score').first().innerText(), /极高.*20/);
    await edit(page, 'riskItems.0.residualLikelihood', 1);
    assert.match(await page.locator('.moc-score').first().innerText(), /4/);
    await page.locator('#steps button').nth(4).click();
    await edit(page, 'pssr.required', false);
    const record = await exportRecord(page, 'pssr-exemption.json');
    assert.equal(record.pssr.required, false);
    assert.equal(record.pssr.status, 'not_required');
    assert.ok(!(await page.locator('#form-content').innerText()).includes('请将状态设为'));
    await context.close();
  });

  await test('T14 keyboard navigation, visible labels and live status semantics', async () => {
    const { page, context } = await openTool({ width: 390, height: 844 });
    const steps = page.locator('#steps button');
    for (let step = 0; step < 7; step++) {
      await steps.nth(step).focus();
      await page.keyboard.press('Enter');
      assert.equal(await steps.nth(step).getAttribute('aria-current'), 'step');
      const issues = await page.locator('#form-content').evaluate((form) => {
        const result = [];
        for (const element of form.querySelectorAll('input:not([type=hidden]),select,textarea')) {
          if (!element.getClientRects().length) continue;
          const name = element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') || [...(element.labels || [])].map((label) => label.textContent.trim()).join('');
          if (!name) result.push(`Unlabelled ${element.tagName.toLowerCase()} ${element.id}`);
          const target = element.type === 'checkbox' ? element.closest('label') || element : element;
          if (target.getBoundingClientRect().height < 43.5) result.push(`Short touch target ${element.id}`);
        }
        return result;
      });
      assert.deepEqual(issues, [], `Accessible fields at step ${step + 1}`);
    }
    assert.equal(await page.locator('#save-status').getAttribute('role'), 'status');
    assert.equal(await page.locator('#save-status').getAttribute('aria-live'), 'polite');
    assert.equal(await page.locator('#validation').getAttribute('role'), 'alert');
    assert.equal(await page.locator('#step-title').getAttribute('tabindex'), '-1');
    await context.close();
  });

  await test('T15 complete fictional example creates an A4 printable report', async () => {
    const { page, context, errors } = await openTool();
    await loadDemo(page);
    // Prevent an OS print dialog in automated QA while preserving the public print-button path.
    await page.evaluate(() => { window.print = () => {}; });
    await page.locator('#print-report').click();
    await page.emulateMedia({ media: 'print' });
    const report = page.locator('#print-content');
    await report.waitFor({ state: 'visible' });
    const text = await report.innerText();
    for (const expected of ['循环泵', '风险', '行动', '培训', 'PSSR', '审批', '审计']) assert.ok(text.includes(expected), `Missing report section: ${expected}`);
    assert.match(text, /不能替代/);
    const visibleControls = await page.locator('button,input,textarea,select').evaluateAll((elements) => elements.filter((element) => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden').length);
    assert.equal(visibleControls, 0, 'Print must hide interactive controls');
    assert.equal(await page.locator('.moc-hero').isVisible(), false);
    await page.setViewportSize({ width: 794, height: 1123 });
    await noHorizontalOverflow(page, 'print preview');
    await screenshot(page, 'moc-print-preview.png');
    const pdf = await page.pdf({ path: path.join(evidenceDir, 'moc-example-a4.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true, tagged: true });
    const pdfText = pdf.toString('latin1');
    const mediaBox = pdfText.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/);
    assert.ok(mediaBox && Math.abs(Number(mediaBox[1]) - 595.3) < 3 && Math.abs(Number(mediaBox[2]) - 841.9) < 3, 'PDF media box must be A4');
    const pages = (pdfText.match(/\/Type\s*\/Page\b/g) || []).length;
    assert.ok(pages >= 2 && pages <= 50, `Unexpected printable report page count: ${pages}`);
    assert.deepEqual(errors, []);
    await context.close();
  });

  for (const width of [390, 768, 1440]) {
    await test(`T14 ${width}px all seven steps fit without horizontal overflow`, async () => {
      const { page, context, errors } = await openTool({ width, height: width === 390 ? 844 : 1100 });
      await loadDemo(page);
      const steps = page.locator('#steps button');
      assert.equal(await steps.count(), 7);
      for (let step = 0; step < 7; step++) {
        await steps.nth(step).click();
        await noHorizontalOverflow(page, `${width}px step ${step + 1}`);
        assert.match(await steps.nth(step).getAttribute('aria-current'), /step/);
      }
      await steps.first().click();
      await screenshot(page, `moc-${width}.png`);
      assert.deepEqual(errors, []);
      await context.close();
    });
  }
} finally {
  await browser.close();
  await fs.writeFile(path.join(evidenceDir, 'browser-results.json'), JSON.stringify({
    checkedAt: new Date().toISOString(), baseURL, results,
    note: 'Automated accessibility checks supplement, and do not replace, assistive-technology and A4 visual review.',
  }, null, 2));
}

if (results.some(({ status }) => status === 'failed')) process.exitCode = 1;
