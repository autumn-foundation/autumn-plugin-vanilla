// Behavior: dismiss.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { close, launch, open } from './harness.mjs';

before(launch);
after(close);

const CLOCK = new Date('2026-10-05T12:00:00Z');

test('a close control removes the element', async () => {
  const { page } = await open(
    '<div id="f" data-vanilla="dismiss" role="status">Saved <button id="x" data-vanilla-dismiss-close>×</button></div>',
  );
  await page.click('#x');
  assert.equal(await page.locator('#f').count(), 0);
});

test('a click outside a close control does not remove the element', async () => {
  const { page } = await open('<div id="f" data-vanilla="dismiss"><span id="t">Saved</span></div>');
  await page.click('#t');
  assert.equal(await page.locator('#f').count(), 1);
});

test('a cancelled vanilla:dismiss event keeps the element', async () => {
  const { page } = await open(
    '<div id="f" data-vanilla="dismiss">Saved <button id="x" data-vanilla-dismiss-close>×</button></div>',
    { scripts: { '/app.js': "document.addEventListener('vanilla:dismiss', (e) => e.preventDefault());" } },
  );
  await page.click('#x');
  assert.equal(await page.locator('#f').count(), 1);
});

test('removes the element after the given time', async () => {
  const { page } = await open('<div id="f" data-vanilla="dismiss" data-vanilla-dismiss-after="3000">Saved</div>', {
    clock: CLOCK,
  });
  await page.clock.runFor(2999);
  assert.equal(await page.locator('#f').count(), 1);
  await page.clock.runFor(2);
  assert.equal(await page.locator('#f').count(), 0);
});

test('pauses the timer while the pointer or focus is inside', async () => {
  const { page } = await open(
    '<div id="f" data-vanilla="dismiss" data-vanilla-dismiss-after="1000">Saved <button id="x">ok</button></div><p id="away">away</p>',
    { clock: CLOCK },
  );
  await page.hover('#f');
  await page.clock.runFor(5000);
  assert.equal(await page.locator('#f').count(), 1, 'hover pauses');
  await page.hover('#away');
  await page.focus('#x');
  await page.clock.runFor(5000);
  assert.equal(await page.locator('#f').count(), 1, 'focus pauses');
  await page.evaluate(() => document.getElementById('x').blur());
  await page.clock.runFor(1001);
  assert.equal(await page.locator('#f').count(), 0, 'timer restarts when both leave');
});

test('ignores invalid times', async () => {
  const { page } = await open(
    ['abc', '-5', '0', '1e3', ''].map((v, i) => `<div id="f${i}" data-vanilla="dismiss" data-vanilla-dismiss-after="${v}">x</div>`).join(''),
    { clock: CLOCK },
  );
  await page.clock.runFor(60000);
  assert.equal(await page.locator('[data-vanilla=dismiss]').count(), 5);
});

test('teardown cancels the timer', async () => {
  const { page } = await open('<div id="f" data-vanilla="dismiss" data-vanilla-dismiss-after="1000">Saved</div>', {
    clock: CLOCK,
  });
  await page.evaluate(() => Vanilla.teardown(document.getElementById('f')));
  await page.clock.runFor(5000);
  assert.equal(await page.locator('#f').count(), 1);
});

test('runs cleanup for the element and its children on removal', async () => {
  const { page } = await open(
    '<div id="f" data-vanilla="dismiss"><b data-vanilla="probe"></b><button id="x" data-vanilla-dismiss-close>×</button></div>',
    {
      scripts: {
        '/app.js': "window.__cleaned = 0; Vanilla.register('probe', () => () => { window.__cleaned += 1; });",
      },
    },
  );
  await page.click('#x');
  assert.equal(await page.evaluate(() => window.__cleaned), 1);
});
