// End-to-end: the real demo server, real htmx, Autumn default CSP, SRI.
//
// Build first: `cargo build --example vanilla_demo`. Then `npm run test:e2e`.
// Set DEMO_BIN to use another binary path.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BIN = process.env.DEMO_BIN
  ?? fileURLToPath(new URL('../../target/debug/examples/vanilla_demo', import.meta.url));
const PORT = 4000 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;

let server;
let browser;

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`${BASE}/`);
      if (res.ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`demo server did not start on ${BASE}`);
}

before(async () => {
  assert.ok(existsSync(BIN), `build the demo first: cargo build --example vanilla_demo (${BIN})`);
  server = spawn(BIN, [], {
    env: { ...process.env, AUTUMN_SERVER__PORT: String(PORT), AUTUMN_SERVER__HOST: '127.0.0.1' },
    stdio: 'ignore',
  });
  await waitForServer();
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  server?.kill();
});

async function openDemo() {
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(() => {
    window.__violations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__violations.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  await page.goto(`${BASE}/`);
  return { page, errors };
}

test('the page loads the runtime under the default CSP with SRI', async () => {
  const { page, errors } = await openDemo();
  const state = await page.evaluate(() => ({
    names: window.Vanilla && window.Vanilla.names(),
    violations: window.__violations,
    sri: document.querySelector('script[src*="_plugins/vanilla/"]').integrity.startsWith('sha384-'),
  }));
  assert.deepEqual(state.violations, []);
  assert.ok(state.sri, 'the script tag has an SRI hash');
  assert.deepEqual(state.names, [
    'autosubmit', 'confirm', 'copy', 'count', 'dismiss', 'greet', 'local-time', 'toggle',
  ]);
  assert.deepEqual(errors, []);
});

test('copy, toggle and count work on the server page', async () => {
  const { page } = await openDemo();
  await page.click('#copy button');
  await page.waitForSelector('#copy button[data-vanilla-state=copied]');
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'sk-demo-123');

  const details = page.locator('#toggle button').first();
  assert.equal(await details.getAttribute('aria-expanded'), 'false');
  await details.click();
  assert.equal(await page.isVisible('#details'), true);
  assert.equal(await details.getAttribute('aria-expanded'), 'true');

  assert.equal(await page.textContent('#count output'), '140');
  await page.type('#bio', 'hello');
  assert.equal(await page.textContent('#count output'), '135');
});

test('local-time replaces the server text', async () => {
  const { page } = await openDemo();
  const texts = await page.$$eval('#local-time time', (ts) => ts.map((t) => [t.textContent, t.title]));
  assert.equal(texts.length, 2);
  assert.match(texts[0][0], /now|second|minute/);
  for (const [text, title] of texts) {
    assert.ok(!text.endsWith(' UTC'), `formatted: ${text}`);
    assert.ok(title.endsWith(' UTC'), `server text kept as title: ${title}`);
  }
});

test('htmx content binds, and removed content cleans up', async () => {
  const { page } = await openDemo();
  assert.deepEqual(await page.evaluate(() => window.demoStats), { binds: 1, cleanups: 0 });
  await page.click('#add-greeting');
  await page.waitForFunction(() => window.demoStats.binds === 2);
  await page.click('#add-greeting');
  await page.waitForFunction(() => window.demoStats.binds === 3);
  const texts = await page.$$eval('#greetings p', (ps) => ps.map((p) => p.textContent));
  assert.equal(texts.length, 3);
  assert.ok(texts.every((t) => t.startsWith('Hello, ')), texts.join());
  await page.click('#clear-greetings');
  await page.waitForFunction(() => window.demoStats.cleanups === 3);
  assert.equal(await page.locator('#greetings p').count(), 0);
});

test('an htmx flash binds dismiss and copy', async () => {
  const { page } = await openDemo();
  await page.click('#add-flash');
  const flash = page.locator('#flashes > div').nth(1);
  await flash.waitFor();
  await flash.locator('button', { hasText: 'Copy id' }).click();
  await page.waitForSelector('#flashes button[data-vanilla-state=copied]');
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /^flash-\d+$/);
  await flash.locator('button', { hasText: 'Close' }).click();
  assert.equal(await page.locator('#flashes > div').count(), 1);
});

test('confirm stops a cancelled submit and allows an accepted one', async () => {
  const { page } = await openDemo();
  page.once('dialog', (d) => d.dismiss());
  await page.click('#delete');
  await page.waitForTimeout(200);
  assert.equal(new URL(page.url()).pathname, '/');
  page.once('dialog', (d) => d.accept());
  await Promise.all([page.waitForURL((url) => url.pathname === '/deleted'), page.click('#delete')]);
  assert.equal(await page.textContent('#deleted'), 'Deleted.');
});

test('autosubmit submits through htmx', async () => {
  const { page } = await openDemo();
  await page.selectOption('#sort', 'old');
  await page.waitForFunction(() => document.getElementById('results').textContent === 'Sort: old');
  assert.equal(new URL(page.url()).pathname, '/', 'htmx handled the submit, no navigation');
});
