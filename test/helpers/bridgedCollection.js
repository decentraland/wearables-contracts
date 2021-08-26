export function getTokenId(collectionAddress, tokenId) {
  return web3.utils.toBN(
    web3.utils.soliditySha3({
      t: 'bytes',
      v: web3.eth.abi.encodeParameters(
        ['address', 'uint256'],
        [collectionAddress, tokenId]
      ),
    })
  )
}
