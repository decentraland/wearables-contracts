require('babel-register')
require('babel-polyfill')

require('@nomiclabs/hardhat-truffle5')
require('hardhat-gas-reporter')
require('decentraland-contract-plugins/dist/src/mana/tasks/load-mana')

module.exports = {
  defaultNetwork: 'hardhat',
  solidity: {
    compilers: [
      {
        version: '0.8.0',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1,
          },
        },
      },
      {
        version: '0.6.12',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1,
          },
        },
      },
      {
        version: '0.6.2',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1,
          },
        },
      },
      {
        version: '0.6.0',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1,
          },
        },
      },
    ],
    // ],
    // solc: {
    //   version: '0.8.0',
    //   optimizer: {
    //     enabled: true,
    //     runs: 1,
    //   },
    // },
  },
  networks: {
    hardhat: {
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
