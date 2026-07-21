module.exports = function (api) {
  const isProd = api.env('production');
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      ...(isProd ? [['transform-remove-console', { exclude: ['error', 'warn'] }]] : []),
    ],
  };
};
