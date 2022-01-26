import { ethers } from 'hardhat'

enum NETWORKS {
  'MUMBAI' = 'MUMBAI',
  'MATIC' = 'MATIC',
  'GOERLI' = 'GOERLI',
  'LOCALHOST' = 'LOCALHOST',
  'BSC_TESTNET' = 'BSC_TESTNET',
}

enum DATA_FEED {
  'MUMBAI' = '0x0000000000000000000000000000000000000000', // TODO: Update when dummy aggregator is deployed 
  'MATIC' = '0xA1CbF3Fe43BC3501e3Fc4b573e822c70e76A7512', // https://docs.chain.link/docs/matic-addresses/
  'GOERLI' = '',
  'LOCALHOST' = '',
  'BSC_TESTNET' = '',
}

/**
 * @dev Steps:
 * Deploy the Third Party Registry smart contract
 */
async function main() {
  const account = ethers.provider.getSigner()
  const accountAddress = await account.getAddress()

  const network = NETWORKS[(process.env['NETWORK'] || 'LOCALHOST') as NETWORKS]
  if (!network) {
    throw 'Invalid network'
  }

  // Deploy the ChainlinkOracle contract
  const ChainlinkOracle = await ethers.getContractFactory('ChainlinkOracle')

  const dataFeed = DATA_FEED[network]
  const decimals = 18

  const oracle = await ChainlinkOracle.deploy(dataFeed, decimals)

  console.log(`Contract deployed by: ${accountAddress}`)
  console.log('ChainlinkOracle:', oracle.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
