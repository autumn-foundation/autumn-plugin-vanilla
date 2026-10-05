# Plan: autumn-plugin-vanilla 0.1.0

Writing rule: ASD-STE100. Short sentences. Active voice. One topic for each sentence.

## 1. Problem

Autumn apps render HTML on the server with Maud and htmx. Small client
behaviors still need JavaScript: copy a value, open a menu, close a flash
message. The default CSP is `script-src 'self'`. Inline scripts do not run.
Each app now writes and serves its own small JS files. This is repeated work.

## 2. Goal

Supply a set of declarative, CSP-safe, htmx-aware behaviors in plain
("vanilla") JavaScript. Serve them through the Autumn 0.8
`plugin_assets` seam. Supply typed Rust builders that write the attributes.
Use no npm, no bundler and no third-party JS at run time.

## 3. Brainstorming

Ideas, not filtered:

1. A runtime that finds `[data-vanilla]` elements and binds named behaviors.
2. Re-scan after each htmx swap (`htmx:load`).
3. Run cleanup functions before htmx removes an element.
4. A public `Vanilla.register(name, init)` API for app behaviors.
5. Behaviors: `copy`, `toggle`, `dismiss`, `confirm`, `autosubmit`,
   `count`, `local-time`, `submit-once`, `autofocus`, `tabs`, `modal`,
   `autocomplete`, `infinite-scroll`, `theme-switch`, `print`,
   `share`, `password-reveal`.
6. Typed Rust builders with `.wrap(markup)` and `.button(markup)`.
7. `LocalTime` takes a typed `chrono::DateTime`.
8. Real-browser tests with Playwright and Chromium.
9. An end-to-end test: real Autumn server, default CSP, SRI, browser.
10. A CSS file with default styles.

## 4. Reverse brainstorming

Question: "How can this plugin fail its users?" Each answer gives a rule.

| How to fail | Rule to prevent it |
| --- | --- |
| Use `eval`, `new Function` or `innerHTML`. CSP blocks it, or XSS occurs. | Use only `textContent`, `setAttribute` and `classList`. A test scans the file. |
| Bind a behavior two times after an htmx swap. | Mark each bound pair. Bind each pair one time only. |
| Leak timers when htmx removes an element. | Run cleanup on `htmx:beforeCleanupElement`. |
| An invalid selector throws and stops all behaviors. | Catch selector errors. Skip that element only. |
| An app behavior throws and stops the scan. | Catch errors for each element. Log with `console.error`. |
| Duplicate the framework widgets (modal, nav, autocomplete). | Do not ship `modal`, `tabs`, `autocomplete`. Autumn has them. |
| Duplicate htmx (`hx-confirm`, `hx-disabled-elt`, `hx-trigger`). | Ship `confirm` and `autosubmit` for forms that do not use htmx. Drop `submit-once`. |
| `confirm` runs after htmx sends the request. | Listen in the capture phase. Stop the event when the user cancels. |
| `toggle` does not tell screen readers the state. | Set `aria-expanded` on the control. |
| `count` disagrees with `maxlength`. | Count UTF-16 code units, as `maxlength` does. |
| The builder writes attribute values without escaping. | Escape all values. A property test checks this. |
| Hand-kept SRI hashes drift. | Use the hashes that `PluginAssets` computes. |
| Large scope delays a working release. | Ship 7 behaviors. List others as "not in scope". |

## 5. Six thinking hats

- **White (facts).** Autumn 0.8.0 has `PluginAssets` and
  `AppBuilder::plugin_assets`. Files go to `/static/_plugins/<ns>/` with hashed,
  immutable URLs and SRI. `autumn-plugin-motion` 0.2 uses this seam. The
  framework already ships `autumn-widgets.js` (autocomplete, modal, nav).
  Chromium and Playwright 1.56 are on the test machine. Verus is not available.
- **Red (feelings).** A Rust developer does not want to write JS for a copy
  button. Typed builders feel safe. A large API feels heavy.
- **Black (risks).** Browser APIs differ (clipboard needs a secure context).
  Tests that only read the JS text prove little. Late `register` calls can
  miss elements. The runtime can bind an element two times after a swap.
- **Yellow (benefits).** Zero JS for common tasks. CSP-safe by default.
  Cache-safe upgrades through hashed URLs. Same shape as the Motion plugin,
  so the ecosystem stays consistent.
