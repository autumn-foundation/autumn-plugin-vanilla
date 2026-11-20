# Changelog

## [Unreleased]

## [0.4.0] - 2026-11-20

### Changed

- **Breaking:** Support `autumn-web` 0.11. The plugin now needs `autumn-web`
  0.11. Apps on `autumn-web` 0.10 stay on 0.3.0.
- **Breaking:** `LocalTime::new` takes `impl Into<Timestamp>` (jiff, through
  `autumn_web::time`), not a chrono `&DateTime`. autumn-web 0.11 has no
  chrono. Pass a `Timestamp` or a `Zoned`. The markup does not change.

## [0.3.0] - 2026-11-06

### Changed

- **Breaking:** Support `autumn-web` 0.10. The plugin now needs `autumn-web`
  0.10 and Rust 1.97. Apps on `autumn-web` 0.9 stay on 0.2.0.

## [0.2.0] - 2026-10-31

### Changed

- Support `autumn-web` 0.9. The plugin now needs `autumn-web` 0.9.

### Added

- `VanillaPlugin`: installs `vanilla.js` through the autumn-web 0.8
  `plugin_assets` seam (hashed URL, immutable cache, SRI).
- `vanilla_script()`: the deferred, SRI-tagged `<script>` tag.
- Runtime `window.Vanilla` with `register`, `scan`, `teardown` and `names`.
  It binds on load and on `htmx:load`, and cleans up on
  `htmx:beforeCleanupElement`.
- Behaviors: `copy`, `toggle`, `dismiss`, `confirm`, `autosubmit`, `count`,
  `local-time`.
- Typed builders: `CopyText`, `Toggle`, `Dismiss`, `Confirm`, `AutoSubmit`,
  `Count` (with `OutputSlot`), `LocalTime`, and the `Behavior` enum. Each
  builder has `attr()` for safe extra attributes.
- `data-vanilla-ignore`: nothing inside it binds. Use it around user HTML.
- `VanillaPlugin` declares a `PluginContract` for autumn-web `0.8`.
