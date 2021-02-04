import { ethers } from "hardhat"

const RARITIES = [
  { name: 'common', index: 0, value: 100000 },
  { name: 'uncommon', index: 1, value: 10000 },
  { name: 'rare', index: 2, value: 5000 },
  { name: 'epic', index: 3, value: 1000 },
  { name: 'legendary', index: 4, value: 100 },
  { name: 'mythic', index: 5, value: 10 },
  { name: 'unique', index: 6, value: 1 }
]
enum NETWORKS {
  'MUMBAI' = 'MUMBAI',
  'MATIC' = 'MATIC',
  'GOERLI' = 'GOERLI',
  'LOCALHOST' = 'LOCALHOST'
}

enum MANA {
  'MUMBAI' = '0x882Da5967c435eA5cC6b09150d55E8304B838f45',
  'MATIC' = '0xA1c57f48F0Deb89f569dFbE6E2B7f46D33606fD4',
  'GOERLI' = '0xe7fDae84ACaba2A5Ba817B6E6D8A2d415DBFEdbe',
  'LOCALHOST' = '0xe7fDae84ACaba2A5Ba817B6E6D8A2d415DBFEdbe',
}

const DEFAULT_RARITY_PRICE = '10000000000000000000' // 10 MANA

/**
 * @dev Steps:
 * Deploy the Collection implementation
 * Deploy the committee with the desired members. The owner will be the DAO bridge
 * Deploy the collection Manager. The owner will be the DAO bridge
 * Deploy the forwarder. Caller Is the collection manager.
 * Deploy the collection Factory. Owner is the forwarder.
 */
async function main() {
  const owner = process.env['OWNER']
  const collectionDeploymentsFeesCollector = process.env['OWNER']

  const account = ethers.provider.getSigner()
  console.log(await account.getAddress())

  const network = NETWORKS[(process.env['NETWORK'] || 'LOCALHOST') as NETWORKS]
  if (!network) {
    throw ('Invalid error')
  }
  // Deploy the collection implementation
  const Collection = await ethers.getContractFactory("ERC721CollectionV2")
  const collectonImp = await Collection.deploy()

  // Deploy the rarities
  const Rarities = await ethers.getContractFactory("Rarities")
  const rarities = await Rarities.deploy(owner, (RARITIES).map((rarity) => [
    rarity.name,
    rarity.value,
    DEFAULT_RARITY_PRICE,
  ]))

  // Deploy the committee
  const Committee = await ethers.getContractFactory("Committee")
  const committee = await Committee.deploy(owner, process.env['COMMITTEE_MEMBERS']?.split(','))

  // Deploy the collection manager
  const CollectionManager = await ethers.getContractFactory("CollectionManager")
  const collectionManager = await CollectionManager.deploy(owner, MANA[network], committee.address, collectionDeploymentsFeesCollector, rarities.address)

  // Deploy the forwarder
  const Forwarder = await ethers.getContractFactory("Forwarder")
  const forwarder = await Forwarder.deploy(owner, collectionManager.address)

  // Deploy the forwarder
  const ERC721CollectionFactoryV2 = await ethers.getContractFactory("ERC721CollectionFactoryV2")
  const collectionFactoryV2 = await ERC721CollectionFactoryV2.deploy(forwarder.address, collectonImp.address)

  console.log('Collection imp:', collectonImp.address)
  console.log('Rarities:', rarities.address)
  console.log('Committee:', committee.address)
  console.log('Collection Manager :', collectionManager.address)
  console.log('Forwarder:', forwarder.address)
  console.log('Collection Factory:', collectionFactoryV2.address)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })