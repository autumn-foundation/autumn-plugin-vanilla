use std::time::Duration;

use autumn_web::{Markup, PreEscaped, html};

use super::{Behavior, marker};
use crate::markup::{Attributes, container, millis};

/// Removes the element on click of a close control, or after a time.
///
/// A close control is a descendant with `data-vanilla-dismiss-close`. The
/// timer pauses while the pointer or the focus is inside the element. A
/// cancelled `vanilla:dismiss` event keeps the element.
///
/// ```rust
/// use std::time::Duration;
/// use autumn_plugin_vanilla::Dismiss;
/// use autumn_web::html;
///
/// let flash = Dismiss::new()
///     .after(Duration::from_secs(5))
///     .wrap(html! { "Saved. " (Dismiss::close_button(html! { "Close" })) });
/// assert!(flash.into_string().contains(r#"data-vanilla-dismiss-after="5000""#));
/// ```
#[derive(Debug, Clone, Default, PartialEq, Eq)]
#[must_use]
pub struct Dismiss {
    after: Option<Duration>,
}

impl Dismiss {
    /// Removes the element on click of a close control only.
    pub const fn new() -> Self {
        Self { after: None }
    }

    /// Also removes the element after `duration`. The value is in whole
    /// milliseconds, clamped to `2_147_483_647`. Zero sets no timer.
    pub const fn after(mut self, duration: Duration) -> Self {
        self.after = Some(duration);
        self
    }

    /// The attributes, in render order.
    #[must_use]
    pub fn attributes(&self) -> Attributes {
        let mut attributes = vec![marker(Behavior::Dismiss)];
        if let Some(after) = self.after {
            attributes.push(("data-vanilla-dismiss-after", millis(after).to_string()));
        }
        attributes
    }

    /// Renders a `<button type="button" data-vanilla-dismiss-close>`. Give it
    /// a text label, or an `aria-label` in your own markup.
    #[must_use]
    pub fn close_button(content: Markup) -> Markup {
        let content = PreEscaped(content.into_string());
        html! { button type="button" data-vanilla-dismiss-close { (content) } }
    }
}

container!(Dismiss);
