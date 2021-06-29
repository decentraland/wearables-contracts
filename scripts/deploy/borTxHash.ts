const ethUtils = require('ethereumjs-util')



/**
 * @dev Steps:
 * Deploy the Collection implementation
 * Deploy the committee with the desired members. The owner will be the DAO bridge
 * Deploy the collection Manager. The owner will be the DAO bridge
 * Deploy the forwarder. Caller Is the collection manager.
 * Deploy the collection Factory. Owner is the forwarder.
 */

function getBorHash(block: any): Buffer {
  return ethUtils.keccak256(Buffer.concat([
    ethUtils.toBuffer('matic-bor-receipt-'),
    ethUtils.setLengthLeft(ethUtils.toBuffer(block.number), 8),
    ethUtils.toBuffer(block.hash),
  ]))
}
async function main() {
  const hash: Buffer = getBorHash({ number: 15766784, hash: '0x5cc343441b9010cc72981b559701cda5fdaf34bac583ddb1bbe589471fff754b' })
  console.log(`tx bor hash: ${ethUtils.bufferToHex(hash)}`)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })