// Behavior: copy.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { ORIGIN, close, launch, open } from './harness.mjs';

before(launch);
after(close);

const CLIPBOARD = { permissions: ['clipboard-read', 'clipboard-write'] };

async function clipboard(page) {
  return page.evaluate(() => navigator.clipboard.readText());
}

test('copies the value of an input target', async () => {
  const { page, context } = await open(
    '<input id="key" value="sk-123"><button id="b" data-vanilla="copy" data-vanilla-copy="#key">Copy</button>',
    { context: CLIPBOARD },
  );
  await context.grantPermissions(CLIPBOARD.permissions, { origin: ORIGIN });
  const event = page.evaluate(() => new Promise((resolve) => {
    document.addEventListener('vanilla:copied', (e) => resolve(e.detail.text), { once: true });
  }));
  await page.click('#b');
  assert.equal(await event, 'sk-123');
  assert.equal(await clipboard(page), 'sk-123');
  assert.equal(await page.getAttribute('#b', 'data-vanilla-state'), 'copied');
});

test('copies the text content of a non-field target', async () => {
  const { page, context } = await open(
    '<pre id="code">  cargo add x  </pre><button id="b" data-vanilla="copy" data-vanilla-copy="#code">Copy</button>',
    { context: CLIPBOARD },
  );
  await context.grantPermissions(CLIPBOARD.permissions, { origin: ORIGIN });
  await page.click('#b');
  await page.waitForSelector('#b[data-vanilla-state=copied]');
  assert.equal(await clipboard(page), '  cargo add x  ');
});

test('copies literal text, which wins over a selector', async () => {
  const { page, context } = await open(
    '<input id="key" value="no"><button id="b" data-vanilla="copy" data-vanilla-copy="#key" data-vanilla-copy-text="yes">Copy</button>',
    { context: CLIPBOARD },
  );
  await context.grantPermissions(CLIPBOARD.permissions, { origin: ORIGIN });
  await page.click('#b');
  await page.waitForSelector('#b[data-vanilla-state=copied]');
  assert.equal(await clipboard(page), 'yes');
});

test('works on a wrapper around the button', async () => {
  const { page, context } = await open(
    '<div id="w" data-vanilla="copy" data-vanilla-copy-text="wrapped"><button id="b">Copy</button></div>',
    { context: CLIPBOARD },
  );
  await context.grantPermissions(CLIPBOARD.permissions, { origin: ORIGIN });
  await page.click('#b');
  await page.waitForSelector('#w[data-vanilla-state=copied]');
  assert.equal(await clipboard(page), 'wrapped');
});

test('clears the state after 2 seconds', async () => {
  const { page, context } = await open(
    '<button id="b" data-vanilla="copy" data-vanilla-copy-text="t">Copy</button>',
    { context: CLIPBOARD, clock: new Date('2026-10-05T12:00:00Z') },
  );
  await context.grantPermissions(CLIPBOARD.permissions, { origin: ORIGIN });
  await page.click('#b');
  await page.waitForSelector('#b[data-vanilla-state=copied]');
  await page.clock.runFor(1999);
  assert.equal(await page.getAttribute('#b', 'data-vanilla-state'), 'copied');
  await page.clock.runFor(2);
  assert.equal(await page.getAttribute('#b', 'data-vanilla-state'), null);
});

test('an invalid or missing selector does nothing and throws nothing', async () => {
  const { page, errors } = await open(
    '<button id="bad" data-vanilla="copy" data-vanilla-copy="[[[">A</button>' +
      '<button id="gone" data-vanilla="copy" data-vanilla-copy="#nope">B</button>',
  );
  await page.click('#bad');
  await page.click('#gone');
  assert.equal(await page.getAttribute('#bad', 'data-vanilla-state'), null);
  assert.equal(await page.getAttribute('#gone', 'data-vanilla-state'), null);
  assert.deepEqual(errors, []);
});

test('sets the failed state when the clipboard rejects', async () => {
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
  assert.equal(await page.getAttribute('#b', 'data-vanilla-state'), 'failed');
});

test('falls back to execCommand when the Clipboard API is absent', async () => {
  const { page } = await open(
    '<button id="b" data-vanilla="copy" data-vanilla-copy-text="legacy">Copy</button>',
    {
      init: `Object.defineProperty(navigator, 'clipboard', { value: undefined });
             window.__copied = null;
             document.addEventListener('copy', (e) => { window.__copied = document.getSelection().toString(); });`,
    },
  );
  await page.click('#b');
  await page.waitForSelector('#b[data-vanilla-state]');
  assert.equal(await page.evaluate(() => window.__copied), 'legacy');
  assert.equal(await page.getAttribute('#b', 'data-vanilla-state'), 'copied');
  // The helper field is gone.
  assert.equal(await page.locator('textarea').count(), 0);
});

test('teardown removes the click handler', async () => {
  const { page, context } = await open(
    '<button id="b" data-vanilla="copy" data-vanilla-copy-text="t">Copy</button>',
    { context: CLIPBOARD },
  );
  await context.grantPermissions(CLIPBOARD.permissions, { origin: ORIGIN });
  await page.evaluate(() => Vanilla.teardown(document.getElementById('b')));
  await page.click('#b');
  await page.waitForTimeout(50);
  assert.equal(await page.getAttribute('#b', 'data-vanilla-state'), null);
});
