require('babel-register')
require('babel-polyfill')

usePlugin('@nomiclabs/buidler-ganache')
usePlugin('@nomiclabs/buidler-truffle5')
usePlugin('buidler-gas-reporter')

const { loadPluginFile } = require('@nomiclabs/buidler/plugins-testing')

loadPluginFile(
  require.resolve('decentraland-contract-plugins/dist/mana/tasks/load-mana')
)

module.exports = {
  defaultNetwork: 'buidlerevm',
  solc: {
    version: '0.6.12',
    optimizer: {
      enabled: true,
      runs: 200,
    },
  },
  networks: {
    buidlerevm: {
      loggingEnabled: false,
      blockGasLimit: 100000000,
    },
  },
  gasReporter: {
    enabled: true,
    currency: 'USD',
    gasPrice: 21,
    showTimeSpent: true,
  },
}
