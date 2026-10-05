//! Shared rendering for the builders.

use std::fmt::Write as _;
use std::time::Duration;

use autumn_web::{Markup, PreEscaped};

/// Attribute name and value pairs, in render order.
pub type Attributes = Vec<(&'static str, String)>;

/// The largest delay that the browser `setTimeout` accepts, in milliseconds.
pub(crate) const TIMER_MAX: u32 = 2_147_483_647;

/// A duration in whole milliseconds, clamped to [`TIMER_MAX`].
pub(crate) fn millis(duration: Duration) -> u32 {
    u32::try_from(duration.as_millis()).map_or(TIMER_MAX, |ms| ms.min(TIMER_MAX))
}

/// Renders `<tag name="value" …>content</tag>`.
///
/// `tag` and the names are crate constants. Each value is HTML-escaped
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

/// Adds the shared `wrap` and `attributes` docs and methods to a builder.
macro_rules! container {
    ($ty:ty) => {
        impl $ty {
            /// Wraps `content` in a `<div>` that has the behavior attributes.
            #[must_use]
            pub fn wrap(&self, content: autumn_web::Markup) -> autumn_web::Markup {
                $crate::markup::element("div", &self.attributes(), content)
            }
        }
    };
}

pub(crate) use container;

#[cfg(test)]
mod tests {
    use super::*;
    use autumn_web::html;

    #[test]
    fn millis_converts_and_clamps() {
        assert_eq!(millis(Duration::ZERO), 0);
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
}
