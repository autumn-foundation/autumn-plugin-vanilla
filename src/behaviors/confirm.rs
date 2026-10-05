use super::{Behavior, marker};
use crate::markup::{Attributes, container};

/// Asks the user before a form submits or a link opens.
///
/// It listens in the capture phase. When the user cancels, it stops the
/// event before htmx or other handlers see it. For htmx-only buttons, use
/// `hx-confirm`.
///
/// ```rust
/// use autumn_plugin_vanilla::Confirm;
/// use autumn_web::html;
///
/// let html = Confirm::new("Delete this post?").wrap(html! {
///     form method="post" action="/posts/1/delete" { button { "Delete" } }
/// });
/// assert!(html.into_string().contains(r#"data-vanilla-confirm="Delete this post?""#));
/// ```
#[derive(Debug, Clone, Default, PartialEq, Eq)]
#[must_use]
pub struct Confirm {
    message: Option<String>,
}

impl Confirm {
    /// Asks with this message. [`Confirm::default`] uses "Are you sure?".
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: Some(message.into()),
        }
    }

    /// The attributes, in render order.
    #[must_use]
    pub fn attributes(&self) -> Attributes {
        let mut attributes = vec![marker(Behavior::Confirm)];
        if let Some(message) = &self.message {
            attributes.push(("data-vanilla-confirm", message.clone()));
        }
        attributes
    }
}

container!(Confirm);
