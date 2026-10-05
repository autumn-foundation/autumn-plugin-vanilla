use autumn_web::{Markup, html};

use super::{Behavior, marker};
use crate::markup::{Attributes, common};

/// Shows the character count of a field.
///
/// The field is the element itself (an `input` or `textarea`), or the first
/// one inside it. The output must have `data-vanilla-count-output`: use
/// [`Count::output_slot`]. It is the [`output`](Self::output) selector
/// match, or the slot inside the element. The count uses UTF-16 code units,
/// the same unit as `maxlength`.
///
/// The slot has `aria-live="off"`, so a screen reader does not read each
/// key press. Point the field at the slot with `aria-describedby`.
///
/// ```rust
/// use autumn_plugin_vanilla::Count;
/// use autumn_web::html;
///
/// let html = Count::new().wrap(html! {
///     textarea name="bio" maxlength="280" aria-describedby="bio-count" {}
///     (Count::output_slot().attr("id", "bio-count").render())
/// });
/// assert!(html.into_string().contains("data-vanilla-count-output"));
/// ```
#[derive(Debug, Clone, Default, PartialEq, Eq)]
#[must_use]
pub struct Count {
    output: Option<String>,
    mode: CountMode,
    extra: Attributes,
}

/// What [`Count`] shows.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash)]
#[non_exhaustive]
pub enum CountMode {
    /// `used/max`, for example `12/280`. Without `maxlength`, only `used`.
    #[default]
    Used,
    /// `max - used`, for example `268`. Without `maxlength`, only `used`.
    Remaining,
}

impl CountMode {
    /// The value of `data-vanilla-count-mode`.
    #[must_use]
    pub const fn name(self) -> &'static str {
        match self {
            Self::Used => "used",
            Self::Remaining => "remaining",
        }
    }
}

impl Count {
    /// Counts into the [`Count::output_slot`] inside the element.
    pub const fn new() -> Self {
        Self {
            output: None,
            mode: CountMode::Used,
            extra: Vec::new(),
        }
    }

    /// Counts into the first match of a CSS selector. The match must have
    /// `data-vanilla-count-output`. An empty selector has no effect.
    pub fn output(mut self, selector: impl Into<String>) -> Self {
        let selector = selector.into();
        self.output = (!selector.trim().is_empty()).then_some(selector);
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
        if self.mode != CountMode::Used {
            attributes.push(("data-vanilla-count-mode", self.mode.name().to_owned()));
        }
        attributes.extend(self.extra.iter().cloned());
        attributes
    }

    /// An empty `<output data-vanilla-count-output aria-live="off">`. Add an
    /// `id` with [`OutputSlot::attr`].
    pub const fn output_slot() -> OutputSlot {
        OutputSlot { extra: Vec::new() }
    }
}

common!(Count, wrap);

/// The output element of [`Count`]. Render it with `(slot.render())` or
/// directly in Maud: `(Count::output_slot())`.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
#[must_use]
pub struct OutputSlot {
    extra: Attributes,
}

impl OutputSlot {
    /// The attributes, in render order.
    #[must_use]
    pub fn attributes(&self) -> Attributes {
        let mut attributes = vec![
            ("data-vanilla-count-output", String::new()),
            ("aria-live", "off".to_owned()),
        ];
        attributes.extend(self.extra.iter().cloned());
        attributes
    }

    /// Renders the `<output>` element.
    #[must_use]
    pub fn render(&self) -> Markup {
        crate::markup::element("output", &self.attributes(), html! {})
    }
}

common!(OutputSlot);

impl maud::Render for OutputSlot {
    fn render(&self) -> Markup {
        Self::render(self)
    }
}
