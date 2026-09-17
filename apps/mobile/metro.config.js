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
// Without this Metro walks up from packages/core and finds the ROOT react (the
// web app's copy), giving the bundle two Reacts: context stops matching across
// the boundary and elements fail to render. Resolution must stay inside the
// paths above, so core and the app share one React.
config.resolver.disableHierarchicalLookup = true

module.exports = config
