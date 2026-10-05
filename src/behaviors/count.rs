use autumn_web::{Markup, html};

use super::{Behavior, marker};
use crate::markup::{Attributes, container};

/// Shows the character count of a field.
///
/// The field is the element itself (an `input` or `textarea`), or the first
/// one inside it. The output is the [`output`](Self::output) selector match,
/// or the [`Count::output_slot`] inside the element. The count uses UTF-16
/// code units, the same unit as `maxlength`.
///
/// ```rust
/// use autumn_plugin_vanilla::Count;
/// use autumn_web::html;
///
/// let html = Count::new().wrap(html! {
///     textarea name="bio" maxlength="280" {}
///     (Count::output_slot())
/// });
/// assert!(html.into_string().contains("data-vanilla-count-output"));
/// ```
#[derive(Debug, Clone, Default, PartialEq, Eq)]
#[must_use]
pub struct Count {
    output: Option<String>,
    mode: CountMode,
}

/// What [`Count`] shows.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash)]
#[non_exhaustive]
pub enum CountMode {
    /// `used/max`, for example `12/280`. Only `used` with no `maxlength`.
    #[default]
    Used,
    /// `max - used`, for example `268`. Only `used` with no `maxlength`.
    Remaining,
}

impl Count {
    /// Counts into the [`Count::output_slot`] inside the element.
    pub const fn new() -> Self {
        Self {
            output: None,
            mode: CountMode::Used,
        }
    }

    /// Counts into the first match of a CSS selector.
    pub fn output(mut self, selector: impl Into<String>) -> Self {
        self.output = Some(selector.into());
        self
    }

    /// Sets what to show.
    pub const fn mode(mut self, mode: CountMode) -> Self {
        self.mode = mode;
        self
    }

    /// The attributes, in render order.
    #[must_use]
    pub fn attributes(&self) -> Attributes {
        let mut attributes = vec![marker(Behavior::Count)];
        if let Some(output) = &self.output {
            attributes.push(("data-vanilla-count", output.clone()));
        }
        if self.mode == CountMode::Remaining {
            attributes.push(("data-vanilla-count-mode", "remaining".to_owned()));
        }
        attributes
    }

    /// Renders an empty `<output data-vanilla-count-output>`.
    #[must_use]
    pub fn output_slot() -> Markup {
        html! { output data-vanilla-count-output {} }
    }
}

container!(Count);
