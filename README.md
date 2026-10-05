# autumn-plugin-vanilla

Declarative vanilla JS behaviors for [Autumn](https://github.com/autumn-foundation/autumn)
apps. No npm, no bundler, no third-party JS.

- The plugin serves one small file, `vanilla.js`, through the Autumn 0.8
  `plugin_assets` seam. The file has a hashed URL, an immutable cache and SRI.
- It works under the default CSP (`script-src 'self'`). It uses no `eval` and
  no HTML strings.
- It binds new content after each htmx swap. It cleans up before htmx
  removes content.
- Typed Rust builders write the attributes. The builders escape all values.

Requires autumn-web `0.8` and Rust 1.88.

## Quickstart

Add the plugin:

```rust
use autumn_plugin_vanilla::VanillaPlugin;

autumn_web::app()
    .plugin(VanillaPlugin::new())
    .run()
    .await;
```

Put the script in the page `<head>`. The tag has `defer` and an SRI hash:

```rust
use autumn_plugin_vanilla::vanilla_script;

html! { head { (vanilla_script()) } }
```

Use a builder:

```rust
use autumn_plugin_vanilla::{CopyText, Toggle};

html! {
    label for="api-key" { "API key" }
    input id="api-key" value=(key) readonly;
    (CopyText::selector("#api-key").button(html! { "Copy" }))

    (Toggle::target("#menu").attr("class", "btn").button(html! { "Menu" }))
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
element. One element can have many behaviors:
`data-vanilla="confirm autosubmit"`.

| Behavior | Rust | What it does |
| --- | --- | --- |
| `copy` | `CopyText::selector(sel)`, `CopyText::text(s)` | Copies text to the clipboard on click. |
| `toggle` | `Toggle::target(sel).class(c)` | Shows or hides targets on click. Sets `aria-expanded`. |
| `dismiss` | `Dismiss::new().after(d)` | Removes the element when the user clicks a close control, or after a time. |
| `confirm` | `Confirm::new(msg)` | Asks before a form submits, a link opens, or an htmx element sends a request. |
| `autosubmit` | `AutoSubmit::new().on_input().delay(d)` | Submits the form when a field changes. |
| `count` | `Count::new().mode(m).output(sel)` | Shows the character count of a field. |
| `local-time` | `LocalTime::new(&dt).format(f)` | Shows a `<time>` in the browser locale and time zone. |

All builders have `attributes()` and `attr(name, value)` for extra
attributes (`id`, `class`, `aria-label`, …). `attr` refuses event handler
names, `style`, `type` and `data-vanilla…` names. All builders except
`Toggle` and `LocalTime` have `wrap(content)`, which puts content in a
`<div>`. Put `toggle` and `copy` on a `<button>`.

### Attribute reference

| Attribute | Value | Default |
| --- | --- | --- |
| `data-vanilla` | Behavior names, space-separated. | — |
| `data-vanilla-ignore` | On a container: nothing inside it binds. | — |
| `data-vanilla-copy` | CSS selector. Copies the value of a field, or the text of other elements. Never a password or hidden field. | — |
| `data-vanilla-copy-text` | Literal text. It has priority over `data-vanilla-copy`. | — |
| `data-vanilla-copy-done` | Screen reader message on success. | `Copied` |
| `data-vanilla-copy-failed` | Screen reader message on failure. | `Copy failed` |
| `data-vanilla-toggle` | CSS selector. All matches toggle. | — |
| `data-vanilla-toggle-class` | Class to toggle. Without it, the `hidden` property toggles. | — |
| `data-vanilla-dismiss-close` | On a descendant: the close control. | — |
| `data-vanilla-dismiss-after` | Milliseconds, a whole number. `0` sets no timer. | no timer |
| `data-vanilla-dismiss-focus` | CSS selector. Focus goes there when the element closes with focus inside. | next sibling |
| `data-vanilla-confirm` | The question. | `Are you sure?` |
| `data-vanilla-autosubmit-on` | `change`, `input`, or both. | `change` |
| `data-vanilla-autosubmit-delay` | Milliseconds to wait after the last event. | `0` |
| `data-vanilla-count` | CSS selector of the output. | the output inside |
| `data-vanilla-count-output` | Marks the output. The runtime writes only into a marked element. | — |
| `data-vanilla-count-mode` | `used` (`12/280`) or `remaining` (`268`). | `used` |
| `data-vanilla-local-time` | `datetime`, `date`, `time`, `relative`. | `datetime` |

State and events (all events bubble):

- `copy` sets `data-vanilla-state="copied"` or `"failed"` for 2 seconds and
  sends `vanilla:copied` or `vanilla:copy-failed`. A shared, hidden
  `role="status"` region announces the result. Style the state with CSS,
  for example `[data-vanilla-state=copied]::after { content: " ✓"; }`.
- `dismiss` sends a cancelable `vanilla:dismiss` event before it removes the
  element. The timer pauses while the pointer or the focus is inside.
- `autosubmit` calls `form.requestSubmit()`. An invalid form does not
  submit. In `change` mode, text fields do not submit (Enter already does).
  Only a form around the element, or the element itself, submits.
- `local-time` sets the text one time, when it binds. A date without a time
  (`2026-10-05`) shows that calendar day in every time zone.

## Accessibility

- `toggle` sets `aria-expanded`. `Toggle::button` adds `aria-controls` for a
  plain `#id` target. Put `toggle` on a `<button>`.
- `copy` announces the result through a `role="status"` region.
- `dismiss` moves focus when it removes a focused element. Do not use
  `after` for errors or other important text. Add `role="status"` with
  `.attr("role", "status")`, so screen readers announce a new flash.
- `Count::output_slot()` has `aria-live="off"`, so a screen reader does not
  read each key press. Point the field at it with `aria-describedby`.
- A submit that loads a new page is a change of context (WCAG 3.2.2). Use
  `autosubmit` with an htmx partial swap, or tell the user before the field.

## Security

The runtime binds any `data-vanilla` element in the page. User HTML with
these attributes can use the behaviors. If your app shows user HTML:

- Remove `data-vanilla*` attributes in the sanitizer. Ammonia removes them by
  default. DOMPurify needs `ALLOW_DATA_ATTR: false`.
- Or put that HTML inside `[data-vanilla-ignore]`.

Limits that the runtime applies:

- `copy` never reads a password or hidden field.
- `count` writes only into an element with `data-vanilla-count-output`.
- `autosubmit` submits only a form around its element.
- `confirm` asks in the capture phase, before htmx.
- A `<a id="Vanilla">` or `<img name="querySelector">` in the page cannot
  replace the runtime or its queries.

Selectors and messages that you give to the builders are trusted input. Do
not make a selector from user data.

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
| `teardown(root)` | Runs the cleanup of `root` and of each element inside it. A later `scan` binds them again. |
| `names()` | The registered behavior names, sorted. |

htmx integration:

- On `htmx:load`, the runtime binds the new content. It also binds each bound
  ancestor again (cleanup, then init), because its content changed.
- On `htmx:beforeCleanupElement`, it runs the cleanup of that element.

If a behavior throws, the runtime logs the error and continues with the
other elements. It does not try that behavior on that element again.

## Demo

```sh
cargo run --example vanilla_demo
# Open http://127.0.0.1:3000
```

## How it works

- `assets/vanilla.js` is the runtime and the 7 behaviors.
- `VANILLA_ASSETS` is a `PluginAssets` bundle with that one file.
  `VanillaPlugin` installs it with `AppBuilder::plugin_assets` and declares a
  `PluginContract` for autumn-web `0.8`.
- Autumn serves the file under `/static/_plugins/vanilla/`: at a hashed URL
  (`immutable`) and at a plain URL (`must-revalidate`), with `ETag`/`304`.
- `vanilla_script()` writes the hashed URL and the computed SRI hash.
- `asset_url("_plugins/vanilla/vanilla.js")` also gives the hashed URL.

See [docs/adr/0001-plugin-assets-seam.md](docs/adr/0001-plugin-assets-seam.md)
and [docs/plan.md](docs/plan.md).

## Limits

- No modal, tabs, autocomplete or nav. Autumn ships these in
  `autumn-widgets.js`.
- `confirm` uses `window.confirm`.
- An idiomorph swap keeps elements. The runtime binds the swap target and
  its ancestors again, but not kept descendants.
- The Clipboard API needs a secure context (HTTPS or localhost). Elsewhere,
  `copy` uses `document.execCommand('copy')`.

## Development

```sh
cargo fmt --all --check
cargo clippy --all-targets -- -D warnings
cargo test
npm ci && npm test                                      # browser tests (Chromium)
cargo build --example vanilla_demo && npm run test:e2e # real server + htmx
```

CI runs all of these, plus MSRV, coverage (≥ 85% lines) and a publish dry
run. Branch protection should require the `CI pass` check.

## License

Apache-2.0
