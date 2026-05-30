module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      // Temporarily disabled for debugging - remove this line in production
      // ['transform-remove-console', { exclude: ['error', 'warn'] }],
    ],
  };
};
