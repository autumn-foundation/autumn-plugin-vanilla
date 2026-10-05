// Behavior: local-time.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { close, launch, open } from './harness.mjs';

before(launch);
after(close);

const NY = { context: { locale: 'en-US', timezoneId: 'America/New_York' } };
const AT = '2026-10-05T12:00:00Z'; // 08:00 in New York (EDT).

const time = (fmt, value = AT, fallback = 'server text') =>
  `<time id="t" datetime="${value}" data-vanilla="local-time"${fmt ? ` data-vanilla-local-time="${fmt}"` : ''}>${fallback}</time>`;

const norm = (s) => s.replace(/\s/g, ' ');

test('formats date and time in the browser time zone by default', async () => {
  const { page } = await open(time(null), NY);
  assert.equal(norm(await page.textContent('#t')), 'Oct 5, 2026, 8:00 AM');
  assert.equal(await page.getAttribute('#t', 'title'), 'server text', 'keeps the server text as a title');
});

test('formats date only and time only', async () => {
  const { page } = await open(
    `${time('date')}<time id="u" datetime="${AT}" data-vanilla="local-time" data-vanilla-local-time="time">x</time>`,
    NY,
  );
  assert.equal(norm(await page.textContent('#t')), 'Oct 5, 2026');
  assert.equal(norm(await page.textContent('#u')), '8:00 AM');
});

test('formats relative time', async () => {
  const { page } = await open(
    `${time('relative', '2026-10-05T10:00:00Z')}<time id="u" datetime="2026-10-08T12:00:00Z" data-vanilla="local-time" data-vanilla-local-time="relative">x</time>` +
      '<time id="v" datetime="2026-10-05T11:59:30Z" data-vanilla="local-time" data-vanilla-local-time="relative">x</time>',
    { ...NY, clock: new Date(AT) },
  );
  assert.equal(await page.textContent('#t'), '2 hours ago');
  assert.equal(await page.textContent('#u'), 'in 3 days');
  assert.equal(await page.textContent('#v'), '30 seconds ago');
});

test('uses the nearest lang attribute', async () => {
  const { page } = await open(`<div lang="de">${time('date')}</div>`, NY);
  assert.equal(norm(await page.textContent('#t')), '05.10.2026');
});

test('formats each time element inside a wrapper', async () => {
  const { page } = await open(
    `<ul data-vanilla="local-time" data-vanilla-local-time="date"><li><time datetime="${AT}">a</time></li><li><time datetime="2026-01-02T12:00:00Z">b</time></li><li><time>no datetime</time></li></ul>`,
    NY,
  );
  const texts = await page.$$eval('time', (ts) => ts.map((t) => t.textContent.replace(/\s/g, ' ')));
  assert.deepEqual(texts, ['Oct 5, 2026', 'Jan 2, 2026', 'no datetime']);
});

test('keeps the server text for an invalid datetime', async () => {
  const { page, errors } = await open(time(null, 'not-a-date'), NY);
  assert.equal(await page.textContent('#t'), 'server text');
  assert.deepEqual(errors, []);
});

test('an unknown format falls back to date and time', async () => {
  const { page } = await open(time('weird'), NY);
  assert.equal(norm(await page.textContent('#t')), 'Oct 5, 2026, 8:00 AM');
});

test('a date without a time shows the same calendar day', async () => {
  const { page } = await open(time('date', '2026-10-05'), NY);
  assert.equal(norm(await page.textContent('#t')), 'Oct 5, 2026');
});

test('keeps an existing title', async () => {
  const { page } = await open(
    `<time id="t" datetime="${AT}" title="mine" data-vanilla="local-time">server</time>`,
    NY,
  );
  assert.equal(await page.getAttribute('#t', 'title'), 'mine');
});

test('an invalid lang falls back to the browser locale', async () => {
  const { page, errors } = await open(`<div lang="not a locale!">${time('date')}</div>`, NY);
  assert.equal(norm(await page.textContent('#t')), 'Oct 5, 2026');
  assert.deepEqual(errors, []);
});

test('relative time picks the larger unit at the edges', async () => {
  const { page } = await open(
    time('relative', '2026-10-04T12:20:00Z') +
      '<time id="u" datetime="2024-10-05T12:00:00Z" data-vanilla="local-time" data-vanilla-local-time="relative">x</time>',
    { ...NY, clock: new Date(AT) },
  );
  assert.equal(await page.textContent('#t'), 'yesterday', '23h40m ago');
  assert.equal(await page.textContent('#u'), '2 years ago');
});

test('a time that htmx adds inside a wrapper is formatted', async () => {
  const { page } = await open('<ul id="w" data-vanilla="local-time" data-vanilla-local-time="date"></ul>', NY);
  await page.evaluate((at) => {
    const li = document.createElement('li');
    const t = document.createElement('time');
    t.id = 't';
    t.setAttribute('datetime', at);
    t.textContent = 'SERVER';
    li.append(t);
    document.getElementById('w').append(li);
    li.dispatchEvent(new CustomEvent('htmx:load', { bubbles: true, detail: { elt: li } }));
  }, AT);
  assert.equal(norm(await page.textContent('#t')), 'Oct 5, 2026');
});
