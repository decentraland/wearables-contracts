require('babel-register')
require('babel-polyfill')

usePlugin('@nomiclabs/buidler-truffle5')

module.exports = {
  defaultNetwork: 'buidlerevm',
  solc: {
    version: '0.5.11'
  }
}
