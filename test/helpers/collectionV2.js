export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
export const BASE_URI =
  'https://api-wearables.decentraland.org/v1/standards/erc721-metadata/collections/'

export const CONTRACT_NAME = 'DummyCollection'
export const CONTRACT_SYMBOL = 'SymbolCollection'
export const WEARABLES = [
  { name: 'bird_mask', max: 100 },
  { name: 'classic_mask', max: 100 },
  { name: 'clown_nose', max: 100 },
  { name: 'asian_fox', max: 100 },
  { name: 'killer_mask', max: 100 },
  { name: 'serial_killer_mask', max: 100 },
  { name: 'theater_mask', max: 100 },
  { name: 'tropical_mask', max: 100 },
]

export async function createDummyCollection(options) {
  const ERC721Collection = artifacts.require('ERC721Collection')

  const contract = await ERC721Collection.new(
    options.name || CONTRACT_NAME,
    options.symbol || CONTRACT_SYMBOL,
    options.allowed,
    options.baseURI || BASE_URI,
    options.creationParams
  )

  await setupWearables(contract, options.wearables || WEARABLES)

  return contract
}

export async function setupWearables(contract, wearables = WEARABLES) {
  return contract.addWearables(
    wearables.map((w) => web3.utils.fromAscii(w.name)),
    wearables.map((w) => w.max)
  )
}
