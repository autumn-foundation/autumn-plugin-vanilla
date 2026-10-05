# CLAUDE.md - autumn-plugin-vanilla

Declarative vanilla JS behaviors for Autumn 0.8 apps, served through the
`plugin_assets` seam. Read `docs/plan.md` and `docs/adr/` first.

## Layout

| Path | Content |
| --- | --- |
| `assets/vanilla.js` | Runtime and the 7 built-in behaviors. The only served file. |
| `src/assets.rs` | `VANILLA_ASSETS` bundle (`PluginAssets::from_files`). |
| `src/plugin.rs` | `VanillaPlugin`: `app.plugin_assets(&VANILLA_ASSETS)`. |
| `src/script.rs` | `vanilla_script()`. |
| `src/behaviors/` | `Behavior` enum and one typed builder for each behavior. |
| `src/markup.rs` | Escaped element renderer, `millis` clamp, extra-attribute check, `common!` macro. |
| `tests/` | Rust: builders, serving, conformance, source checks, properties. |
| `js-tests/` | Browser tests (Playwright, Chromium) for `vanilla.js`. |
| `js-tests/e2e/` | Real demo server, real htmx, default CSP. |
| `examples/vanilla_demo.rs`, `static/` | Demo app. |

## Commands

- Lint: `cargo fmt --all && cargo clippy --all-targets -- -D warnings`
- Rust tests: `cargo test`
- Browser tests: `npm ci && npm test`
- End-to-end: `cargo build --example vanilla_demo && npm run test:e2e`
- Coverage: `cargo llvm-cov --all-targets --summary-only` (keep ≥ 85%)

## Rules

- Rust and JS stay in lockstep. A new behavior needs: a `Behavior` variant,
  a builder, a `register('<name>'` call in `vanilla.js`, browser tests, and a
  README row. `tests/runtime_source.rs` checks the `register` calls.
- `vanilla.js` must not use `eval`, `new Function`, `innerHTML`,
  `outerHTML`, `insertAdjacentHTML`, `document.write` or string timers.
  `tests/runtime_source.rs` checks this.
- Each behavior returns a cleanup that removes its listeners and timers.
- Catch invalid selectors. One bad element must not stop other elements.
- Builders escape all values through `markup::element`. Do not build HTML
  strings anywhere else. Extra attribute names go through
  `markup::valid_extra_name`.
- Security limits stay: `copy` never reads password or hidden fields,
  `count` writes only into `[data-vanilla-count-output]`, `autosubmit`
  submits only a form around its element, `[data-vanilla-ignore]` stops
  binding, and DOM queries use `Document.prototype` methods.
- Timer values go through `markup::millis` (clamp to `2_147_483_647`).
- Browser tests that use time must use the paused fake clock
  (`open(…, { clock })`), not real waits.
- Write docs and comments in ASD-STE100: short sentences, active voice.
- Never bump the crate version unless the user asks for a release.
