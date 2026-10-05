// Behavior: toggle.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { close, launch, open } from './harness.mjs';

before(launch);
after(close);

test('toggles hidden on the target and syncs aria-expanded', async () => {
  const { page } = await open(
    '<button id="b" data-vanilla="toggle" data-vanilla-toggle="#menu">Menu</button><nav id="menu" hidden>x</nav>',
  );
  assert.equal(await page.getAttribute('#b', 'aria-expanded'), 'false', 'initial state from the target');
  await page.click('#b');
  assert.equal(await page.evaluate(() => document.getElementById('menu').hidden), false);
  assert.equal(await page.getAttribute('#b', 'aria-expanded'), 'true');
  await page.click('#b');
  assert.equal(await page.evaluate(() => document.getElementById('menu').hidden), true);
  assert.equal(await page.getAttribute('#b', 'aria-expanded'), 'false');
});

test('reads an open target as expanded at bind time', async () => {
  const { page } = await open(
    '<button id="b" data-vanilla="toggle" data-vanilla-toggle="#menu">Menu</button><nav id="menu">x</nav>',
  );
  assert.equal(await page.getAttribute('#b', 'aria-expanded'), 'true');
});

test('toggles a class when one is given', async () => {
  const { page } = await open(
    '<button id="b" data-vanilla="toggle" data-vanilla-toggle="#p" data-vanilla-toggle-class="open">T</button><div id="p"></div>',
  );
  assert.equal(await page.getAttribute('#b', 'aria-expanded'), 'false');
  await page.click('#b');
  assert.equal(await page.getAttribute('#p', 'class'), 'open');
  assert.equal(await page.getAttribute('#b', 'aria-expanded'), 'true');
  await page.click('#b');
  assert.equal(await page.getAttribute('#p', 'class'), '');
});

test('toggles all matched targets', async () => {
  const { page } = await open(
    '<button id="b" data-vanilla="toggle" data-vanilla-toggle=".row">T</button><p class="row" hidden></p><p class="row" hidden></p>',
  );
  await page.click('#b');
  const hidden = await page.evaluate(() => [...document.querySelectorAll('.row')].map((p) => p.hidden));
  assert.deepEqual(hidden, [false, false]);
});

test('an invalid selector does nothing and other behaviors still work', async () => {
  const { page, errors } = await open(
    '<button id="bad" data-vanilla="toggle" data-vanilla-toggle="[[[">B</button>' +
      '<button id="ok" data-vanilla="toggle" data-vanilla-toggle="#m">OK</button><div id="m" hidden></div>',
  );
  await page.click('#bad');
  await page.click('#ok');
  assert.equal(await page.getAttribute('#bad', 'aria-expanded'), null);
  assert.equal(await page.evaluate(() => document.getElementById('m').hidden), false);
  assert.deepEqual(errors, []);
});

test('teardown removes the click handler', async () => {
  const { page } = await open(
    '<button id="b" data-vanilla="toggle" data-vanilla-toggle="#m">T</button><div id="m" hidden></div>',
  );
  await page.evaluate(() => Vanilla.teardown(document.getElementById('b')));
  await page.click('#b');
  assert.equal(await page.evaluate(() => document.getElementById('m').hidden), true);
});
