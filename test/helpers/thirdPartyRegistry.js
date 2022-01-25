export async function getSignature(
  contract,
  thirdPartyId,
  qty,
  signer,
  domain,
  version
) {
  const chainId = await contract.getChainId()

  const domainType = [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'verifyingContract', type: 'address' },
    { name: 'salt', type: 'bytes32' },
  ]

  const domainData = {
    name: domain,
    verifyingContract: contract.address,
    salt: web3.utils.padLeft(web3.utils.toHex(chainId), 64),
    version,
  }

  const consumeSlotsType = [
    { name: 'thirdPartyId', type: 'string' },
    { name: 'qty', type: 'uint256' },
  ]

  let message = {
    thirdPartyId,
    qty,
  }

  const dataToSign = {
    types: {
      EIP712Domain: domainType,
      ConsumeSlots: consumeSlotsType,
    },
    domain: domainData,
    primaryType: 'ConsumeSlots',
    message: message,
  }

  let signature = await new Promise((res, rej) =>
    web3.currentProvider.send(
      {
        method: 'eth_signTypedData_v4',
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

  return {
    r,
    s,
    v,
  }
}
