// Test harness: loads assets/vanilla.js in real Chromium.
//
// Each page comes from the fake origin https://app.test, with a strict CSP
// (no inline script). This copies the Autumn default policy.

import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const VANILLA_JS = readFileSync(new URL('../assets/vanilla.js', import.meta.url), 'utf8');

export const ORIGIN = 'https://app.test';
export const CSP = "default-src 'self'; script-src 'self'; style-src 'self'";

let browser;

/** Starts Chromium. Call from `before`. */
export async function launch() {
  browser = await chromium.launch();
}

/** Stops Chromium. Call from `after`. */
export async function close() {
  await browser?.close();
}

/**
 * Opens a page with `body` HTML and `vanilla.js`.
 *
 * Options:
 * - `scripts`: map of path → JS. Each loads after `vanilla.js`, deferred.
 * - `before`: map of path → JS. Each loads before `vanilla.js`, deferred.
 * - `context`: Playwright context options (locale, timezoneId, …).
 * - `lang`: `lang` attribute of `<html>`.
 * - `clock`: `Date` for a fake, paused clock, installed before load.
 * - `init`: JS that runs before any page script (`addInitScript`).
 *
 * Returns `{ page, context, requests, errors, violations }`.
 * - `requests`: URLs of requests to `/submit*` paths.
 * - `errors`: uncaught page errors and `console.error` texts.
 */
export async function open(body, options = {}) {
  const context = await browser.newContext(options.context ?? {});
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const requests = [];
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });

  const before = options.before ?? {};
  const scripts = options.scripts ?? {};
  const tags = [
    ...Object.keys(before).map((p) => `<script src="${p}" defer></script>`),
    '<script src="/vanilla.js" defer></script>',
    ...Object.keys(scripts).map((p) => `<script src="${p}" defer></script>`),
    '<script src="/csp-probe.js" defer></script>',
  ].join('\n');
  const lang = options.lang ? ` lang="${options.lang}"` : '';
  const html = `<!doctype html><html${lang}><head><meta charset="utf-8">${tags}</head><body>${body}</body></html>`;
  const files = { ...before, ...scripts, '/vanilla.js': VANILLA_JS, '/csp-probe.js': CSP_PROBE };

  await page.route(`${ORIGIN}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/submit')) {
      requests.push(url.pathname + url.search);
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><p id="done">done</p>' });
    }
    if (files[url.pathname] !== undefined) {
      return route.fulfill({ status: 200, contentType: 'text/javascript', body: files[url.pathname] });
    }
    if (url.pathname === '/') {
      return route.fulfill({
        status: 200,
        contentType: 'text/html',
        headers: { 'content-security-policy': CSP },
        body: html,
      });
    }
    return route.fulfill({ status: 404, body: 'not found' });
  });

  await page.addInitScript(CSP_WATCH);
  if (options.init) await page.addInitScript(options.init);
  if (options.clock) {
    // Paused: time moves only with `page.clock.runFor`.
    await page.clock.install({ time: options.clock });
    await page.clock.pauseAt(new Date(options.clock.getTime() + 1));
  }
  await page.goto(`${ORIGIN}/`);
  // `goto` waits for `load`. Deferred scripts and DOMContentLoaded are done.
  const { probe, violations } = await page.evaluate(() => ({
    probe: window.__cspProbe === true,
    violations: window.__cspViolations,
  }));
  if (!probe) throw new Error('same-origin scripts did not run');
  return { page, context, requests, errors, violations };
}

// Records CSP violations from the first byte of the page.
const CSP_WATCH = `
window.__cspViolations = [];
document.addEventListener('securitypolicyviolation', function (e) {
  window.__cspViolations.push(e.violatedDirective + ' ' + e.blockedURI);
});
`;

// Loads last. It proves that same-origin scripts ran under the CSP.
const CSP_PROBE = 'window.__cspProbe = true;';
