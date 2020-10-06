export async function sendMetaTx(contract, functionSignature, signer, relayer) {
  const chainId = await contract.getChainId()

  const domainType = [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'verifyingContract', type: 'address' },
    { name: 'salt', type: 'bytes32' },
  ]

  const domainData = {
    name: 'Decentraland Collection',
    version: '2',
    verifyingContract: contract.address,
    salt: web3.utils.padLeft(web3.utils.toHex(chainId), 64),
  }

  const metaTransactionType = [
    { name: 'nonce', type: 'uint256' },
    { name: 'from', type: 'address' },
    { name: 'functionSignature', type: 'bytes' },
  ]

  let nonce = await contract.getNonce(signer)

  let message = {
    nonce: nonce,
    from: signer,
    functionSignature: functionSignature,
  }

  const dataToSign = {
    types: {
      EIP712Domain: domainType,
      MetaTransaction: metaTransactionType,
    },
    domain: domainData,
    primaryType: 'MetaTransaction',
    message: message,
  }

  let signature = await new Promise((res, rej) =>
    web3.currentProvider.send(
      {
        method: 'eth_signTypedData',
        params: [signer, dataToSign],
        jsonrpc: '2.0',
        id: 999999999999,
      },
      function (err, result) {
        if (err || result.error) {
          return rej(err || result.error)
        }
        return res(result.result)
      }
    )
  )

  signature = signature.substring(2)
  const r = '0x' + signature.substring(0, 64)
  const s = '0x' + signature.substring(64, 128)
  const v = '0x' + signature.substring(128, 130)

  return contract.executeMetaTransaction(signer, functionSignature, r, s, v, {
    from: relayer,
  })
}
