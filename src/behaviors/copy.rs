use autumn_web::Markup;

use super::{Behavior, button, marker};
use crate::markup::{Attributes, common};

/// Copies text to the clipboard on click.
///
/// The element gets `data-vanilla-state="copied"` (or `"failed"`) for 2
/// seconds. A screen reader hears "Copied" (or "Copy failed"). The element
/// also sends a `vanilla:copied` (or `vanilla:copy-failed`) event. The
/// runtime never copies a password field or a hidden field.
///
/// ```rust
/// use autumn_plugin_vanilla::CopyText;
/// use autumn_web::html;
///
/// let html = CopyText::selector("#api-key").button(html! { "Copy" });
/// assert!(html.into_string().contains(r##"data-vanilla-copy="#api-key""##));
/// ```
#[derive(Debug, Clone, PartialEq, Eq)]
#[must_use]
pub struct CopyText {
    source: Source,
    messages: Option<(String, String)>,
    extra: Attributes,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum Source {
    Selector(String),
    Text(String),
}

impl CopyText {
    /// Copies the first match of a CSS selector. For an `input`, `textarea`
    /// or `select`, it copies the value. For other elements, the text.
    ///
    /// The selector is trusted input. Do not make it from user data.
    pub fn selector(selector: impl Into<String>) -> Self {
        Self::with(Source::Selector(selector.into()))
    }

    /// Copies this literal text.
    pub fn text(text: impl Into<String>) -> Self {
        Self::with(Source::Text(text.into()))
    }

    const fn with(source: Source) -> Self {
        Self {
            source,
            messages: None,
            extra: Vec::new(),
        }
    }

    /// Sets the screen reader messages. The defaults are "Copied" and
    /// "Copy failed".
    pub fn messages(mut self, done: impl Into<String>, failed: impl Into<String>) -> Self {
        self.messages = Some((done.into(), failed.into()));
        self
    }

    /// The attributes, in render order.
    #[must_use]
    pub fn attributes(&self) -> Attributes {
        let option = match &self.source {
            Source::Selector(selector) => ("data-vanilla-copy", selector.clone()),
            Source::Text(text) => ("data-vanilla-copy-text", text.clone()),
        };
        let mut attributes = vec![marker(Behavior::Copy), option];
        if let Some((done, failed)) = &self.messages {
            attributes.push(("data-vanilla-copy-done", done.clone()));
            attributes.push(("data-vanilla-copy-failed", failed.clone()));
        }
        attributes.extend(self.extra.iter().cloned());
        attributes
    }

    /// Renders a `<button type="button">` that copies.
    #[must_use]
    pub fn button(&self, content: Markup) -> Markup {
        button(self.attributes(), content)
    }
}

common!(CopyText, wrap);
