// @trueglaz/core is a workspace package (packages/core), resolved by Metro
// through metro.config.js like any other dependency: no alias needed.
module.exports = function (api) {
  api.cache(true)
  return { presets: ['babel-preset-expo'] }
}
