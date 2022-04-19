import { ethers } from 'hardhat'

const RARITIES = [
  { name: 'common', index: 0, value: 100000 },
  { name: 'uncommon', index: 1, value: 10000 },
  { name: 'rare', index: 2, value: 5000 },
  { name: 'epic', index: 3, value: 1000 },
  { name: 'legendary', index: 4, value: 100 },
  { name: 'mythic', index: 5, value: 10 },
  { name: 'unique', index: 6, value: 1 },
]

enum NETWORKS {
  'MUMBAI' = 'MUMBAI',
  'MATIC' = 'MATIC',
  'GOERLI' = 'GOERLI',
  'LOCALHOST' = 'LOCALHOST',
  'BSC_TESTNET' = 'BSC_TESTNET',
}

enum ORACLE {
  'MUMBAI' = '0x508d4AC10F057beACb7Cef6f112e79075045C3C9',
  'MATIC' = '0xe18B1361d41afC44658216F3Dc27e48c2336e3c2',
  'GOERLI' = '',
  'LOCALHOST' = '',
  'BSC_TESTNET' = '',
}

const DEFAULT_RARITY_PRICE = '500000000000000000000' // 500 USD

/**
 * @dev Steps:
 * Deploy the RaritiesWithOracle smart contract
 */
async function main() {
  const owner = process.env['OWNER']

  const account = ethers.provider.getSigner()
  const accountAddress = await account.getAddress()

  const network = NETWORKS[(process.env['NETWORK'] || 'LOCALHOST') as NETWORKS]
  if (!network) {
    throw 'Invalid network'
  }

  // Deploy the rarities with oracle
  const RaritiesWithOracle = await ethers.getContractFactory('RaritiesWithOracle')
  const rarities = await RaritiesWithOracle.deploy(
    owner,
    RARITIES.map((rarity) => [rarity.name, rarity.value, DEFAULT_RARITY_PRICE]),
    ORACLE[network]
  )

  console.log(`Contract deployed by: ${accountAddress}`)
  console.log('RaritiesWithOracle:', rarities.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
