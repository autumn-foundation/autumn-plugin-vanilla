//! `VanillaPlugin` serves `vanilla.js` through the `plugin_assets` seam.

// Test helpers fail with a panic on purpose.
#![allow(clippy::expect_used, clippy::panic)]

use autumn_plugin_vanilla::{
    ASSETS_NAMESPACE, PLUGIN_NAME, VANILLA_ASSETS, VANILLA_JS, VanillaPlugin, vanilla_script,
};
use autumn_web::assets::{PLUGIN_ASSETS_ROUTE_MARKER, asset_url};
use autumn_web::plugin_conformance::{ConformanceConfig, run_conformance};
use autumn_web::route_listing::{RouteClassification, RouteSource};
use autumn_web::test::{TestApp, TestClient};
use base64::Engine as _;
use sha2::{Digest as _, Sha384};

const JS: &str = "text/javascript; charset=utf-8";
const IMMUTABLE: &str = "public, max-age=31536000, immutable";
const REVALIDATE: &str = "public, max-age=0, must-revalidate";
const PLAIN: &str = "/static/_plugins/vanilla/vanilla.js";

fn client() -> TestClient {
    TestApp::new().plugin(VanillaPlugin::new()).build()
}

fn sri(bytes: &[u8]) -> String {
    format!(
        "sha384-{}",
        base64::engine::general_purpose::STANDARD.encode(Sha384::digest(bytes))
    )
}

#[test]
fn bundle_holds_only_vanilla_js() {
    let files: Vec<&str> = VANILLA_ASSETS
        .iter()
        .map(autumn_web::assets::PluginAsset::logical_path)
        .collect();
    assert_eq!(files, [VANILLA_JS]);
    assert_eq!(VANILLA_JS, "vanilla.js");
    assert_eq!(ASSETS_NAMESPACE, "vanilla");
    assert_eq!(VANILLA_ASSETS.namespace(), ASSETS_NAMESPACE);
    assert_eq!(VANILLA_ASSETS.mount_path(), "/static/_plugins/vanilla");
}

#[test]
fn bundle_is_the_file_on_disk() {
    let asset = VANILLA_ASSETS.get(VANILLA_JS).expect("bundled");
    assert_eq!(asset.bytes(), include_bytes!("../assets/vanilla.js"));
    assert_eq!(asset.integrity(), sri(asset.bytes()));
    assert_eq!(asset.content_type(), JS);
    assert_eq!(asset.plain_url(), PLAIN);
}

#[test]
fn url_is_fingerprinted() {
    let url = VANILLA_ASSETS.url(VANILLA_JS);
    let hash = url
        .strip_prefix("/static/_plugins/vanilla/vanilla.")
        .and_then(|rest| rest.strip_suffix(".js"))
        .unwrap_or_else(|| panic!("{url} is fingerprinted"));
    assert_eq!(hash.len(), 8, "{url}");
    assert!(hash.bytes().all(|b| b.is_ascii_hexdigit()), "{url}");
}

#[tokio::test]
async fn serves_the_fingerprinted_url_immutable() {
    let response = client().get(&VANILLA_ASSETS.url(VANILLA_JS)).send().await;
    response
        .assert_ok()
        .assert_header("content-type", JS)
        .assert_header("cache-control", IMMUTABLE);
    assert_eq!(
        response.body.as_slice(),
        include_bytes!("../assets/vanilla.js")
    );
}

#[tokio::test]
async fn serves_the_plain_url_with_revalidation_and_etag() {
    let client = client();
    let response = client.get(PLAIN).send().await;
    response
        .assert_ok()
        .assert_header("content-type", JS)
        .assert_header("cache-control", REVALIDATE);
    let etag = response.header("etag").expect("etag").to_owned();
    client
        .get(PLAIN)
        .header("if-none-match", &etag)
        .send()
        .await
        .assert_status(304);
}

#[tokio::test]
async fn unknown_and_stale_paths_are_not_found() {
    let client = client();
    for path in [
        "/static/_plugins/vanilla/vanilla.00000000.js",
        "/static/_plugins/vanilla/nope.js",
        "/static/_plugins/vanilla/",
    ] {
        client.get(path).send().await.assert_status(404);
    }
}

#[tokio::test]
async fn asset_url_resolves_the_installed_bundle() {
    let _client = client();
    assert_eq!(
        asset_url("_plugins/vanilla/vanilla.js"),
        VANILLA_ASSETS.url(VANILLA_JS)
    );
}

#[test]
fn routes_are_public_and_plugin_attributed() {
    let app = autumn_web::app().plugin(VanillaPlugin::new());
    let infos = app.plugin_route_infos().expect("route infos");
    let routes: Vec<_> = infos
        .iter()
        .filter(|info| info.path.starts_with("/static/_plugins/vanilla/"))
        .collect();
    assert_eq!(routes.len(), 2, "one file, two URLs: {infos:?}");
    for info in routes {
        assert_eq!(info.method, "GET");
        assert_eq!(info.classification, RouteClassification::Public);
        assert_eq!(info.middleware, [PLUGIN_ASSETS_ROUTE_MARKER]);
        assert_eq!(info.source, RouteSource::Plugin(PLUGIN_NAME.to_owned()));
    }
}

#[test]
fn plugin_passes_conformance() {
    let app = autumn_web::app().plugin(VanillaPlugin::new());
    let infos = app.plugin_route_infos().expect("route infos");
    let report = run_conformance(&ConformanceConfig::new(PLUGIN_NAME), &infos);
    assert!(report.passed(), "{}", report.to_text_report());
}

#[tokio::test]
async fn installing_the_plugin_two_times_is_harmless() {
    let client = TestApp::new()
        .plugin(VanillaPlugin::new())
        .plugin(VanillaPlugin::new())
        .build();
    client
        .get(&VANILLA_ASSETS.url(VANILLA_JS))
        .send()
        .await
        .assert_ok();
}

#[test]
fn script_tag_is_deferred_with_sri() {
    let asset = VANILLA_ASSETS.get(VANILLA_JS).expect("bundled");
    let html = vanilla_script().into_string();
    assert_eq!(
        html,
        format!(
            r#"<script src="{}" integrity="{}" crossorigin="anonymous" defer></script>"#,
            asset.url(),
            asset.integrity()
        )
    );
}

#[tokio::test]
async fn a_page_with_the_script_loads_it_from_the_plugin() {
    #[autumn_web::get("/")]
    async fn index() -> autumn_web::Markup {
        autumn_web::html! { html { head { (vanilla_script()) } body { "hi" } } }
    }
    let client = TestApp::new()
        .plugin(VanillaPlugin::new())
        .routes(autumn_web::routes![index])
        .build();
    let page = client.get("/").send().await;
    page.assert_ok();
    let csp = page
        .header("content-security-policy")
        .expect("default CSP is set")
        .to_owned();
    let script_src = csp
        .split(';')
        .map(str::trim)
        .find(|directive| directive.starts_with("script-src"))
        .unwrap_or_else(|| panic!("script-src in {csp}"));
    assert_eq!(script_src, "script-src 'self'", "no inline or eval: {csp}");
    let src = VANILLA_ASSETS.url(VANILLA_JS);
    assert!(page.text().contains(&src), "{}", page.text());
    client.get(&src).send().await.assert_ok();
}
