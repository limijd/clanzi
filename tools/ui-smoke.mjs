import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
import { emptyMap } from '../ui/domain.ts';

const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ['--no-sandbox'] });
const errors = [];
await mkdir('artifacts', { recursive: true });
const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1, locale: 'en-US' });
const page = await context.newPage();
page.on('pageerror', e => errors.push(e.message));
await page.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.hostname !== 'clanzi.test') { await route.abort(); return; }
  const file = resolve('dist', url.pathname === '/' ? 'index.html' : `.${url.pathname}`);
  if (!file.startsWith(`${resolve('dist')}/`)) { await route.abort(); return; }
  const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }[extname(file)] ?? 'application/octet-stream';
  try { await route.fulfill({ body: await readFile(file), contentType: type }); } catch { await route.fulfill({ status: 404, body: 'Not found' }); }
});
async function waitState(predicate) {
  await page.waitForFunction(predicate, undefined, { timeout: 5000 });
}
try {
  await page.goto('http://clanzi.test');
  await page.getByRole('heading', { name: 'Make every control your own.' }).waitFor();
  await page.getByLabel('Battery: 80%', { exact: true }).waitFor();
  const save = page.getByRole('button', { name: 'Save to computer', exact: true });
  assert(await save.isEnabled());
  assert.equal(await page.getByRole('group', { name: 'Button behavior' }).count(), 0);
  assert(await page.getByRole('button', { name: 'Undo changes' }).isDisabled());
  assert(await page.getByRole('button', { name: 'Ctrl', exact: true }).isDisabled());
  await page.getByRole('button', { name: /Letters$/ }).click();
  await page.getByRole('button', { name: 'C', exact: true }).click();
  await page.getByRole('button', { name: 'Ctrl', exact: true }).click();
  await waitState(() => document.querySelector('.combination')?.textContent?.includes('Ctrl+C'));
  await page.getByRole('button', { name: 'B', exact: true }).click();
  await waitState(() => document.querySelector('.combination')?.textContent?.includes('Ctrl+B'));
  await page.getByRole('button', { name: 'C', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search keys…' }).fill('no-such-key');
  await page.getByText('No matching keys', { exact: true }).waitFor();
  assert((await page.locator('.combination').textContent()).includes('Ctrl+C'));
  await page.getByRole('textbox', { name: 'Search keys…' }).fill('');
  await save.click();
  await waitState(() => document.querySelector('.save-state')?.textContent?.includes('Saved to this computer'));
  assert(await save.isDisabled());
  await page.screenshot({ path: 'artifacts/keymap-en.png', fullPage: true });
  await page.getByRole('button', { name: 'Rotate right: No action', exact: true }).click();
  assert.equal(await page.getByRole('group', { name: 'Button behavior' }).count(), 0);
  await page.getByRole('button', { name: 'Top key: Ctrl + C', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Pause forwarding', exact: true }).click();
  await page.getByLabel('Battery: —', { exact: true }).waitFor();
  await page.getByText('Battery checks are paused.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Resume forwarding', exact: true }).click();
  await page.getByLabel('Battery: 80%', { exact: true }).waitFor();
  await page.getByRole('button', { name: '简体中文', exact: true }).click();
  await page.getByRole('button', { name: '键位', exact: true }).waitFor();
  await page.getByRole('button', { name: '键位', exact: true }).click();
  assert((await page.locator('.combination').textContent()).includes('Ctrl+C'));
  await page.screenshot({ path: 'artifacts/keymap-zh.png', fullPage: true });
  await page.getByRole('button', { name: '不执行动作', exact: true }).click();
  assert(await page.getByRole('button', { name: 'Ctrl', exact: true }).isDisabled());
  await page.getByRole('button', { name: 'A A', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Ctrl', exact: true }).getAttribute('aria-pressed'), 'false');
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.getByRole('button', { name: 'Export saved configuration', exact: true }).waitFor();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export saved configuration', exact: true }).click();
  const download = await downloadEvent;
  const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.equal(exported.version, 1);
  assert.deepEqual(exported.bindings.key_top, { kind: 'key', usage: 6, modifiers: ['ctrl'] });
  const chooserEvent = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import configuration', exact: true }).click();
  const chooser = await chooserEvent;
  await chooser.setFiles('examples/keymap.json');
  await page.getByRole('dialog').waitFor();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Quit clanzi', exact: true }).click();
  await page.getByRole('heading', { name: 'Save your changes before leaving?' }).waitFor();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.screenshot({ path: 'artifacts/settings-en.png', fullPage: true });
  await page.getByRole('button', { name: 'Keymap', exact: true }).click();
  await page.setViewportSize({ width: 512, height: 384 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole('button', { name: 'Save to computer', exact: true }).scrollIntoViewIfNeeded();
  const bounds = await page.getByRole('button', { name: 'Save to computer', exact: true }).boundingBox();
  assert(bounds && bounds.y >= 0 && bounds.y + bounds.height <= 384);
  await page.screenshot({ path: 'artifacts/keymap-compact.png', fullPage: true });
  // Tab 导航必须到达可操作元素；不依赖鼠标才能保存。
  await page.keyboard.press('Tab');
  assert(await page.evaluate(() => ['BUTTON', 'INPUT', 'A', 'SUMMARY'].includes(document.activeElement.tagName)));
  // Inject native snapshots to cover telemetry states without hardware access.
  const fixture = {
    draft: emptyMap(), saved: null, language: 'en', saving: false, dirty: false, quit_prompt: false, exited: false, error: null, notice: null,
    runtime: { state: 'configuration', connected: true, online: 'online', paused: false, forwarding: false, synchronizing: false, resync_required: false, issues: [], queued: 0, cleanup_pending: false, query_completed_ms: 0, demo: true, battery: null, battery_age_ms: null, battery_error: null },
  };
  await page.addInitScript(snapshot => {
    window.__batterySnapshot = snapshot;
    window.__TAURI__ = { core: { invoke: async command => {
      if (command !== 'snapshot') throw Error('Unexpected native command');
      return structuredClone(window.__batterySnapshot);
    } } };
  }, fixture);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.reload();
  await page.getByLabel('Battery: —', { exact: true }).waitFor();
  const cases = [
    [{ percentage: 10, millivolts: 3318, charging: true }, '10% · Charging', true],
    [{ percentage: 0, millivolts: 3300, charging: false }, '0%', true],
    [{ percentage: 100, millivolts: 4200, charging: false }, '100%', false],
    [{ percentage: null, millivolts: 3549, charging: null }, '3.55 V', false],
    [{ percentage: null, millivolts: null, charging: null }, '—', false],
  ];
  for (const [battery, label, low] of cases) {
    await page.evaluate(battery => Object.assign(window.__batterySnapshot.runtime, { battery, battery_age_ms: 5000 }), battery);
    await page.getByLabel(`Battery: ${label}`, { exact: true }).waitFor();
    assert.equal(await page.locator('.battery-pill').evaluate(el => el.classList.contains('low')), low);
    assert((await page.locator('.battery-pill').getAttribute('title')).includes('Updated 5s ago'));
  }
  await page.evaluate(() => Object.assign(window.__batterySnapshot.runtime, { battery: null, battery_error: { code: 'BATTERY_READ_FAILED', area: 'battery', detail: 'timeout' } }));
  await page.waitForFunction(() => document.querySelector('.battery-pill')?.title.includes('could not be read'));
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByText('Battery could not be read. Retrying automatically; key forwarding is unaffected.', { exact: true }).waitFor();
  await page.evaluate(() => {
    window.__batterySnapshot.language = 'zh';
    Object.assign(window.__batterySnapshot.runtime, { battery: { percentage: 10, millivolts: 3318, charging: true }, battery_error: null });
  });
  await page.getByLabel('电量: 10% · 充电中', { exact: true }).waitFor();
  await page.screenshot({ path: 'artifacts/battery-settings-zh.png', fullPage: true });
  await page.getByRole('button', { name: '键位', exact: true }).click();
  await page.screenshot({ path: 'artifacts/battery-keymap-zh.png', fullPage: true });
  await page.setViewportSize({ width: 320, height: 568 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByLabel('电量: 10% · 充电中', { exact: true }).waitFor();
  await page.screenshot({ path: 'artifacts/battery-compact-zh.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('UI smoke passed: mappings, bilingual, export/import, quit, keyboard focus, battery charging/low/unknown/voltage/error/pause states, 320px layout.');
} finally { await browser.close(); }
