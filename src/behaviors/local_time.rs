use autumn_web::Markup;
use autumn_web::html;
use autumn_web::reexports::chrono::{DateTime, SecondsFormat, TimeZone, Utc};

use super::{Behavior, marker};
use crate::markup::{Attributes, common, element};

/// Shows a `<time>` in the browser locale and time zone.
///
/// The server writes UTC text. The browser replaces it with local text. If
/// the element has no `title`, the runtime copies the server text to
/// `title`. The locale is the nearest `lang` attribute, or the browser
/// locale. The runtime sets the text one time, when it binds. The text does
/// not update.
///
/// To format many `<time datetime>` elements, put
/// `data-vanilla=(Behavior::LocalTime)` on a container.
///
/// The type uses chrono through `autumn_web::reexports::chrono`.
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
    extra: Attributes,
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
    /// Relative to now, for example `2 hours ago`.
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

    /// The `strftime` pattern of the server text.
    const fn pattern(self) -> &'static str {
        match self {
            Self::Date => "%Y-%m-%d",
            Self::Time => "%H:%M UTC",
            Self::DateTime | Self::Relative => "%Y-%m-%d %H:%M UTC",
        }
    }
}

impl LocalTime {
    /// Shows `at`. It converts any time zone to UTC for `datetime`.
    pub fn new<Tz: TimeZone>(at: &DateTime<Tz>) -> Self {
        Self {
            at: at.with_timezone(&Utc),
            format: TimeFormat::DateTime,
            fallback: None,
            extra: Vec::new(),
        }
    }

    /// Sets the format.
    pub const fn format(mut self, format: TimeFormat) -> Self {
        self.format = format;
        self
    }

    /// Sets the text to show without JavaScript. The default is UTC text
    /// that matches the format, for example `2026-10-05 12:00 UTC`.
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
        attributes.extend(self.extra.iter().cloned());
        attributes
    }

    /// Renders the `<time>` element.
    #[must_use]
    pub fn render(&self) -> Markup {
        let text = self
            .fallback
            .clone()
            .unwrap_or_else(|| self.at.format(self.format.pattern()).to_string());
        element("time", &self.attributes(), html! { (text) })
    }
}

common!(LocalTime);

impl maud::Render for LocalTime {
    fn render(&self) -> Markup {
        Self::render(self)
    }
}
