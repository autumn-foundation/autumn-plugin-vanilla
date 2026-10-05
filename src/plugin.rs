//! [`VanillaPlugin`]: installs the runtime in an Autumn app.

use std::borrow::Cow;

use autumn_web::app::AppBuilder;
use autumn_web::plugin::Plugin;

use crate::assets::VANILLA_ASSETS;

/// The plugin name in Autumn diagnostics and route listings.
pub const PLUGIN_NAME: &str = "autumn-plugin-vanilla";

/// Installs the [`VANILLA_ASSETS`] bundle. It reads no configuration.
///
/// ```rust,no_run
/// use autumn_plugin_vanilla::VanillaPlugin;
///
/// # async fn run() {
/// autumn_web::app().plugin(VanillaPlugin::new()).run().await;
/// # }
/// ```
///
/// Then put [`vanilla_script`](crate::vanilla_script) in the page `<head>`.
#[derive(Debug, Default, Clone, Copy)]
#[must_use]
pub struct VanillaPlugin;

impl VanillaPlugin {
    /// Makes the plugin.
    pub const fn new() -> Self {
        Self
    }
}

impl Plugin for VanillaPlugin {
    fn name(&self) -> Cow<'static, str> {
        Cow::Borrowed(PLUGIN_NAME)
    }

    fn build(self, app: AppBuilder) -> AppBuilder {
        app.plugin_assets(&VANILLA_ASSETS)
    }
}
