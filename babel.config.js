module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Converts import.meta.env.MODE → process.env.NODE_ENV so Metro's CommonJS
      // bundle doesn't contain bare import.meta syntax, which browsers reject as
      // a SyntaxError when the script tag has no type="module" attribute.
      'babel-plugin-transform-import-meta',
      'react-native-reanimated/plugin', // ต้องอยู่ล่างสุดเสมอ
    ],
  };
};