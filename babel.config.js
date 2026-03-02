module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin' // ตัวนี้ต้องอยู่ล่างสุดเสมอ ถูกต้องแล้วครับ
    ],
  };
};