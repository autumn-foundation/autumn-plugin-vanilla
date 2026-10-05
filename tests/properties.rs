//! Property tests for the builder invariants.
//!
//! Invariant 1: an attribute value always round-trips through HTML escaping,
//! and never closes its attribute or opens a tag.
//! Invariant 2: a duration always renders as an integer in
//! `0..=2_147_483_647`, the largest delay `setTimeout` accepts.

// Test helpers fail with a panic on purpose.
#![allow(clippy::expect_used, clippy::panic)]

use std::time::Duration;

use autumn_plugin_vanilla::{AutoSubmit, Confirm, Copy, Dismiss, Toggle};
use autumn_web::html;
use proptest::prelude::*;

const TIMER_MAX: u128 = 2_147_483_647;

fn unescape(value: &str) -> String {
    value
        .replace("&quot;", "\"")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&amp;", "&")
}

/// The value of attribute `name` in `html`, still escaped.
fn attr<'a>(html: &'a str, name: &str) -> &'a str {
    let at = html
        .find(&format!(" {name}=\""))
        .unwrap_or_else(|| panic!("{name} in {html}"));
    let start = at + name.len() + 3;
    let len = html[start..].find('"').expect("closing quote");
    &html[start..start + len]
}

proptest! {
    #[test]
    fn copy_text_round_trips(text in any::<String>()) {
        let html = Copy::text(text.clone()).button(html! { "x" }).into_string();
        let value = attr(&html, "data-vanilla-copy-text");
        prop_assert!(!value.contains('<') && !value.contains('>'));
        prop_assert_eq!(unescape(value), text);
        prop_assert!(html.ends_with(">x</button>"));
    }

    #[test]
    fn confirm_message_round_trips(text in any::<String>()) {
        let html = Confirm::new(text.clone()).wrap(html! {}).into_string();
        prop_assert_eq!(unescape(attr(&html, "data-vanilla-confirm")), text);
    }

    #[test]
    fn toggle_selector_and_class_round_trip(sel in any::<String>(), class in any::<String>()) {
        let html = Toggle::target(sel.clone()).class(class.clone()).button(html! {}).into_string();
        prop_assert_eq!(unescape(attr(&html, "data-vanilla-toggle")), sel);
        prop_assert_eq!(unescape(attr(&html, "data-vanilla-toggle-class")), class);
    }

    #[test]
    fn dismiss_after_is_clamped(secs in any::<u64>(), nanos in 0u32..1_000_000_000) {
        let duration = Duration::new(secs, nanos);
        let attrs = Dismiss::new().after(duration).attributes();
        let (_, value) = attrs
            .iter()
            .find(|(name, _)| *name == "data-vanilla-dismiss-after")
            .expect("after is set");
        let ms: u128 = value.parse().expect("integer");
        prop_assert_eq!(ms, duration.as_millis().min(TIMER_MAX));
    }

    #[test]
    fn autosubmit_delay_is_clamped(ms in any::<u64>()) {
        let attrs = AutoSubmit::new().delay(Duration::from_millis(ms)).attributes();
        let (_, value) = attrs
            .iter()
            .find(|(name, _)| *name == "data-vanilla-autosubmit-delay")
            .expect("delay is set");
        let parsed: u128 = value.parse().expect("integer");
        prop_assert_eq!(parsed, u128::from(ms).min(TIMER_MAX));
    }
}
