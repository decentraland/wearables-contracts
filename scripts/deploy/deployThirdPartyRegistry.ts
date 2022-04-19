import { ethers, upgrades } from 'hardhat'

enum NETWORKS {
  'MUMBAI' = 'MUMBAI',
  'MATIC' = 'MATIC',
  'GOERLI' = 'GOERLI',
  'LOCALHOST' = 'LOCALHOST',
  'BSC_TESTNET' = 'BSC_TESTNET',
}

enum MANA {
  'MUMBAI' = '0x882Da5967c435eA5cC6b09150d55E8304B838f45',
  'MATIC' = '0xA1c57f48F0Deb89f569dFbE6E2B7f46D33606fD4',
  'GOERLI' = '0xe7fDae84ACaba2A5Ba817B6E6D8A2d415DBFEdbe',
  'LOCALHOST' = '0xe7fDae84ACaba2A5Ba817B6E6D8A2d415DBFEdbe',
  'BSC_TESTNET' = '0x00cca1b48a7b41c57821492efd0e872984db5baa',
}

enum THIRD_PARTY_AGGREGATOR {
  'MUMBAI' = '0x24e5F44999c151f08609F8e27b2238c773C4D020',
  'MATIC' = '',
  'GOERLI' = '',
  'LOCALHOST' = '',
  'BSC_TESTNET' = '',
}

enum COMMITTEE {
  'MUMBAI' = '0xe18B1361d41afC44658216F3Dc27e48c2336e3c2',
  'MATIC' = '',
  'GOERLI' = '',
  'LOCALHOST' = '',
  'BSC_TESTNET' = '',
}

enum COLLECTOR {
  'MUMBAI' = '0xc002A074c59DD45dDb52334f2ef8fb743A579c89',
  'MATIC' = '',
  'GOERLI' = '',
  'LOCALHOST' = '',
  'BSC_TESTNET' = '',
}

enum ORACLE {
  'MUMBAI' = '0x508d4AC10F057beACb7Cef6f112e79075045C3C9',
  'MATIC' = '',
  'GOERLI' = '',
  'LOCALHOST' = '',
  'BSC_TESTNET' = '',
}

enum ITEM_SLOT_PRICE {
  'MUMBAI' = '1000000000000000000',
  'MATIC' = '',
  'GOERLI' = '',
  'LOCALHOST' = '',
  'BSC_TESTNET' = '',
}

/**
 * @dev Steps:
 * Deploy the Third Party Registry smart contract
 */
async function main() {
  const owner = process.env['OWNER']

  const account = ethers.provider.getSigner()
  const accountAddress = await account.getAddress()

  const network = NETWORKS[(process.env['NETWORK'] || 'LOCALHOST') as NETWORKS]
  if (!network) {
    throw 'Invalid network'
  }

  // Deploy the TPR contract
  const ThirdPartyRegistry = await ethers.getContractFactory(
    'ThirdPartyRegistry'
  )

  const tpr = await upgrades.deployProxy(ThirdPartyRegistry, [
    owner,
    THIRD_PARTY_AGGREGATOR[network],
    COLLECTOR[network],
    COMMITTEE[network],
    MANA[network],
    ORACLE[network],
    ITEM_SLOT_PRICE[network],
  ])

  await tpr.deployed()

  console.log(`Contract deployed by: ${accountAddress}`)
  console.log('TPR:', tpr.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
