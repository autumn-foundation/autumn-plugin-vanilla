//! The plugin asset bundle: `assets/vanilla.js`, embedded at compile time.
//!
//! [`VanillaPlugin`](crate::VanillaPlugin) installs [`VANILLA_ASSETS`] through
//! Autumn's `AppBuilder::plugin_assets` seam. The framework serves the file
//! under `/static/_plugins/vanilla/`:
//!
//! - at a hashed URL (`vanilla.<sha256-prefix>.js`), `immutable` for a year;
//! - at its plain URL (`vanilla.js`), `must-revalidate`;
//! - with `ETag`/`304`, `Range`, and a computed `sha384` SRI hash.

use autumn_web::assets::PluginAssets;

/// URL namespace of the bundle. Files are under `/static/_plugins/vanilla/`.
pub const ASSETS_NAMESPACE: &str = "vanilla";

/// Logical path of the runtime inside [`VANILLA_ASSETS`].
pub const VANILLA_JS: &str = "vanilla.js";

/// The plugin asset bundle. It holds one file, [`VANILLA_JS`].
///
/// [`VanillaPlugin`](crate::VanillaPlugin) installs it. Use it directly only
/// to make URLs or tags yourself:
///
/// ```rust
/// use autumn_plugin_vanilla::{VANILLA_ASSETS, VANILLA_JS};
///
/// let url = VANILLA_ASSETS.url(VANILLA_JS);
/// assert!(url.starts_with("/static/_plugins/vanilla/vanilla."), "{url}");
/// let sri = VANILLA_ASSETS.integrity(VANILLA_JS);
/// assert!(sri.is_some_and(|s| s.starts_with("sha384-")));
/// ```
pub static VANILLA_ASSETS: PluginAssets = PluginAssets::from_files(
    ASSETS_NAMESPACE,
    &[(VANILLA_JS, include_bytes!("../assets/vanilla.js"))],
);
