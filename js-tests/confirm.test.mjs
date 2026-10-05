// Behavior: confirm.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { close, launch, open } from './harness.mjs';

before(launch);
after(close);

const FORM = (attrs) =>
  `<form id="f" action="/submit" method="get" ${attrs}><input name="q" value="1"><button id="go">Delete</button></form>`;

/** Answers the next dialog and records its message. */
function answer(page, accept) {
  return new Promise((resolve) => {
    page.once('dialog', async (dialog) => {
      const message = dialog.message();
      if (accept) await dialog.accept();
      else await dialog.dismiss();
      resolve(message);
    });
  });
}

test('a dismissed dialog stops the form submit', async () => {
  const { page, requests } = await open(FORM('data-vanilla="confirm" data-vanilla-confirm="Delete it?"'));
  const message = answer(page, false);
  await page.click('#go');
  assert.equal(await message, 'Delete it?');
  await page.waitForTimeout(100);
  assert.deepEqual(requests, []);
});

test('an accepted dialog lets the form submit', async () => {
  const { page, requests } = await open(FORM('data-vanilla="confirm" data-vanilla-confirm="Delete it?"'));
  const message = answer(page, true);
  await Promise.all([page.waitForURL('**/submit?q=1'), page.click('#go')]);
  assert.equal(await message, 'Delete it?');
  assert.deepEqual(requests, ['/submit?q=1']);
});

test('uses a default message', async () => {
  const { page } = await open(FORM('data-vanilla="confirm"'));
  const message = answer(page, false);
  await page.click('#go');
  assert.equal(await message, 'Are you sure?');
});

test('runs before other submit handlers on the form (such as htmx)', async () => {
  const { page } = await open(FORM('data-vanilla="confirm"'), {
    before: {
      '/htmx-like.js': `window.__handled = 0;
        document.addEventListener('DOMContentLoaded', function () {
          document.getElementById('f').addEventListener('submit', function (e) {
            window.__handled += 1; e.preventDefault();
          });
        });`,
    },
  });
  const message = answer(page, false);
  await page.click('#go');
  await message;
  assert.equal(await page.evaluate(() => window.__handled), 0);
});

test('works on a wrapper around forms and links', async () => {
  const { page, requests } = await open(
    `<div data-vanilla="confirm" data-vanilla-confirm="Leave?">${FORM('')}<a id="l" href="/submit-link">go</a><span id="s">text</span></div>`,
  );
  let asked = 0;
  page.on('dialog', async (d) => { asked += 1; await d.dismiss(); });
  await page.click('#s');
  await page.click('#l');
  await page.click('#go');
  await page.waitForTimeout(100);
  assert.equal(asked, 2, 'asks for the link and the form, not the text');
  assert.deepEqual(requests, []);
});

test('an accepted dialog lets a link navigate', async () => {
  const { page, requests } = await open('<a id="l" href="/submit-link" data-vanilla="confirm">go</a>');
  const message = answer(page, true);
  await Promise.all([page.waitForURL('**/submit-link'), page.click('#l')]);
  await message;
  assert.deepEqual(requests, ['/submit-link']);
});

test('teardown removes the handlers', async () => {
  const { page, requests } = await open(FORM('data-vanilla="confirm"'));
  await page.evaluate(() => Vanilla.teardown(document.getElementById('f')));
  await Promise.all([page.waitForURL('**/submit?q=1'), page.click('#go')]);
  assert.deepEqual(requests, ['/submit?q=1']);
});
