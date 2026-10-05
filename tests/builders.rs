//! Typed builders write the attributes that `vanilla.js` reads.

use std::time::Duration;

use autumn_plugin_vanilla::{
    AutoSubmit, Behavior, Confirm, Copy, Count, CountMode, Dismiss, LocalTime, TimeFormat, Toggle,
};
use autumn_web::html;
use autumn_web::reexports::chrono::{FixedOffset, TimeZone as _, Utc};

#[test]
fn behavior_names_match_the_runtime() {
    let names: Vec<&str> = Behavior::ALL.iter().map(|b| b.name()).collect();
    assert_eq!(
        names,
        [
            "autosubmit",
            "confirm",
            "copy",
            "count",
            "dismiss",
            "local-time",
            "toggle"
        ]
    );
    for behavior in Behavior::ALL {
        assert_eq!(behavior.to_string(), behavior.name());
    }
}

#[test]
fn behavior_renders_as_an_attribute_value() {
    let html = html! { button data-vanilla=(Behavior::Copy) {} }.into_string();
    assert_eq!(html, r#"<button data-vanilla="copy"></button>"#);
}

#[test]
fn copy_button_from_a_selector() {
    let html = Copy::selector("#api-key")
        .button(html! { "Copy" })
        .into_string();
    assert_eq!(
        html,
        r##"<button type="button" data-vanilla="copy" data-vanilla-copy="#api-key">Copy</button>"##
    );
}

#[test]
fn copy_wrap_with_literal_text() {
    let html = Copy::text("cargo add x")
        .wrap(html! { button { "Copy" } })
        .into_string();
    assert_eq!(
        html,
        r#"<div data-vanilla="copy" data-vanilla-copy-text="cargo add x"><button>Copy</button></div>"#
    );
}

#[test]
fn toggle_button_adds_aria_controls_for_an_id_selector() {
    let html = Toggle::target("#main-menu")
        .button(html! { "Menu" })
        .into_string();
    assert_eq!(
        html,
        r##"<button type="button" data-vanilla="toggle" data-vanilla-toggle="#main-menu" aria-controls="main-menu">Menu</button>"##
    );
}

#[test]
fn toggle_with_a_class_and_a_complex_selector() {
    let html = Toggle::target(".row > p")
        .class("open")
        .button(html! { "T" })
        .into_string();
    assert_eq!(
        html,
        r#"<button type="button" data-vanilla="toggle" data-vanilla-toggle=".row &gt; p" data-vanilla-toggle-class="open">T</button>"#
    );
}

#[test]
fn dismiss_wrap_with_a_timer_and_close_button() {
    let html = Dismiss::new()
        .after(Duration::from_secs(5))
        .wrap(html! { "Saved " (Dismiss::close_button(html! { "×" })) })
        .into_string();
    assert_eq!(
        html,
        r#"<div data-vanilla="dismiss" data-vanilla-dismiss-after="5000">Saved <button type="button" data-vanilla-dismiss-close>×</button></div>"#
    );
}

#[test]
fn dismiss_without_a_timer() {
    let html = Dismiss::default().wrap(html! { "x" }).into_string();
    assert_eq!(html, r#"<div data-vanilla="dismiss">x</div>"#);
}

#[test]
fn dismiss_clamps_huge_durations_to_the_timer_limit() {
    let attrs = Dismiss::new().after(Duration::MAX).attributes();
    assert!(
        attrs.contains(&("data-vanilla-dismiss-after", "2147483647".to_owned())),
        "{attrs:?}"
    );
}

#[test]
fn confirm_wrap_with_a_message() {
    let html = Confirm::new("Delete \"all\"?")
        .wrap(html! { form {} })
        .into_string();
    assert_eq!(
        html,
        r#"<div data-vanilla="confirm" data-vanilla-confirm="Delete &quot;all&quot;?"><form></form></div>"#
    );
}

#[test]
fn confirm_default_uses_the_runtime_message() {
    let html = Confirm::default().wrap(html! {}).into_string();
    assert_eq!(html, r#"<div data-vanilla="confirm"></div>"#);
}

#[test]
fn autosubmit_on_change_and_on_input() {
    let change = AutoSubmit::new().wrap(html! {}).into_string();
    assert_eq!(change, r#"<div data-vanilla="autosubmit"></div>"#);
    let input = AutoSubmit::new()
        .on_input()
        .delay(Duration::from_millis(300))
        .wrap(html! {})
        .into_string();
    assert_eq!(
        input,
        r#"<div data-vanilla="autosubmit" data-vanilla-autosubmit-on="input" data-vanilla-autosubmit-delay="300"></div>"#
    );
}

#[test]
fn count_wrap_with_an_output_slot() {
    let html = Count::new()
        .mode(CountMode::Remaining)
        .wrap(html! { textarea maxlength="280" {} (Count::output_slot()) })
        .into_string();
    assert_eq!(
        html,
        r#"<div data-vanilla="count" data-vanilla-count-mode="remaining"><textarea maxlength="280"></textarea><output data-vanilla-count-output></output></div>"#
    );
}

#[test]
fn count_with_an_output_selector() {
    let attrs = Count::new().output("#bio-count").attributes();
    assert_eq!(
        attrs,
        [
            ("data-vanilla", "count".to_owned()),
            ("data-vanilla-count", "#bio-count".to_owned()),
        ]
    );
}

#[test]
fn local_time_renders_a_time_element_in_utc() {
    let at = Utc.with_ymd_and_hms(2026, 10, 5, 12, 0, 0).single();
    let at = at.expect("valid date");
    let html = LocalTime::new(&at).render().into_string();
    assert_eq!(
        html,
        r#"<time datetime="2026-10-05T12:00:00Z" data-vanilla="local-time">2026-10-05 12:00 UTC</time>"#
    );
}

#[test]
fn local_time_converts_offsets_to_utc_and_sets_a_format() {
    let offset = FixedOffset::east_opt(2 * 3600).expect("valid offset");
    let at = offset
        .with_ymd_and_hms(2026, 10, 5, 14, 30, 0)
        .single()
        .expect("valid date");
    let html = LocalTime::new(&at)
        .format(TimeFormat::Relative)
        .fallback("today")
        .render()
        .into_string();
    assert_eq!(
        html,
        r#"<time datetime="2026-10-05T12:30:00Z" data-vanilla="local-time" data-vanilla-local-time="relative">today</time>"#
    );
}

#[test]
fn time_format_names_match_the_runtime() {
    let names: Vec<&str> = [
        TimeFormat::DateTime,
        TimeFormat::Date,
        TimeFormat::Time,
        TimeFormat::Relative,
    ]
    .iter()
    .map(|f| f.name())
    .collect();
    assert_eq!(names, ["datetime", "date", "time", "relative"]);
}

#[test]
fn builders_escape_markup_in_values() {
    let html = Copy::text("</button><script>alert(1)</script>")
        .button(html! { "x" })
        .into_string();
    assert!(!html.contains("<script>"), "{html}");
    assert!(html.contains("&lt;script&gt;"), "{html}");
}
