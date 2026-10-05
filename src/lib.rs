//! Declarative vanilla JS behaviors for Autumn apps. No npm, no bundler.
//!
//! Add [`VanillaPlugin`], put [`vanilla_script()`] in the page `<head>`, and
//! write attributes with the typed builders:
//!
//! ```rust,no_run
//! use autumn_plugin_vanilla::{Copy, Toggle, VanillaPlugin, vanilla_script};
//! use autumn_web::prelude::*;
//!
//! #[get("/")]
//! async fn index() -> Markup {
//!     html! {
//!         html {
//!             head { (vanilla_script()) }
//!             body {
//!                 input id="key" value="sk-123" readonly;
//!                 (Copy::selector("#key").button(html! { "Copy" }))
//!                 (Toggle::target("#more").button(html! { "More" }))
//!                 div id="more" hidden { "Details" }
//!             }
//!         }
//!     }
//! }
//!
//! # async fn run() {
//! autumn_web::app()
//!     .plugin(VanillaPlugin::new())
//!     .routes(routes![index])
//!     .run()
//!     .await;
//! # }
//! ```
//!
//! The runtime (`vanilla.js`) binds each `data-vanilla` element on page
//! load and after each htmx swap. It runs cleanup before htmx removes an
//! element. It uses no `eval` and no HTML strings, so it works under the
//! default CSP (`script-src 'self'`).
//!
//! Built-in behaviors: see [`Behavior`]. Add your own in a same-origin
//! script: `Vanilla.register("name", (el) => { …; return cleanup; })`.

mod assets;
mod behaviors;
mod markup;
mod plugin;
mod script;

pub use assets::{ASSETS_NAMESPACE, VANILLA_ASSETS, VANILLA_JS};
pub use behaviors::{
    AutoSubmit, Behavior, Confirm, Copy, Count, CountMode, Dismiss, LocalTime, TimeFormat, Toggle,
};
pub use markup::Attributes;
pub use plugin::{PLUGIN_NAME, VanillaPlugin};
pub use script::vanilla_script;
