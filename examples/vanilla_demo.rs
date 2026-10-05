//! Demo app for `autumn-plugin-vanilla`.
//!
//! ```sh
//! cargo run --example vanilla_demo
//! ```
//!
//! Then open <http://127.0.0.1:3000>. Each section shows one behavior. The
//! htmx buttons add and remove content, so you can see that the runtime
//! binds new content and cleans up removed content.
//!
//! All JS and CSS are external files. Autumn's default CSP blocks inline
//! scripts. `static/js/app.js` adds an app behavior, `greet`.

use std::sync::atomic::{AtomicU32, Ordering};

use autumn_plugin_vanilla::{
    AutoSubmit, Confirm, Copy, Count, CountMode, Dismiss, LocalTime, TimeFormat, Toggle,
    VanillaPlugin, vanilla_script,
};
use autumn_web::assets::asset_url;
use autumn_web::reexports::chrono::Utc;
use autumn_web::{Markup, html};

static STATIC: autumn_web::include_dir::Dir = autumn_web::embed_static!();

/// Numbers the htmx fragments.
static NEXT: AtomicU32 = AtomicU32::new(1);

#[autumn_web::main]
async fn main() {
    autumn_web::app()
        .plugin(VanillaPlugin::new())
        .embedded_static(&STATIC)
        .routes(autumn_web::routes![
            index, flash, greeting, clear, search, deleted
        ])
        .run()
        .await;
}

fn layout(content: &Markup) -> Markup {
    html! {
        (maud::DOCTYPE)
        html lang="en" {
            head {
                meta charset="utf-8";
                meta name="viewport" content="width=device-width, initial-scale=1";
                title { "Vanilla demo" }
                link rel="stylesheet" href=(asset_url("css/demo.css"));
                script src=(asset_url("js/htmx.min.js")) defer {}
                (vanilla_script())
                // After vanilla.js, so `Vanilla.register` exists.
                script src=(asset_url("js/app.js")) defer {}
            }
            body { (content) }
        }
    }
}

#[autumn_web::get("/")]
async fn index() -> Markup {
    let now = Utc::now();
    layout(&html! {
        h1 { "autumn-plugin-vanilla" }

        section id="copy" {
            h2 { "copy" }
            input id="api-key" value="sk-demo-123" readonly;
            " "
            (Copy::selector("#api-key").button(html! { "Copy key" }))
        }

        section id="toggle" {
            h2 { "toggle" }
            (Toggle::target("#details").button(html! { "Show details" }))
            " "
            (Toggle::target("#box").class("open").button(html! { "Outline box" }))
            p id="details" hidden { "These are the details." }
            p id="box" { "A box." }
        }

        section id="dismiss" {
            h2 { "dismiss (htmx)" }
            button id="add-flash" hx-get="/flash" hx-target="#flashes" hx-swap="beforeend" {
                "Add flash"
            }
            div id="flashes" {
                (Dismiss::new().wrap(html! {
                    div class="flash" {
                        "Static flash. "
                        (Dismiss::close_button(html! { "Close" }))
                    }
                }))
            }
        }

        section id="greet" {
            h2 { "app behavior (htmx)" }
            button id="add-greeting" hx-get="/greeting" hx-target="#greetings" hx-swap="beforeend" {
                "Add greeting"
            }
            " "
            button id="clear-greetings" hx-get="/clear" hx-target="#greetings" hx-swap="innerHTML" {
                "Clear"
            }
            div id="greetings" {
                p data-vanilla="greet" data-name="page" { "…" }
            }
        }

        section id="confirm" {
            h2 { "confirm" }
            (Confirm::new("Delete the demo record?").wrap(html! {
                form action="/deleted" method="get" {
                    button id="delete" { "Delete" }
                }
            }))
        }

        section id="autosubmit" {
            h2 { "autosubmit" }
            form action="/search" method="get" hx-get="/search" hx-target="#results" {
                (AutoSubmit::new().wrap(html! {
                    select id="sort" name="sort" {
                        option value="new" { "Newest" }
                        option value="old" { "Oldest" }
                    }
                }))
            }
            div id="results" { "Sort: new" }
        }

        section id="count" {
            h2 { "count" }
            (Count::new().mode(CountMode::Remaining).wrap(html! {
                textarea id="bio" name="bio" maxlength="140" {}
                " " (Count::output_slot()) " left"
            }))
        }

        section id="local-time" {
            h2 { "local-time" }
            p { "Page rendered " (LocalTime::new(&now).format(TimeFormat::Relative)) "." }
            p { "Exact: " (LocalTime::new(&now)) }
        }
    })
}

#[autumn_web::get("/flash")]
async fn flash() -> Markup {
    let n = NEXT.fetch_add(1, Ordering::Relaxed);
    Dismiss::new()
        .after(std::time::Duration::from_secs(8))
        .wrap(html! {
            div class="flash" {
                "Flash " (n) ". It closes in 8 seconds. "
                (Copy::text(format!("flash-{n}")).button(html! { "Copy id" }))
                " "
                (Dismiss::close_button(html! { "Close" }))
            }
        })
}

#[autumn_web::get("/greeting")]
async fn greeting() -> Markup {
    let n = NEXT.fetch_add(1, Ordering::Relaxed);
    html! { p data-vanilla="greet" data-name=(format!("htmx {n}")) { "…" } }
}

#[autumn_web::get("/clear")]
async fn clear() -> Markup {
    html! {}
}

#[derive(serde::Deserialize)]
struct Search {
    sort: Option<String>,
}

#[autumn_web::get("/search")]
async fn search(query: autumn_web::extract::Query<Search>) -> Markup {
    html! { "Sort: " (query.sort.as_deref().unwrap_or("new")) }
}

#[autumn_web::get("/deleted")]
async fn deleted() -> Markup {
    layout(&html! { h1 id="deleted" { "Deleted." } })
}
