// Metro must be told about the monorepo: @trueglaz/core lives outside this app
// and is consumed as TypeScript source, not a built artifact.
const { getDefaultConfig } = require('expo/metro-config')
const path = require('node:path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)
config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
// One React for the whole bundle. The website uses React 18.3 (hoisted to the
// root node_modules); React Native 0.74 needs 18.2 (in this app's node_modules).
// Left alone, packages/core would resolve the root copy and the bundle would
// hold two Reacts: context stops matching across the boundary and hooks throw.
// So these packages always resolve as if imported from this app, wherever the
// import is. Everything else uses normal lookup, which React Native needs for
// the dependencies it nests in its own node_modules (disableHierarchicalLookup
// would hide those, e.g. @react-native/virtualized-lists).
const singletons = ['react', 'react-dom', 'react-native']
const appOrigin = path.join(projectRoot, 'package.json')
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const pinned = singletons.some((name) => moduleName === name || moduleName.startsWith(name + '/'))
  return context.resolveRequest(pinned ? { ...context, originModulePath: appOrigin } : context, moduleName, platform)
}

module.exports = config
