// Runtime contract: register, scan, teardown, htmx hooks, error isolation.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { close, launch, open } from './harness.mjs';

before(launch);
after(close);

// An app behavior that counts binds and cleanups on `window.__probe`.
const PROBE = `
window.__probe = { binds: 0, cleanups: 0 };
Vanilla.register('probe', function (el) {
  window.__probe.binds += 1;
  el.setAttribute('data-probe', 'bound');
  return function () { window.__probe.cleanups += 1; };
});
`;

test('exposes the public API and the 7 built-in behaviors', async () => {
  const { page, errors, violations } = await open('<p>hi</p>');
  const api = await page.evaluate(() => ({
    register: typeof Vanilla.register,
    scan: typeof Vanilla.scan,
    teardown: typeof Vanilla.teardown,
    names: Vanilla.names(),
  }));
  assert.deepEqual(api, {
    register: 'function',
    scan: 'function',
    teardown: 'function',
    names: ['autosubmit', 'confirm', 'copy', 'count', 'dismiss', 'local-time', 'toggle'],
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(violations, [], 'vanilla.js runs under script-src self');
});

test('binds each element one time only', async () => {
  const { page } = await open('<div id="a" data-vanilla="probe"></div>', {
    scripts: { '/app.js': PROBE },
  });
  const binds = await page.evaluate(() => {
    Vanilla.scan(document);
    Vanilla.scan(document.body);
    document.body.dispatchEvent(new CustomEvent('htmx:load', { bubbles: true, detail: { elt: document.body } }));
    return window.__probe.binds;
  });
  assert.equal(binds, 1);
});

test('binds new content on htmx:load', async () => {
  const { page } = await open('<div id="target"></div>', { scripts: { '/app.js': PROBE } });
  const state = await page.evaluate(() => {
    const el = document.createElement('section');
    el.innerHTML = '<span data-vanilla="probe"></span><span data-vanilla="probe"></span>';
    document.getElementById('target').append(el);
    el.dispatchEvent(new CustomEvent('htmx:load', { bubbles: true, detail: { elt: el } }));
    return { binds: window.__probe.binds, marked: el.querySelectorAll('[data-probe=bound]').length };
  });
  assert.deepEqual(state, { binds: 2, marked: 2 });
});

test('binds the root element of htmx:load itself', async () => {
  const { page } = await open('<div id="target"></div>', { scripts: { '/app.js': PROBE } });
  const binds = await page.evaluate(() => {
    const el = document.createElement('div');
    el.setAttribute('data-vanilla', 'probe');
    document.getElementById('target').append(el);
    el.dispatchEvent(new CustomEvent('htmx:load', { bubbles: true, detail: { elt: el } }));
    return window.__probe.binds;
  });
  assert.equal(binds, 1);
});

test('runs cleanup on htmx:beforeCleanupElement, one time', async () => {
  const { page } = await open('<div id="outer"><b id="a" data-vanilla="probe"></b></div>', {
    scripts: { '/app.js': PROBE },
  });
  const state = await page.evaluate(() => {
    const outer = document.getElementById('outer');
    const fire = (el) => el.dispatchEvent(new CustomEvent('htmx:beforeCleanupElement', { bubbles: true, detail: { elt: el } }));
    // htmx fires the event on each element, parent first.
    fire(outer);
    fire(document.getElementById('a'));
    return { ...window.__probe };
  });
  assert.deepEqual(state, { binds: 1, cleanups: 1 });
});

test('teardown then scan binds the element again', async () => {
  const { page } = await open('<b id="a" data-vanilla="probe"></b>', { scripts: { '/app.js': PROBE } });
  const state = await page.evaluate(() => {
    const a = document.getElementById('a');
    Vanilla.teardown(a);
    Vanilla.scan(a);
    return { ...window.__probe };
  });
  assert.deepEqual(state, { binds: 2, cleanups: 1 });
});

test('a late register binds elements already in the page', async () => {
  const { page } = await open('<b id="a" data-vanilla="late"></b>');
  const bound = await page.evaluate(() => {
    Vanilla.register('late', (el) => el.setAttribute('data-late', 'yes'));
    return document.getElementById('a').getAttribute('data-late');
  });
  assert.equal(bound, 'yes');
});

test('one element can carry many behaviors', async () => {
  const { page } = await open('<b id="a" data-vanilla="  probe   late "></b>', { scripts: { '/app.js': PROBE } });
  const state = await page.evaluate(() => {
    Vanilla.register('late', (el) => el.setAttribute('data-late', 'yes'));
    const a = document.getElementById('a');
    return [a.getAttribute('data-probe'), a.getAttribute('data-late')];
  });
  assert.deepEqual(state, ['bound', 'yes']);
});

test('register rejects bad names, non-functions and duplicates', async () => {
  const { page } = await open('<p>hi</p>');
  const results = await page.evaluate(() => {
    const attempt = (fn) => {
      try { fn(); return 'ok'; } catch (e) { return e.name; }
    };
    return [
      attempt(() => Vanilla.register('Bad Name', () => {})),
      attempt(() => Vanilla.register('', () => {})),
      attempt(() => Vanilla.register('fine', 'not a function')),
      attempt(() => Vanilla.register('copy', () => {})),
      attempt(() => Vanilla.register('fine', () => {})),
    ];
  });
  assert.deepEqual(results, ['TypeError', 'TypeError', 'TypeError', 'Error', 'ok']);
});

test('a failing behavior does not stop other behaviors', async () => {
  const { page, errors } = await open(
    '<b id="a" data-vanilla="boom probe"></b><b id="b" data-vanilla="probe"></b>',
    {
      before: {},
      scripts: {
        '/app.js': `${PROBE}\nVanilla.register('boom', function () { throw new Error('boom failed'); });`,
      },
    },
  );
  const binds = await page.evaluate(() => window.__probe.binds);
  assert.equal(binds, 2);
  assert.ok(errors.some((e) => e.includes('boom failed')), `logged: ${errors}`);
  // The failed pair is not retried on each scan.
  const again = await page.evaluate(() => {
    Vanilla.scan(document);
    return window.__probe.binds;
  });
  assert.equal(again, 2);
  assert.equal(errors.filter((e) => e.includes('boom failed')).length, 1);
});

test('a cleanup that throws does not stop other cleanups', async () => {
  const { page, errors } = await open('<div id="root"><b data-vanilla="bad probe"></b></div>', {
    scripts: {
      '/app.js': `${PROBE}\nVanilla.register('bad', () => () => { throw new Error('bad cleanup'); });`,
    },
  });
  const cleanups = await page.evaluate(() => {
    Vanilla.teardown(document.getElementById('root'));
    return window.__probe.cleanups;
  });
  assert.equal(cleanups, 1);
  assert.ok(errors.some((e) => e.includes('bad cleanup')), `logged: ${errors}`);
});

test('loading the script two times keeps one runtime', async () => {
  const { page } = await open('<b data-vanilla="probe"></b>', {
    scripts: { '/app.js': PROBE, '/again.js': 'window.__first = window.Vanilla;' },
  });
  const same = await page.evaluate(async () => {
    const first = window.Vanilla;
    const s = document.createElement('script');
    s.src = '/vanilla.js';
    await new Promise((resolve) => { s.onload = resolve; document.head.append(s); });
    return { same: window.Vanilla === first, binds: window.__probe.binds };
  });
  assert.deepEqual(same, { same: true, binds: 1 });
});

test('scan accepts no argument and non-elements', async () => {
  const { page, errors } = await open('<b data-vanilla="probe"></b>', { scripts: { '/app.js': PROBE } });
  const binds = await page.evaluate(() => {
    Vanilla.scan();
    Vanilla.scan(null);
    Vanilla.scan(document.createTextNode('x'));
    Vanilla.teardown();
    Vanilla.teardown(null);
    return window.__probe.binds;
  });
  assert.equal(binds, 1);
  assert.deepEqual(errors, []);
});
