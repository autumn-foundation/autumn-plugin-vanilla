// Behavior: copy.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { ORIGIN, close, launch, open } from './harness.mjs';

before(launch);
after(close);

const CLIPBOARD = { permissions: ['clipboard-read', 'clipboard-write'] };
const CLOCK = new Date('2026-10-05T12:00:00Z');

async function openWithClipboard(body, options = {}) {
  const result = await open(body, { ...options, context: CLIPBOARD });
  await result.context.grantPermissions(CLIPBOARD.permissions, { origin: ORIGIN });
  return result;
}

const clipboard = (page) => page.evaluate(() => navigator.clipboard.readText());
const live = (page) => page.textContent('[data-vanilla-live]');
const state = (page, sel) => page.getAttribute(sel, 'data-vanilla-state');

test('copies the value of an input target and announces it', async () => {
  const { page } = await openWithClipboard(
    '<input id="key" value="sk-123"><button id="b" data-vanilla="copy" data-vanilla-copy="#key">Copy</button>',
  );
  const event = page.evaluate(() => new Promise((resolve) => {
    document.addEventListener('vanilla:copied', (e) => resolve(e.detail), { once: true });
  }));
  await page.click('#b');
  assert.equal(await event, null, 'the event does not carry the copied text');
  assert.equal(await clipboard(page), 'sk-123');
  assert.equal(await state(page, '#b'), 'copied');
  assert.equal(await live(page), 'Copied');
  assert.equal(await page.getAttribute('[data-vanilla-live]', 'role'), 'status');
});

test('uses custom screen reader messages', async () => {
  const { page } = await openWithClipboard(
    '<button id="b" data-vanilla="copy" data-vanilla-copy-text="t" data-vanilla-copy-done="Kopiert">Copy</button>',
  );
  await page.click('#b');
  await page.waitForSelector('#b[data-vanilla-state=copied]');
  assert.equal(await live(page), 'Kopiert');
});

test('copies the text content of a non-field target', async () => {
  const { page } = await openWithClipboard(
    '<pre id="code">  cargo add x  </pre><button id="b" data-vanilla="copy" data-vanilla-copy="#code">Copy</button>',
  );
  await page.click('#b');
  await page.waitForSelector('#b[data-vanilla-state=copied]');
  assert.equal(await clipboard(page), '  cargo add x  ');
});

test('copies literal text, which has priority over a selector', async () => {
  const { page } = await openWithClipboard(
    '<input id="key" value="no"><button id="b" data-vanilla="copy" data-vanilla-copy="#key" data-vanilla-copy-text="yes">Copy</button>',
  );
  await page.click('#b');
  await page.waitForSelector('#b[data-vanilla-state=copied]');
  assert.equal(await clipboard(page), 'yes');
});

test('never copies a password field or a hidden field', async () => {
  const { page } = await openWithClipboard(
    '<input id="pw" type="password" value="hunter2"><input id="h" type="hidden" value="csrf">' +
      '<button id="a" data-vanilla="copy" data-vanilla-copy="#pw">A</button>' +
      '<button id="b" data-vanilla="copy" data-vanilla-copy="#h">B</button>' +
      '<button id="ok" data-vanilla="copy" data-vanilla-copy-text="control">OK</button>',
  );
  await page.click('#a');
  await page.click('#b');
  await page.click('#ok');
  await page.waitForSelector('#ok[data-vanilla-state=copied]');
  assert.equal(await clipboard(page), 'control', 'only the control copied');
  assert.equal(await state(page, '#a'), null);
  assert.equal(await state(page, '#b'), null);
});

test('works on a wrapper around the button', async () => {
  const { page } = await openWithClipboard(
    '<div id="w" data-vanilla="copy" data-vanilla-copy-text="wrapped"><button id="b">Copy</button></div>',
  );
  await page.click('#b');
  await page.waitForSelector('#w[data-vanilla-state=copied]');
  assert.equal(await clipboard(page), 'wrapped');
});

test('clears the state and the announcement after 2 seconds', async () => {
  const { page } = await openWithClipboard(
    '<button id="b" data-vanilla="copy" data-vanilla-copy-text="t">Copy</button>',
    { clock: CLOCK },
  );
  await page.click('#b');
  await page.waitForSelector('#b[data-vanilla-state=copied]');
  await page.clock.runFor(1999);
  assert.equal(await state(page, '#b'), 'copied');
  await page.clock.runFor(2);
  assert.equal(await state(page, '#b'), null);
  assert.equal(await live(page), '');
});

