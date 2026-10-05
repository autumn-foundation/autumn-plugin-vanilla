use autumn_web::reexports::chrono::{DateTime, SecondsFormat, TimeZone, Utc};
use autumn_web::{Markup, html};

use super::{Behavior, marker};
use crate::markup::{Attributes, element};

/// Shows a `<time>` in the browser locale and time zone.
///
/// The server writes UTC text. The browser replaces it with local text and
/// keeps the server text as the `title`. The locale is the nearest `lang`
/// attribute, or the browser locale. On a wrapper, the behavior formats each
/// `<time datetime>` inside it.
///
/// ```rust
/// use autumn_plugin_vanilla::{LocalTime, TimeFormat};
/// use autumn_web::reexports::chrono::{TimeZone as _, Utc};
///
/// let at = Utc.with_ymd_and_hms(2026, 10, 5, 12, 0, 0).unwrap();
/// let html = LocalTime::new(&at).format(TimeFormat::Date).render().into_string();
/// assert!(html.starts_with(r#"<time datetime="2026-10-05T12:00:00Z""#), "{html}");
/// ```
#[derive(Debug, Clone, PartialEq, Eq)]
#[must_use]
pub struct LocalTime {
    at: DateTime<Utc>,
    format: TimeFormat,
    fallback: Option<String>,
}

/// How [`LocalTime`] formats the time.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash)]
#[non_exhaustive]
pub enum TimeFormat {
    /// Date and time, for example `Oct 5, 2026, 8:00 AM`.
    #[default]
    DateTime,
    /// Date only, for example `Oct 5, 2026`.
    Date,
    /// Time only, for example `8:00 AM`.
    Time,
    /// Relative to now, for example `2 hours ago`. Set at page load only.
    Relative,
}

impl TimeFormat {
    /// The value of `data-vanilla-local-time`.
    #[must_use]
    pub const fn name(self) -> &'static str {
        match self {
            Self::DateTime => "datetime",
            Self::Date => "date",
            Self::Time => "time",
            Self::Relative => "relative",
        }
    }
}

impl LocalTime {
    /// Shows `at`. Any time zone is converted to UTC for the `datetime`.
    pub fn new<Tz: TimeZone>(at: &DateTime<Tz>) -> Self {
        Self {
            at: at.with_timezone(&Utc),
            format: TimeFormat::DateTime,
            fallback: None,
        }
    }

    /// Sets the format.
    pub const fn format(mut self, format: TimeFormat) -> Self {
        self.format = format;
        self
    }

    /// Sets the text to show without JavaScript. The default is
    /// `YYYY-MM-DD HH:MM UTC`.
    pub fn fallback(mut self, text: impl Into<String>) -> Self {
        self.fallback = Some(text.into());
        self
    }

    /// The attributes, in render order.
    #[must_use]
    pub fn attributes(&self) -> Attributes {
        let mut attributes = vec![
            (
                "datetime",
                self.at.to_rfc3339_opts(SecondsFormat::Secs, true),
            ),
            marker(Behavior::LocalTime),
        ];
        if self.format != TimeFormat::DateTime {
            attributes.push(("data-vanilla-local-time", self.format.name().to_owned()));
        }
        attributes
    }

    /// Renders the `<time>` element.
    #[must_use]
    pub fn render(&self) -> Markup {
        let text = self
            .fallback
            .clone()
            .unwrap_or_else(|| self.at.format("%Y-%m-%d %H:%M UTC").to_string());
        element("time", &self.attributes(), html! { (text) })
    }
}

impl maud::Render for LocalTime {
    fn render(&self) -> Markup {
        Self::render(self)
    }
}
