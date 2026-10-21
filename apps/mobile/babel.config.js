// `@trueglaz/core` is vendored into src/core (this repo is standalone, not a
// monorepo), so the module-resolver alias lets the vendored files keep their
// `from '@trueglaz/core'` imports unchanged.
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          alias: { '@trueglaz/core': './src/core' },
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },
      ],
    ],
  }
}
