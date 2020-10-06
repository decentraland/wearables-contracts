require('babel-register')
require('babel-polyfill')

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
      runs: 1,
    },
  },
  networks: {
    buidlerevm: {
      loggingEnabled: false,
      blockGasLimit: 10000000,
      gas: 10000000,
    },
    local: {
      url: 'http://127.0.0.1:8545',
      blockGasLimit: 10000000,
      gas: 10000000,
      network_id: '*', // eslint-disable-line camelcase
    },
  },
  gasReporter: {
    enabled: !!process.env.REPORT_GAS === true,
    currency: 'USD',
    gasPrice: 21,
    showTimeSpent: true,
  },
}