- **Green (alternatives).** Wrap Alpine.js or Stimulus: rejected, they need
  `unsafe-eval` or a build step. One file for each behavior: rejected, more
  requests for little gain. One small file (`vanilla.js`): accepted.
- **Blue (process).** Plan → RED (failing Rust and browser tests) → GREEN
  (minimum code) → REFACTOR → multi-angle review → AC evidence. Verus is not
  available. Property tests (`proptest`) cover the Rust invariants instead.

## 6. Decisions

- One bundle, namespace `vanilla`, one file: `vanilla.js`. See
  [ADR 0001](adr/0001-plugin-assets-seam.md).
- Behaviors: `copy`, `toggle`, `dismiss`, `confirm`, `autosubmit`,
  `count`, `local-time`.
- Attribute model: `data-vanilla="<name> <name>…"` on an element. Options are
  `data-vanilla-<name>[-option]` attributes. Each behavior acts on events from
  the element and its descendants. Thus `.wrap()` and raw attributes both work.
- Rust: one builder type for each behavior. `Behavior` enum for raw use.

## 7. Acceptance criteria

No GitHub issue exists for this work. These criteria replace the issue.

| ID | Criterion |
| --- | --- |
| AC1 | `VanillaPlugin` installs one `PluginAssets` bundle (namespace `vanilla`) through `AppBuilder::plugin_assets`. |
| AC2 | The server sends `vanilla.js` at a hashed URL (`immutable`) and a plain URL (`must-revalidate`), with `ETag`/`304`. Unknown paths give `404`. |
| AC3 | `vanilla_script()` writes a deferred `<script>` with the hashed URL, `integrity` and `crossorigin`. No hand-kept hashes. |
| AC4 | The plugin passes `autumn_web::plugin_conformance`. Its routes are public and plugin-attributed. |
| AC5 | The runtime binds behaviors on load and after each htmx swap. It binds each element one time only. |
| AC6 | The runtime runs cleanup before htmx removes an element. |
| AC7 | `Vanilla.register(name, init)` adds an app behavior. A late registration binds elements already in the page. |
| AC8 | An invalid selector or a failing behavior does not stop other behaviors. |
| AC9 | The 7 behaviors work in a real browser (Chromium). |
| AC10 | `vanilla.js` uses no `eval`, `new Function`, `innerHTML`, `outerHTML`, `insertAdjacentHTML` or `document.write`. |
| AC11 | The behaviors work on a real Autumn server under its default CSP with SRI. |
| AC12 | Typed Rust builders exist for each behavior. They escape all attribute values. |
| AC13 | `toggle` sets `aria-expanded`. Builders add `type="button"` to buttons. |
| AC14 | `cargo fmt`, `cargo clippy` (pedantic, nursery, `-D warnings`), `cargo test` and doc tests pass. |
| AC15 | README, crate docs, ADR, example app and CI workflow exist. Text uses ASD-STE100. |
| AC16 | Line coverage of the Rust crate is 85% or more. |

## 8. Review round 1

Four review agents checked the work: runtime correctness, security, Rust
API, and accessibility with docs and tests. The fixes:

- Runtime: rebind after a swap inside a bound element, teardown without
  `data-vanilla`, a clobber-safe global and queries, `data-vanilla-ignore`.
- Security: `copy` refuses password and hidden fields. `count` writes only
  into a marked output. `autosubmit` submits only its own form.
- Correctness: one submit on Enter, no submit for an invalid form, a nested
  `confirm` asks one time, `confirm` covers htmx elements, a date-only
  `local-time` shows the right day, better relative units.
- Accessibility: `copy` announces its result. `dismiss` moves focus and
  sees hover or focus at bind time. The count slot has `aria-live="off"`.
- Rust: `Copy` is now `CopyText`. `Behavior::ALL` is a slice. All builders
  have `attr()`. `millis` gives at least 1 ms for a non-zero duration. The
  plugin declares a `PluginContract`.

25 new browser tests fail on the old runtime and pass on the new one.

## 9. Not in scope

- Modal, tabs, autocomplete, nav: Autumn ships them in `autumn-widgets.js`.
- `submit-once`: use htmx `hx-disabled-elt`.
- Animations: use `autumn-plugin-motion`.
- A CSS file: behaviors set state attributes. The app styles them.
