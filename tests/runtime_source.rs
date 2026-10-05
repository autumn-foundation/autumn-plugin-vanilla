//! Static checks on `assets/vanilla.js`. Browser tests in `js-tests/` check
//! the behavior. These tests check what a browser test cannot see.

// Test helpers fail with a panic on purpose.
#![allow(clippy::expect_used, clippy::panic)]

const SOURCE: &str = include_str!("../assets/vanilla.js");

/// Removes `//` line comments and `/* */` block comments. The runtime has
/// no `//` or `/*` inside string literals, so this simple pass is enough.
fn code_only(source: &str) -> String {
    let mut out = String::with_capacity(source.len());
    let mut rest = source;
    while let Some(start) = rest.find("/*") {
        out.push_str(&rest[..start]);
        rest = rest[start..]
            .find("*/")
            .map_or("", |end| &rest[start + end + 2..]);
    }
    out.push_str(rest);
    out.lines()
        .map(|line| line.split_once("//").map_or(line, |(code, _)| code))
        .collect::<Vec<_>>()
        .join("\n")
}

#[test]
fn uses_no_dynamic_code_or_html_sinks() {
    let code = code_only(SOURCE);
    for sink in [
        "eval(",
        "new Function",
        "Function(",
        "innerHTML",
        "outerHTML",
        "insertAdjacentHTML",
        "document.write",
        "setTimeout('",
        "setTimeout(\"",
        "setInterval",
        "javascript:",
    ] {
        assert!(!code.contains(sink), "vanilla.js must not use `{sink}`");
    }
}

#[test]
fn is_strict_and_wrapped() {
    let code = code_only(SOURCE);
    assert!(code.contains("'use strict'"), "strict mode");
    assert!(
        code.trim_start().starts_with("(function ()"),
        "one IIFE, no globals other than window.Vanilla"
    );
}

#[test]
fn hooks_into_htmx() {
    let code = code_only(SOURCE);
    assert!(code.contains("'htmx:load'"), "binds swapped content");
    assert!(
        code.contains("'htmx:beforeCleanupElement'"),
        "cleans up removed content"
    );
}

#[test]
fn registers_every_rust_behavior() {
    let code = code_only(SOURCE);
    for behavior in autumn_plugin_vanilla::Behavior::ALL {
        let call = format!("register('{}'", behavior.name());
        assert!(code.contains(&call), "vanilla.js must have `{call}`");
    }
}

#[test]
fn comment_stripper_works() {
    assert_eq!(code_only("a /* b */ c // d\ne"), "a  c \ne");
    assert_eq!(code_only("a /* open"), "a ");
}
