import { keccak256 } from '@ethersproject/solidity'

export const BENEFICIARY_ADDRESS = web3.utils.randomHex(20)
export const OTHER_BENEFICIARY_ADDRESS = web3.utils.randomHex(20)

export const COLLECTION_HASH = keccak256(
  ['string'],
  ['Decentraland Collection']
)
export const EMPTY_HASH =
  '0x0000000000000000000000000000000000000000000000000000000000000000'
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
export const BASE_URI =
  'https://api-wearables.decentraland.org/v1/standards/erc721-metadata/collections/'
export const MAX_UINT256 = web3.utils.toBN(
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
)
export const DEFAULT_RARITY_PRICE = web3.utils.toWei('100')

export const GRACE_PERIOD = 60 * 60 * 24 * 7 // 7 days

export const CONTRACT_NAME = 'DummyCollection'
export const CONTRACT_SYMBOL = 'SymbolCollection'
export const RARITIES = {
  common: { name: 'common', index: 0, value: 100000 },
  uncommon: { name: 'uncommon', index: 1, value: 10000 },
  rare: { name: 'rare', index: 2, value: 5000 },
  epic: { name: 'epic', index: 3, value: 1000 },
  legendary: { name: 'legendary', index: 4, value: 100 },
  mythic: { name: 'mythic', index: 5, value: 10 },
  unique: { name: 'unique', index: 6, value: 1 },
}

export const ITEMS = [
  [
    RARITIES.common.name,
    web3.utils.toWei('10'),
    BENEFICIARY_ADDRESS,
    '1:bird_mask:hat:female,male',
  ],
  [
    RARITIES.common.name,
    web3.utils.toWei('10'),
    BENEFICIARY_ADDRESS,
    '1:classic_mask:hat:female,male',
  ],
  [
    RARITIES.common.name,
    web3.utils.toWei('10'),
    BENEFICIARY_ADDRESS,
    '1:clown_nose:hat:female,male',
  ],
  [
    RARITIES.common.name,
    web3.utils.toWei('10'),
    BENEFICIARY_ADDRESS,
    '1:asian_fox:hat:female,male',
  ],
  [
    RARITIES.common.name,
    web3.utils.toWei('10'),
    BENEFICIARY_ADDRESS,
    '1:killer_mask:hat:female,male',
  ],
  [
    RARITIES.common.name,
    web3.utils.toWei('10'),
    BENEFICIARY_ADDRESS,
    '1:serial_killer_mask:hat:female,male',
  ],
  [
    RARITIES.legendary.name,
    web3.utils.toWei('10'),
    BENEFICIARY_ADDRESS,
    '1:theater_mask:hat:female,male',
  ],
  [
    RARITIES.legendary.name,
    web3.utils.toWei('10'),
    BENEFICIARY_ADDRESS,
    '1:tropical_mask:hat:female,male',
  ],
]

export function getInitialRarities() {
  return Object.keys(RARITIES).map((key) => [
    key,
    RARITIES[key].value,
    DEFAULT_RARITY_PRICE,
  ])
}

export function getRarityNames() {
  return Object.keys(RARITIES)
}

export function getRarityDefaulPrices() {
  return Object.keys(RARITIES).map((_) => DEFAULT_RARITY_PRICE)
}

export async function createDummyFactory(owner) {
  const ERC721CollectionFactoryV2 = artifacts.require(
    'ERC721CollectionFactoryV2'
  )
  const ERC721CollectionV2 = artifacts.require('ERC721CollectionV2')

  const collectionImplementation = await ERC721CollectionV2.new()

  return ERC721CollectionFactoryV2.new(owner, collectionImplementation.address)
}

export async function createDummyCollection(factory, options) {
  const { logs } = await factory.createCollection(
    web3.utils.randomHex(32),
    getInitData(options)
  )

  const ERC721Collection = artifacts.require('ERC721CollectionV2')
  const contract = logs[0].args._address
  const collection = await ERC721Collection.at(contract)

  return collection
}

export async function setupItems(contract, items = ITEMS) {
  return contract.addItems(items)
}

export function getInitData(options) {
  return web3.eth.abi.encodeFunctionCall(
    {
      inputs: [
        {
          internalType: 'string',
          name: '_name',
          type: 'string',
        },
        {
          internalType: 'string',
          name: '_symbol',
          type: 'string',
        },
        {
          internalType: 'string',
          name: '_baseURI',
          type: 'string',
        },
        {
          internalType: 'address',
          name: '_creator',
          type: 'address',
        },
        {
          internalType: 'bool',
          name: '_shouldComplete',
          type: 'bool',
        },
        {
          internalType: 'bool',
          name: '_isApproved',
          type: 'bool',
        },
        {
          internalType: 'address',
          name: '_rarities',
          type: 'address',
        },
        {
          components: [
            {
              internalType: 'enum ERC721BaseCollectionV2.RARITY',
              name: 'rarity',
              type: 'string',
            },
            {
              internalType: 'uint256',
              name: 'price',
              type: 'uint256',
            },
            {
              internalType: 'address',
              name: 'beneficiary',
              type: 'address',
            },
            {
              internalType: 'string',
              name: 'metadata',
              type: 'string',
            },
          ],
          internalType: 'struct ERC721BaseCollectionV2.ItemParam[]',
          name: '_items',
          type: 'tuple[]',
        },
      ],
      name: 'initialize',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    [
      options.name || CONTRACT_NAME,
      options.symbol || CONTRACT_SYMBOL,
      options.baseURI || BASE_URI,
      options.creator,
      options.shouldComplete,
      options.shouldApprove,
      options.rarities,
      options.items || ITEMS,
    ]
  )
}

export function encodeTokenId(a, b) {
  return web3.utils.toBN(
    `0x${web3.utils.padLeft(a, 10).replace('0x', '')}${web3.utils
      .padLeft(b, 54)
      .replace('0x', '')}`
  )
}

export function decodeTokenId(id) {
  const hexId = web3.utils.padLeft(web3.utils.toHex(id), 64).replace('0x', '')

  return [
    web3.utils.toBN(hexId.substr(0, 10)),
    web3.utils.toBN(hexId.substr(10, hexId.length)),
  ]
}
