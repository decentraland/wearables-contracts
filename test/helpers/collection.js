const ERC721Collection = artifacts.require('ERC721Collection')

export const name = 'DummyCollection'
export const symbol = 'SymbolCollection'
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
export const BASE_URI =
  'https://api-wearables.decentraland.org/v1/standards/erc721-metadata/collections/'

export const WEARABLES = [
  { name: 'bird_mask', max: 100 },
  { name: 'classic_mask', max: 100 },
  { name: 'clown_nose', max: 100 },
  { name: 'asian_fox', max: 100 },
  { name: 'killer_mask', max: 100 },
  { name: 'serial_killer_mask', max: 100 },
  { name: 'theater_mask', max: 100 },
  { name: 'tropical_mask', max: 100 }
]

export async function createDummyCollection(options) {
  const contract = await ERC721Collection.new(
    options.name || name,
    options.symbol || symbol,
    options.allowed,
    options.baseURI || BASE_URI,
    options.creationParams
  )

  await setupWearables(contract, WEARABLES)

  return contract
}

export async function setupWearables(contract, wearables = WEARABLES) {
  return contract.addWearables(
    wearables.map(w => web3.utils.fromAscii(w.name)),
    wearables.map(w => w.max)
  )
}
