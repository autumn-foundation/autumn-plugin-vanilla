// Behavior: count.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { close, launch, open } from './harness.mjs';

before(launch);
after(close);

const text = (page, sel) => page.textContent(sel);

test('shows used/max at bind time and on input', async () => {
  const { page } = await open(
    '<div data-vanilla="count"><textarea id="t" maxlength="10"></textarea><output id="o" data-vanilla-count-output></output></div>',
  );
  assert.equal(await text(page, '#o'), '0/10');
  await page.type('#t', 'abc');
  assert.equal(await text(page, '#o'), '3/10');
});

test('shows the remaining count in remaining mode', async () => {
  const { page } = await open(
    '<div data-vanilla="count" data-vanilla-count-mode="remaining"><input id="t" maxlength="10" value="ab"><span id="o" data-vanilla-count-output></span></div>',
  );
  assert.equal(await text(page, '#o'), '8');
  await page.type('#t', 'c');
  assert.equal(await text(page, '#o'), '7');
});

test('shows the plain count with no maxlength', async () => {
  const { page } = await open(
    '<div data-vanilla="count" data-vanilla-count-mode="remaining"><textarea id="t"></textarea><span id="o" data-vanilla-count-output></span></div>',
  );
  await page.type('#t', 'abcd');
  assert.equal(await text(page, '#o'), '4');
});

test('counts UTF-16 code units, as maxlength does', async () => {
  const { page } = await open(
    '<div data-vanilla="count"><input id="t" maxlength="5"><span id="o" data-vanilla-count-output></span></div>',
  );
  await page.fill('#t', '😀');
  assert.equal(await text(page, '#o'), '2/5');
});

test('works on the field itself with an output selector', async () => {
  const { page } = await open(
    '<textarea id="t" maxlength="20" data-vanilla="count" data-vanilla-count="#o"></textarea><p id="o"></p>',
  );
  await page.type('#t', 'hello');
  assert.equal(await text(page, '#o'), '5/20');
});

test('updates after a form reset', async () => {
  const { page } = await open(
    '<form id="f"><div data-vanilla="count"><input id="t" maxlength="9"><span id="o" data-vanilla-count-output></span></div></form>',
  );
  await page.type('#t', 'abc');
  await page.evaluate(() => document.getElementById('f').reset());
  await page.waitForFunction(() => document.getElementById('o').textContent === '0/9');
});

test('a missing field or output does nothing', async () => {
  const { page, errors } = await open(
    '<div data-vanilla="count"><span data-vanilla-count-output></span></div>' +
      '<textarea data-vanilla="count" data-vanilla-count="[[["></textarea>',
  );
  await page.type('textarea', 'x');
  assert.deepEqual(errors, []);
});

test('teardown stops updates', async () => {
  const { page } = await open(
    '<div id="w" data-vanilla="count"><input id="t" maxlength="9"><span id="o" data-vanilla-count-output></span></div>',
  );
  await page.evaluate(() => Vanilla.teardown(document.getElementById('w')));
  await page.type('#t', 'abc');
  assert.equal(await text(page, '#o'), '0/9');
});
