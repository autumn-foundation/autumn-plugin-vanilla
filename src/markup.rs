//! Shared rendering for the builders.

use std::fmt::Write as _;
use std::time::Duration;

use autumn_web::{Markup, PreEscaped};

/// Attribute name and value pairs, in render order.
///
/// The values are not escaped. If you write them into HTML yourself, escape
/// them first. The builders' `button`, `wrap` and `render` methods escape
/// them for you.
pub type Attributes = Vec<(&'static str, String)>;

/// The largest delay that the browser `setTimeout` accepts, in milliseconds.
pub(crate) const TIMER_MAX: u32 = 2_147_483_647;

/// A duration in whole milliseconds. A non-zero duration gives at least 1.
/// The function limits the value to [`TIMER_MAX`].
pub(crate) fn millis(duration: Duration) -> u32 {
    if duration.is_zero() {
        return 0;
    }
    u32::try_from(duration.as_millis()).map_or(TIMER_MAX, |ms| ms.clamp(1, TIMER_MAX))
}

/// Renders `<tag name="value" …>content</tag>`.
///
/// `tag` and the names are static strings. The function escapes each value
/// (`&`, `<`, `>`, `"`), so a value cannot close its attribute.
pub(crate) fn element(
    tag: &'static str,
    attributes: &[(&'static str, String)],
    content: Markup,
) -> Markup {
    let mut html = String::with_capacity(64 + content.0.len());
    html.push('<');
    html.push_str(tag);
    for (name, value) in attributes {
        html.push(' ');
        html.push_str(name);
        html.push_str("=\"");
        // Writing to a String cannot fail.
        let _ = write!(maud::Escaper::new(&mut html), "{value}");
        html.push('"');
    }
    html.push('>');
    html.push_str(&content.into_string());
    html.push_str("</");
    html.push_str(tag);
    html.push('>');
    PreEscaped(html)
}

/// True when `name` is a safe extra attribute name.
///
/// Allowed: ASCII letters, digits, `-`, `_` and `:`, starting with a letter.
/// Refused: event handlers (`on…`), `style`, `type`, and the `data-vanilla`
/// names that the builders own.
pub(crate) fn valid_extra_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    let mut chars = name.chars();
    let first_ok = chars.next().is_some_and(|c| c.is_ascii_alphabetic());
    let rest_ok = chars.all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | ':'));
    first_ok
        && rest_ok
        && !lower.starts_with("on")
        && lower != "style"
        && lower != "type"
        && !lower.starts_with("data-vanilla")
}

/// Adds `attr` (extra attributes) to a builder that has an `extra` field.
/// With `wrap`, it also adds `wrap` (a `<div>` around content).
macro_rules! common {
    ($ty:ty) => {
        impl $ty {
            /// Adds an extra attribute, for example `id`, `class` or
            /// `aria-label`.
            ///
            /// The name must start with an ASCII letter and contain only
            /// ASCII letters, digits, `-`, `_` and `:`. The builder ignores
            /// (and logs) event handler names (`on…`), `style`, `type` and
            /// `data-vanilla…` names.
            pub fn attr(mut self, name: &'static str, value: impl Into<String>) -> Self {
                if $crate::markup::valid_extra_name(name) {
                    self.extra.push((name, value.into()));
                } else {
                    autumn_web::reexports::tracing::warn!(
                        attribute = name,
                        "autumn-plugin-vanilla: extra attribute name refused"
                    );
                }
                self
            }
        }
    };
    ($ty:ty, wrap) => {
        $crate::markup::common!($ty);

        impl $ty {
            /// Wraps `content` in a `<div>` that has the behavior attributes.
            #[must_use]
            pub fn wrap(&self, content: autumn_web::Markup) -> autumn_web::Markup {
                $crate::markup::element("div", &self.attributes(), content)
            }
        }
    };
}

pub(crate) use common;

#[cfg(test)]
mod tests {
    use super::*;
    use autumn_web::html;

    #[test]
    fn millis_converts_and_clamps() {
        assert_eq!(millis(Duration::ZERO), 0);
        assert_eq!(millis(Duration::from_nanos(1)), 1);
        assert_eq!(millis(Duration::from_micros(500)), 1);
        assert_eq!(millis(Duration::from_micros(1999)), 1);
        assert_eq!(millis(Duration::from_secs(5)), 5000);
        assert_eq!(
            millis(Duration::from_millis(u64::from(TIMER_MAX) + 1)),
            TIMER_MAX
        );
        assert_eq!(millis(Duration::MAX), TIMER_MAX);
    }

    #[test]
    fn element_escapes_values_and_keeps_content() {
        let html = element(
            "p",
            &[("title", r#"a"b<c>&"#.to_owned())],
            html! { b { "x" } },
        );
        assert_eq!(
            html.into_string(),
            r#"<p title="a&quot;b&lt;c&gt;&amp;"><b>x</b></p>"#
        );
    }

    #[test]
    fn element_with_no_attributes() {
        assert_eq!(element("div", &[], html! {}).into_string(), "<div></div>");
    }

    #[test]
    fn extra_names_are_validated() {
        for ok in ["id", "class", "aria-label", "hx-get", "xml:lang", "data-x"] {
            assert!(valid_extra_name(ok), "{ok}");
        }
        for bad in [
            "",
            "onclick",
            "OnClick",
            "style",
            "type",
            "data-vanilla",
            "data-vanilla-copy",
            "1a",
            "-a",
            "a b",
            "a\"",
            "a=b",
            "a>",
        ] {
            assert!(!valid_extra_name(bad), "{bad:?}");
        }
    }
}
