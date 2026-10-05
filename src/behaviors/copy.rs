use autumn_web::Markup;

use super::{Behavior, button, marker};
use crate::markup::{Attributes, container};

/// Copies text to the clipboard on click.
///
/// The element gets `data-vanilla-state="copied"` (or `"failed"`) for 2
/// seconds. It also sends a `vanilla:copied` (or `vanilla:copy-failed`)
/// event. Style the state with CSS.
///
/// ```rust
/// use autumn_plugin_vanilla::Copy;
/// use autumn_web::html;
///
/// let html = Copy::selector("#api-key").button(html! { "Copy" });
/// assert!(html.into_string().contains(r##"data-vanilla-copy="#api-key""##));
/// ```
#[derive(Debug, Clone, PartialEq, Eq)]
#[must_use]
pub struct Copy {
    source: Source,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum Source {
    Selector(String),
    Text(String),
}

impl Copy {
    /// Copies the first match of a CSS selector. For an `input`, `textarea`
    /// or `select`, it copies the value. For other elements, the text.
    pub fn selector(selector: impl Into<String>) -> Self {
        Self {
            source: Source::Selector(selector.into()),
        }
    }

    /// Copies this literal text.
    pub fn text(text: impl Into<String>) -> Self {
        Self {
            source: Source::Text(text.into()),
        }
    }

    /// The attributes, in render order.
    #[must_use]
    pub fn attributes(&self) -> Attributes {
        let option = match &self.source {
            Source::Selector(selector) => ("data-vanilla-copy", selector.clone()),
            Source::Text(text) => ("data-vanilla-copy-text", text.clone()),
        };
        vec![marker(Behavior::Copy), option]
    }

    /// Renders a `<button type="button">` that copies.
    #[must_use]
    pub fn button(&self, content: Markup) -> Markup {
        button(self.attributes(), content)
    }
}

container!(Copy);
