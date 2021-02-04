require('dotenv').config()

export function getDeployParams() {
  return {
    url: process.env[`RPC_URL_${process.env['NETWORK']}`] || 'https://rinkeby.infura.io/v3/',
    accounts: {
      mnemonic: process.env['MNEMONIC'] ? process.env['MNEMONIC'].replace(/,/g, ' ') : 'test test test test test test test test test test test junk',
      initialIndex: 0,
      count: 10,
      path: `m/44'/60'/0'/0`
    },
    gas: "auto",
    gasPrice: "auto",
    gasMultiplier: 1,
    timeout: 20000,
    httpHeaders: {}
  }
}