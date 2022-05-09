import { ethers } from "hardhat"
import * as MarketplaceConfig from 'marketplace-contracts/artifacts/contracts/marketplace/Marketplace.sol/Marketplace.json'
import * as ManaConfig from 'decentraland-mana/build/contracts/MANAToken.json'

import {
  MANA_BYTECODE, RESCUE_ITEMS_SELECTOR,
  SET_APPROVE_COLLECTION_SELECTOR,
  SET_EDITABLE_SELECTOR
} from './utils'

enum NETWORKS {
  'MUMBAI' = 'MUMBAI',
  'MATIC' = 'MATIC',
  'GOERLI' = 'GOERLI',
  'LOCALHOST' = 'LOCALHOST',
  'BSC_TESTNET' = 'BSC_TESTNET',
}

enum FORWARDER {
  'MUMBAI' = '0x71e56Ad57eca3fAAe5077b7F9ea731a25785fF92',
  'MATIC' = '0xBF6755A83C0dCDBB2933A96EA778E00b717d7004',
  'GOERLI' = '',
  'LOCALHOST' = '',
  'BSC_TESTNET' = '',
}

enum COLLECTION_IMPLEMENTATION {
  'MUMBAI' = '0x89c4Ad77066d9EE8aD281D5Fd995690D91436644',
  'MATIC' = '0x006080C6061C4aF79b39Da0842a3a22A7b3f185e',
  'GOERLI' = '',
  'LOCALHOST' = '',
  'BSC_TESTNET' = '',
}

enum OWNER {
  'MUMBAI' = '0xb919da06d5f81777B13Fc5CBd48635E19500Fbf5',
  'MATIC' = '0x0E659A116e161d8e502F9036bAbDA51334F2667E',
  'GOERLI' = '',
  'LOCALHOST' = '',
  'BSC_TESTNET' = '',
}

const DEFAULT_RARITY_PRICE = '100000000000000000000' // 100 MANA

const OWNER_CUT_PER_MILLION = 25000


/**
 * @dev Steps:
 * Deploy the Collection implementation
 * Deploy the committee with the desired members. The owner will be the DAO bridge
 * Deploy the collection Manager. The owner will be the DAO bridge
 * Deploy the forwarder. Caller Is the collection manager.
 * Deploy the collection Factory. Owner is the forwarder.
 */
async function main() {
  const network = NETWORKS[(process.env['NETWORK'] || 'LOCALHOST') as NETWORKS]
  if (!network) {
    throw ('Invalid network')
  }

  const owner = OWNER[network]

  const account = ethers.provider.getSigner()
  const accountAddress = await account.getAddress()

  // Deploy the forwarder
  const UpgradeableBeacon = await ethers.getContractFactory("UpgradeableBeacon")
  const upgradeableBeacon = await UpgradeableBeacon.deploy(COLLECTION_IMPLEMENTATION[network])
  await upgradeableBeacon.transferOwnership(owner)

  // Deploy the forwarder
  const ERC721CollectionFactoryV3 = await ethers.getContractFactory("ERC721CollectionFactoryV3")
  const collectionFactoryV3 = await ERC721CollectionFactoryV3.deploy(FORWARDER[network], upgradeableBeacon.address)


  console.log(`Contract deployed by: ${accountAddress}`)
  console.log('Upgradeable Beacon:', upgradeableBeacon.address)
  console.log('Collection Factory:', collectionFactoryV3.address)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })