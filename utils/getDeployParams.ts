require('dotenv').config()

export function getDeployParams() {
  return {
    url: process.env[`RPC_URL_${process.env['NETWORK']}`] || '',
    accounts: {
      mnemonic: process.env['MNEMONIC']?.replace(/,/g, ' '),
      initialIndex: 0,
      count: 1,
      path: `m/44'/60'/0'/0`
    },
    gas: "auto",
    gasPrice: "auto",
    gasMultiplier: 1,
    timeout: 20000,
    httpHeaders: {}
  }
}