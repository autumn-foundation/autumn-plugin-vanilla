use std::time::Duration;

use autumn_web::{Markup, html};

use super::{Behavior, marker};
use crate::markup::{Attributes, common, millis};

/// Removes the element when the user clicks a close control, or after a time.
///
/// A close control is a descendant with `data-vanilla-dismiss-close`. The
/// timer pauses while the pointer or the focus is inside the element. A
/// cancelled `vanilla:dismiss` event keeps the element. If the element has
/// focus when it closes, focus moves to the [`focus`](Self::focus) target,
/// or else to the next sibling, the previous sibling, or the parent.
///
/// Do not use [`after`](Self::after) for errors or other important text.
/// Add `role="status"` (with [`attr`](Self::attr)) so that screen readers
/// announce a flash that htmx adds.
///
/// ```rust
/// use std::time::Duration;
/// use autumn_plugin_vanilla::Dismiss;
/// use autumn_web::html;
///
/// let flash = Dismiss::new()
///     .after(Duration::from_secs(5))
///     .attr("role", "status")
///     .wrap(html! { "Saved. " (Dismiss::close_button("Close")) });
/// assert!(flash.into_string().contains(r#"data-vanilla-dismiss-after="5000""#));
/// ```
#[derive(Debug, Clone, Default, PartialEq, Eq)]
#[must_use]
pub struct Dismiss {
    after: Option<Duration>,
    focus: Option<String>,
    extra: Attributes,
}

impl Dismiss {
    /// Removes the element when the user clicks a close control.
    pub const fn new() -> Self {
        Self {
            after: None,
            focus: None,
            extra: Vec::new(),
        }
    }

    /// Also removes the element after `duration`. The value is in whole
    /// milliseconds. A non-zero value gives at least 1 ms. The builder
    /// limits the value to `2_147_483_647`. Zero sets no timer.
    pub const fn after(mut self, duration: Duration) -> Self {
        self.after = Some(duration);
        self
    }

    /// Moves focus to the first match of this CSS selector when the element
    /// closes with focus inside.
    pub fn focus(mut self, selector: impl Into<String>) -> Self {
        self.focus = Some(selector.into());
        self
    }

    /// The attributes, in render order.
    #[must_use]
    pub fn attributes(&self) -> Attributes {
        let mut attributes = vec![marker(Behavior::Dismiss)];
        if let Some(after) = self.after {
            attributes.push(("data-vanilla-dismiss-after", millis(after).to_string()));
        }
        if let Some(focus) = &self.focus {
            attributes.push(("data-vanilla-dismiss-focus", focus.clone()));
        }
        attributes.extend(self.extra.iter().cloned());
        attributes
    }

    /// Renders a `<button type="button" data-vanilla-dismiss-close>` with a
    /// text label, for example "Close".
    #[must_use]
    pub fn close_button(label: &str) -> Markup {
        html! { button type="button" data-vanilla-dismiss-close { (label) } }
    }
}

common!(Dismiss, wrap);
