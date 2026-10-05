//! [`vanilla_script()`]: the `<script>` tag for the runtime.

use autumn_web::Markup;

use crate::assets::{VANILLA_ASSETS, VANILLA_JS};

/// Renders the deferred `<script>` tag for the runtime.
///
/// The tag has the hashed URL, the `integrity` hash and
/// `crossorigin="anonymous"`. Put it in `<head>`. Put your own scripts that
/// call `Vanilla.register` after it, also with `defer`.
///
/// ```rust
/// use autumn_plugin_vanilla::vanilla_script;
///
/// let html = vanilla_script().into_string();
/// assert!(html.contains(r#"src="/static/_plugins/vanilla/vanilla."#), "{html}");
/// assert!(html.contains(" defer"), "{html}");
/// ```
#[must_use]
pub fn vanilla_script() -> Markup {
    VANILLA_ASSETS.deferred_script_tag(VANILLA_JS)
}
