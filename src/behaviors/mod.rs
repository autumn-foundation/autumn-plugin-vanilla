//! Typed builders. Each builder writes the attributes of one behavior.
//!
//! All builders have `attributes()`, for any template engine, and `attr()`,
//! for extra attributes. Most builders also have `wrap()`, which puts
//! content in a `<div>` with those attributes. A behavior acts on events from
//! its element and from the descendants of that element.

mod autosubmit;
mod confirm;
mod copy;
mod count;
mod dismiss;
mod local_time;
mod toggle;

use std::fmt;

use autumn_web::Markup;

pub use autosubmit::AutoSubmit;
pub use confirm::Confirm;
pub use copy::CopyText;
pub use count::{Count, CountMode, OutputSlot};
pub use dismiss::Dismiss;
pub use local_time::{LocalTime, TimeFormat};
pub use toggle::Toggle;

/// A built-in behavior. Use it as the value of `data-vanilla` in raw markup.
///
/// ```rust
/// use autumn_plugin_vanilla::Behavior;
/// use autumn_web::html;
///
/// let html = html! { button data-vanilla=(Behavior::Copy) {} };
/// assert_eq!(html.into_string(), r#"<button data-vanilla="copy"></button>"#);
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[non_exhaustive]
pub enum Behavior {
    /// Submits the form when a field changes.
    AutoSubmit,
    /// Asks the user before a form submits or a link opens.
    Confirm,
    /// Copies text to the clipboard on click.
    Copy,
    /// Shows the character count of a field.
    Count,
    /// Removes the element when the user clicks a close control, or after a time.
    Dismiss,
    /// Shows a `<time>` in the browser locale and time zone.
    LocalTime,
    /// Shows or hides target elements on click.
    Toggle,
}

impl Behavior {
    /// All built-in behaviors, in name order.
    pub const ALL: &'static [Self] = &[
        Self::AutoSubmit,
        Self::Confirm,
        Self::Copy,
        Self::Count,
        Self::Dismiss,
        Self::LocalTime,
        Self::Toggle,
    ];

    /// The name that `vanilla.js` registers.
    #[must_use]
    pub const fn name(self) -> &'static str {
        match self {
            Self::AutoSubmit => "autosubmit",
            Self::Confirm => "confirm",
            Self::Copy => "copy",
            Self::Count => "count",
            Self::Dismiss => "dismiss",
            Self::LocalTime => "local-time",
            Self::Toggle => "toggle",
        }
    }
}

impl fmt::Display for Behavior {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.name())
    }
}

impl maud::Render for Behavior {
    fn render_to(&self, buffer: &mut String) {
        // Names are lowercase ASCII and `-`. They need no escaping.
        buffer.push_str(self.name());
    }
}

/// The `data-vanilla` pair for `behavior`.
fn marker(behavior: Behavior) -> (&'static str, String) {
    ("data-vanilla", behavior.name().to_owned())
}

/// A `<button type="button">` with `attributes` and `content`.
fn button(attributes: Vec<(&'static str, String)>, content: Markup) -> Markup {
    let mut all = Vec::with_capacity(attributes.len() + 1);
    all.push(("type", "button".to_owned()));
    all.extend(attributes);
    crate::markup::element("button", &all, content)
}
