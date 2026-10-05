use std::time::Duration;

use super::{Behavior, marker};
use crate::markup::{Attributes, common, millis};

/// Submits the form when a field changes.
///
/// It calls `form.requestSubmit()`, so `submit` handlers, `confirm` and htmx
/// run. An invalid form does not submit. In `change` mode, text fields do
/// not submit: use [`on_input`](Self::on_input) for them.
///
/// A submit that loads a new page is a change of context (WCAG 3.2.2). Use
/// it with an htmx partial swap, or tell the user before the field.
///
/// ```rust
/// use std::time::Duration;
/// use autumn_plugin_vanilla::AutoSubmit;
/// use autumn_web::html;
///
/// let search = AutoSubmit::new()
///     .on_input()
///     .delay(Duration::from_millis(300))
///     .wrap(html! { input type="search" name="q"; });
/// assert!(search.into_string().contains(r#"data-vanilla-autosubmit-on="input""#));
/// ```
#[derive(Debug, Clone, Default, PartialEq, Eq)]
#[must_use]
pub struct AutoSubmit {
    on_input: bool,
    delay: Option<Duration>,
    extra: Attributes,
}

impl AutoSubmit {
    /// Submits on `change` events.
    pub const fn new() -> Self {
        Self {
            on_input: false,
            delay: None,
            extra: Vec::new(),
        }
    }

    /// Submits on `input` events (each change to the value), not on
    /// `change`. Use it with [`delay`](Self::delay).
    pub const fn on_input(mut self) -> Self {
        self.on_input = true;
        self
    }

    /// Waits `duration` after the last event, then submits. The value is in
    /// whole milliseconds. A non-zero value gives at least 1 ms. The builder
    /// limits the value to `2_147_483_647`.
    pub const fn delay(mut self, duration: Duration) -> Self {
        self.delay = Some(duration);
        self
    }

    /// The attributes, in render order.
    #[must_use]
    pub fn attributes(&self) -> Attributes {
        let mut attributes = vec![marker(Behavior::AutoSubmit)];
        if self.on_input {
            attributes.push(("data-vanilla-autosubmit-on", "input".to_owned()));
        }
        if let Some(delay) = self.delay {
            attributes.push(("data-vanilla-autosubmit-delay", millis(delay).to_string()));
        }
        attributes.extend(self.extra.iter().cloned());
        attributes
    }
}

common!(AutoSubmit, wrap);
