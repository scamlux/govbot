const { withAppBuildGradle } = require("expo/config-plugins");

/**
 * Injects a release signingConfig that reads ~/.govbot/keystore.properties
 * (storeFile, storePassword, keyAlias, keyPassword). Secrets never enter the repo.
 * When the file is absent, the release build is left unsigned.
 */
const PROPS_BLOCK = `
// --- withReleaseSigning: local release keystore (not committed) ---
def govbotKeystoreProps = new Properties()
def govbotKeystoreFile = new File(System.getProperty("user.home"), ".govbot/keystore.properties")
if (govbotKeystoreFile.exists()) {
    govbotKeystoreFile.withInputStream { govbotKeystoreProps.load(it) }
}
def govbotHasReleaseKey = govbotKeystoreProps.containsKey("storeFile")
// --- end withReleaseSigning ---
`;

const RELEASE_CONFIG = `
        release {
            if (govbotHasReleaseKey) {
                storeFile file(govbotKeystoreProps["storeFile"])
                storePassword govbotKeystoreProps["storePassword"]
                keyAlias govbotKeystoreProps["keyAlias"]
                keyPassword govbotKeystoreProps["keyPassword"]
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes("withReleaseSigning")) return cfg;

    src = src.replace(/\nandroid\s*\{/, `${PROPS_BLOCK}\nandroid {`);
    src = src.replace(/signingConfigs\s*\{/, (m) => `${m}${RELEASE_CONFIG}`);

    // Point the release build type at the release key (or leave unsigned when absent).
    src = src.replace(/(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/, (_m, head) => `${head}signingConfig govbotHasReleaseKey ? signingConfigs.release : null`);

    cfg.modResults.contents = src;
    return cfg;
  });
};
