require('babel-register')
require('babel-polyfill')

usePlugin('@nomiclabs/buidler-truffle5')

const { loadPluginFile } = require('@nomiclabs/buidler/plugins-testing')

loadPluginFile(
  require.resolve('decentraland-contract-plugins/dist/mana/tasks/load-mana')
)

module.exports = {
  defaultNetwork: 'buidlerevm',
  solc: {
    version: '0.6.12',
  },
}
