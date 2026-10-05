# Changelog

## [Unreleased]

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
