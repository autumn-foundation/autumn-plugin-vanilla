# autumn-plugin-vanilla

Declarative vanilla JS behaviors for [Autumn](https://github.com/autumn-foundation/autumn)
apps. No npm, no bundler, no third-party JS.

- One small file, `vanilla.js`, served through the Autumn 0.8 `plugin_assets`
  seam: hashed URL, immutable cache, SRI.
- Works under the default CSP (`script-src 'self'`). No `eval`, no HTML strings.
- Binds new content after each htmx swap. Cleans up before htmx removes content.
- Typed Rust builders write the attributes. Values are always escaped.

Requires autumn-web `0.8`.

## Quickstart

Add the plugin:

```rust
use autumn_plugin_vanilla::VanillaPlugin;

autumn_web::app()
    .plugin(VanillaPlugin::new())
    .run()
    .await;
```

Put the script in the page `<head>`. The tag is deferred and has an SRI hash:

```rust
use autumn_plugin_vanilla::vanilla_script;

html! { head { (vanilla_script()) } }
```

Use a builder:

```rust
use autumn_plugin_vanilla::{Copy, Toggle};

html! {
    input id="api-key" value=(key) readonly;
    (Copy::selector("#api-key").button(html! { "Copy" }))

    (Toggle::target("#menu").button(html! { "Menu" }))
    nav id="menu" hidden { … }
}
```

Or write the attributes yourself:

```rust
html! {
    button type="button" data-vanilla="copy" data-vanilla-copy="#api-key" { "Copy" }
}
```

## Behaviors

A behavior acts on events from its element and from the descendants of that
element. Thus `.wrap(content)` (a `<div>`) and an attribute on the element
itself work the same. One element can have many behaviors:
`data-vanilla="confirm autosubmit"`.

| Behavior | Rust | What it does |
| --- | --- | --- |
| `copy` | `Copy::selector(sel)`, `Copy::text(s)` | Copies text to the clipboard on click. |
| `toggle` | `Toggle::target(sel).class(c)` | Shows or hides targets on click. Sets `aria-expanded`. |
| `dismiss` | `Dismiss::new().after(d)` | Removes the element on a close click or after a time. |
| `confirm` | `Confirm::new(msg)` | Asks before a form submits or a link opens. |
| `autosubmit` | `AutoSubmit::new().on_input().delay(d)` | Submits the form when a field changes. |
| `count` | `Count::new().mode(m).output(sel)` | Shows the character count of a field. |
| `local-time` | `LocalTime::new(&dt).format(f)` | Shows a `<time>` in the browser locale and time zone. |

### Attribute reference

| Attribute | Value | Default |
| --- | --- | --- |
| `data-vanilla` | Behavior names, space-separated. | — |
| `data-vanilla-copy` | CSS selector. Copies the value of a field, or the text of other elements. | — |
| `data-vanilla-copy-text` | Literal text. Wins over `data-vanilla-copy`. | — |
| `data-vanilla-toggle` | CSS selector. All matches toggle. | — |
| `data-vanilla-toggle-class` | Class to toggle. Without it, the `hidden` property toggles. | — |
| `data-vanilla-dismiss-close` | On a descendant: the close control. | — |
| `data-vanilla-dismiss-after` | Milliseconds, a positive integer. | no timer |
| `data-vanilla-confirm` | The question. | `Are you sure?` |
| `data-vanilla-autosubmit-on` | `change`, `input`, or both. | `change` |
| `data-vanilla-autosubmit-delay` | Milliseconds of debounce. | `0` |
| `data-vanilla-count` | CSS selector of the output. | `[data-vanilla-count-output]` inside |
| `data-vanilla-count-mode` | `used` (`12/280`) or `remaining` (`268`). | `used` |
| `data-vanilla-local-time` | `datetime`, `date`, `time`, `relative`. | `datetime` |

State and events:

- `copy` sets `data-vanilla-state="copied"` or `"failed"` for 2 seconds. It
  sends `vanilla:copied` or `vanilla:copy-failed` (`detail.text`).
  Style the state with CSS, for example
  `[data-vanilla-state=copied]::after { content: " ✓"; }`.
- `dismiss` sends a cancelable `vanilla:dismiss` event before it removes the
  element. The timer pauses while the pointer or the focus is inside.

All events bubble.

## Add your own behavior

Put the code in a same-origin file. Load it after `vanilla_script()`, with
`defer`:

```js
// static/js/app.js
Vanilla.register('greet', (el) => {
  el.textContent = 'Hello!';
  const timer = setInterval(() => {}, 1000);
  return () => clearInterval(timer); // Optional cleanup.
});
```

```rust
html! {
    head {
        (vanilla_script())
        script src=(asset_url("js/app.js")) defer {}
    }
}
```

`window.Vanilla` API:

| Function | Description |
| --- | --- |
| `register(name, init)` | Adds a behavior. `name` is lowercase ASCII, digits and `-`. `init(el)` can return a cleanup function. A late call binds the elements already in the page. |
| `scan(root)` | Binds all `data-vanilla` elements in `root` (default: `document`). Each element and behavior binds one time only. |
| `teardown(root)` | Runs the cleanup of `root` and its descendants. A later `scan` binds them again. |
| `names()` | The registered behavior names, sorted. |

If a behavior throws, the runtime logs the error and continues with the
other elements.

## Demo

```sh
cargo run --example vanilla_demo
# Open http://127.0.0.1:3000
```

## How it works

- `assets/vanilla.js` is the runtime and the 7 behaviors.
- `VANILLA_ASSETS` is a `PluginAssets` bundle with that one file.
  `VanillaPlugin` installs it with `AppBuilder::plugin_assets`.
- Autumn serves the file under `/static/_plugins/vanilla/`: at a hashed URL
  (`immutable`) and at a plain URL (`must-revalidate`), with `ETag`/`304`.
- `vanilla_script()` writes the hashed URL and the computed SRI hash.
- `asset_url("_plugins/vanilla/vanilla.js")` also gives the hashed URL.

See [docs/adr/0001-plugin-assets-seam.md](docs/adr/0001-plugin-assets-seam.md)
and [docs/plan.md](docs/plan.md).

## Limits

- No modal, tabs, autocomplete or nav. Autumn ships these in
  `autumn-widgets.js`.
- `confirm` uses `window.confirm`. For htmx-only buttons, use `hx-confirm`.
- `local-time` with `relative` sets the text at page load only.
- The clipboard API needs a secure context (HTTPS or localhost). Elsewhere,
  `copy` uses `document.execCommand('copy')`.

## Development

```sh
cargo fmt --all --check
cargo clippy --all-targets -- -D warnings
cargo test
npm ci && npm test                                      # browser tests (Chromium)
cargo build --example vanilla_demo && npm run test:e2e # real server + htmx
```

## License

Apache-2.0
