use autumn_web::Markup;

use super::{Behavior, button, marker};
use crate::markup::{Attributes, common};

/// Shows or hides target elements on click.
///
/// Without a class, it toggles the `hidden` property. With a class, it
/// toggles that class. All targets get the opposite of the first target's
/// state. The control gets `aria-expanded`, so put this behavior on a
/// `<button>`. There is no `wrap`.
///
/// ```rust
/// use autumn_plugin_vanilla::Toggle;
/// use autumn_web::html;
///
/// let html = Toggle::target("#menu").button(html! { "Menu" }).into_string();
/// assert!(html.contains(r#"aria-controls="menu""#), "{html}");
/// ```
#[derive(Debug, Clone, PartialEq, Eq)]
#[must_use]
pub struct Toggle {
    target: String,
    class: Option<String>,
    extra: Attributes,
}

impl Toggle {
    /// Toggles all matches of a CSS selector.
    ///
    /// The selector is trusted input. Do not make it from user data.
    pub fn target(selector: impl Into<String>) -> Self {
        Self {
            target: selector.into(),
            class: None,
            extra: Vec::new(),
        }
    }

    /// Toggles this class, not the `hidden` property.
    pub fn class(mut self, class: impl Into<String>) -> Self {
        self.class = Some(class.into());
        self
    }

    /// The attributes, in render order.
    #[must_use]
    pub fn attributes(&self) -> Attributes {
        let mut attributes = vec![
            marker(Behavior::Toggle),
            ("data-vanilla-toggle", self.target.clone()),
        ];
        if let Some(class) = &self.class {
            attributes.push(("data-vanilla-toggle-class", class.clone()));
        }
        attributes.extend(self.extra.iter().cloned());
        attributes
    }

    /// Renders a `<button type="button">` that toggles. When the target is a
    /// plain `#id` selector, the button also gets `aria-controls`.
    #[must_use]
    pub fn button(&self, content: Markup) -> Markup {
        let mut attributes = self.attributes();
        if let Some(id) = plain_id(&self.target) {
            attributes.push(("aria-controls", id.to_owned()));
        }
        button(attributes, content)
    }
}

common!(Toggle);

/// The id in a selector of the form `#id`, or `None`.
pub(crate) fn plain_id(selector: &str) -> Option<&str> {
    let id = selector.strip_prefix('#')?;
    let mut chars = id.chars();
    let first = chars.next()?;
    let valid = first.is_ascii_alphabetic()
        && chars.all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    valid.then_some(id)
}

#[cfg(test)]
mod tests {
    use super::plain_id;

    #[test]
    fn plain_id_accepts_only_simple_ids() {
        assert_eq!(plain_id("#menu"), Some("menu"));
        assert_eq!(plain_id("#main-menu_2"), Some("main-menu_2"));
        assert_eq!(plain_id("#"), None);
        assert_eq!(plain_id("#1a"), None);
        assert_eq!(plain_id("#a b"), None);
        assert_eq!(plain_id("#a.b"), None);
        assert_eq!(plain_id(".menu"), None);
        assert_eq!(plain_id("menu"), None);
    }
}
