const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Fix: Zustand (and some other packages) have an "import" export condition that
// maps to ESM .mjs files containing `import.meta.env` syntax. Metro bundles as
// CommonJS/IIFE, so `import.meta` causes a SyntaxError in browsers.
// Removing "import" from conditionNames forces Metro to resolve these packages
// to their "default" (CJS .js) build which is safe for all platforms.
config.resolver.unstable_conditionNames = ['require', 'default', 'react-native', 'browser'];

module.exports = withNativeWind(config, { input: './global.css' });