test('a second click restarts the 2 second timer', async () => {
  const { page } = await openWithClipboard(
    '<button id="b" data-vanilla="copy" data-vanilla-copy-text="t">Copy</button>',
    { clock: CLOCK },
  );
  await page.click('#b');
  await page.waitForSelector('#b[data-vanilla-state=copied]');
  await page.clock.runFor(1500);
  const second = page.evaluate(() => new Promise((resolve) => {
    document.addEventListener('vanilla:copied', () => resolve(), { once: true });
  }));
  await page.click('#b');
  await second;
  await page.clock.runFor(1500);
  assert.equal(await state(page, '#b'), 'copied', '1.5 s after the second click');
  await page.clock.runFor(501);
  assert.equal(await state(page, '#b'), null);
});

test('an invalid or missing selector does nothing and throws nothing', async () => {
  const { page, errors } = await open(
    '<button id="bad" data-vanilla="copy" data-vanilla-copy="[[[">A</button>' +
      '<button id="gone" data-vanilla="copy" data-vanilla-copy="#nope">B</button>',
  );
  await page.click('#bad');
  await page.click('#gone');
  assert.equal(await state(page, '#bad'), null);
  assert.equal(await state(page, '#gone'), null);
  assert.deepEqual(errors, []);
});

test('sets the failed state when both copy paths fail', async () => {
  const { page } = await open(
    '<button id="b" data-vanilla="copy" data-vanilla-copy-text="t">Copy</button>',
    {
      init: `Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) } });
             document.execCommand = () => false;`,
    },
  );
  const failed = page.evaluate(() => new Promise((resolve) => {
    document.addEventListener('vanilla:copy-failed', () => resolve(true), { once: true });
  }));
  await page.click('#b');
  assert.equal(await failed, true);
  assert.equal(await state(page, '#b'), 'failed');
  assert.equal(await live(page), 'Copy failed');
});

test('falls back to execCommand when the Clipboard API rejects', async () => {
  const { page } = await open(
    '<button id="b" data-vanilla="copy" data-vanilla-copy-text="t">Copy</button>',
    {
      init: `Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) } });
             document.execCommand = () => true;`,
    },
  );
  await page.click('#b');
  await page.waitForSelector('#b[data-vanilla-state]');
  assert.equal(await state(page, '#b'), 'copied');
});

test('falls back to execCommand when the Clipboard API is absent, and keeps focus', async () => {
  const { page } = await open(
    '<button id="b" data-vanilla="copy" data-vanilla-copy-text="legacy">Copy</button>',
    {
      init: `Object.defineProperty(navigator, 'clipboard', { value: undefined });
             window.__copied = null;
             document.addEventListener('copy', (e) => { window.__copied = e.target.value; });`,
    },
  );
  await page.click('#b');
  await page.waitForSelector('#b[data-vanilla-state]');
  assert.equal(await page.evaluate(() => window.__copied), 'legacy');
  assert.equal(await state(page, '#b'), 'copied');
  assert.equal(await page.locator('textarea').count(), 0, 'the helper field is gone');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'b', 'focus returns to the button');
});

test('teardown removes the click handler', async () => {
  const { page } = await openWithClipboard(
    '<button id="b" data-vanilla="copy" data-vanilla-copy-text="t">Copy</button>' +
      '<button id="ok" data-vanilla="copy" data-vanilla-copy-text="control">OK</button>',
  );
  await page.evaluate(() => Vanilla.teardown(document.getElementById('b')));
  await page.click('#b');
  await page.click('#ok');
  await page.waitForSelector('#ok[data-vanilla-state=copied]');
  assert.equal(await state(page, '#b'), null);
  assert.equal(await clipboard(page), 'control');
});

test('a copy that settles after teardown changes nothing', async () => {
  const { page } = await open(
    '<button id="b" data-vanilla="copy" data-vanilla-copy-text="t">Copy</button>',
    {
      init: `Object.defineProperty(navigator, 'clipboard', {
               value: { writeText: () => new Promise((resolve) => { window.__resolve = resolve; }) },
             });`,
    },
  );
  await page.click('#b');
  await page.evaluate(async () => {
    Vanilla.teardown(document.getElementById('b'));
    window.__resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  assert.equal(await state(page, '#b'), null);
});
