// Behavior: autosubmit.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { close, launch, open } from './harness.mjs';

before(launch);
after(close);

const CLOCK = new Date('2026-10-05T12:00:00Z');
const COUNT_SUBMITS = "window.__submits = 0; document.getElementById('f').addEventListener('submit', (e) => { window.__submits += 1; e.preventDefault(); });";
const submits = (page) => page.evaluate(() => window.__submits);

test('submits the form when a select changes', async () => {
  const { page, requests } = await open(
    '<form action="/submit" data-vanilla="autosubmit"><select id="s" name="sort"><option>a</option><option>b</option></select></form>',
  );
  await Promise.all([page.waitForURL('**/submit?sort=b'), page.selectOption('#s', 'b')]);
  assert.deepEqual(requests, ['/submit?sort=b']);
});

test('submits through requestSubmit, so submit handlers run', async () => {
  const { page } = await open(
    '<form id="f" action="/submit" data-vanilla="autosubmit"><input id="c" type="checkbox" name="on"></form>',
    {
      scripts: {
        '/app.js': `window.__submits = 0;
          document.getElementById('f').addEventListener('submit', (e) => { window.__submits += 1; e.preventDefault(); });`,
      },
    },
  );
  await page.check('#c');
  assert.equal(await page.evaluate(() => window.__submits), 1);
});

test('works on a wrapper inside the form', async () => {
  const { page, requests } = await open(
    '<form action="/submit"><div data-vanilla="autosubmit"><input id="c" type="checkbox" name="on"></div></form>',
  );
  await Promise.all([page.waitForURL('**/submit?on=on'), page.check('#c')]);
  assert.deepEqual(requests, ['/submit?on=on']);
});

test('ignores typing unless input mode is on', async () => {
  const { page } = await open(
    '<form id="f" action="/submit" data-vanilla="autosubmit"><input id="q" name="q"></form>',
    { scripts: { '/app.js': "window.__submits = 0; document.getElementById('f').addEventListener('submit', (e) => { window.__submits += 1; e.preventDefault(); });" } },
  );
  await page.type('#q', 'abc');
  assert.equal(await page.evaluate(() => window.__submits), 0);
});

test('input mode debounces by the delay', async () => {
  const { page } = await open(
    '<form id="f" action="/submit" data-vanilla="autosubmit" data-vanilla-autosubmit-on="input" data-vanilla-autosubmit-delay="300"><input id="q" name="q"></form>',
    { clock: CLOCK, scripts: { '/app.js': COUNT_SUBMITS } },
  );
  await page.type('#q', 'a');
  await page.clock.runFor(200);
  await page.type('#q', 'b');
  await page.clock.runFor(200);
  assert.equal(await submits(page), 0, 'each key press restarts the delay');
  await page.clock.runFor(101);
  assert.equal(await submits(page), 1);
});

test('a field outside any form does nothing', async () => {
  const { page, errors } = await open('<div data-vanilla="autosubmit"><input id="c" type="checkbox"></div>');
  await page.check('#c');
  assert.deepEqual(errors, []);
});

test('teardown cancels a pending submit', async () => {
  const { page } = await open(
    '<form id="f" action="/submit" data-vanilla="autosubmit" data-vanilla-autosubmit-delay="500"><input id="c" type="checkbox"></form>',
    {
      clock: CLOCK,
      scripts: { '/app.js': "window.__submits = 0; document.getElementById('f').addEventListener('submit', (e) => { window.__submits += 1; e.preventDefault(); });" },
    },
  );
  await page.check('#c');
  await page.evaluate(() => Vanilla.teardown(document.getElementById('f')));
  await page.clock.runFor(1000);
  assert.equal(await page.evaluate(() => window.__submits), 0);
});

test('Enter in a text field submits one time, not two', async () => {
  const { page } = await open(
    '<form id="f" action="/submit" data-vanilla="autosubmit"><input id="q" name="q"><button>Go</button></form>',
    { scripts: { '/app.js': COUNT_SUBMITS } },
  );
  await page.type('#q', 'abc');
  await page.press('#q', 'Enter');
  assert.equal(await submits(page), 1);
});

test('an invalid form does not submit and focus stays', async () => {
  const { page } = await open(
    '<form id="f" action="/submit" data-vanilla="autosubmit" data-vanilla-autosubmit-on="input">' +
      '<input id="q" name="q"><input id="e" type="email" required></form>',
    { scripts: { '/app.js': COUNT_SUBMITS } },
  );
  await page.type('#q', 'abc');
  assert.equal(await submits(page), 0);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'q');
});

test('does not submit a form outside the element', async () => {
  const { page } = await open(
    '<form id="f" action="/submit"></form><div data-vanilla="autosubmit"><input id="c" type="checkbox" form="f"></div>',
    { scripts: { '/app.js': COUNT_SUBMITS } },
  );
  await page.check('#c');
  assert.equal(await submits(page), 0);
});

test('accepts change and input together, and ignores other event names', async () => {
  const { page } = await open(
    '<form id="f" action="/submit" data-vanilla="autosubmit" data-vanilla-autosubmit-on="input change click">' +
      '<input id="q" name="q"><input id="c" type="checkbox"></form>',
    { scripts: { '/app.js': COUNT_SUBMITS } },
  );
  await page.type('#q', 'a');
  assert.equal(await submits(page), 1, 'input');
  await page.click('#c');
  // A checkbox click sends input and change: two submits. The click name is ignored.
  assert.equal(await submits(page), 3);
});
