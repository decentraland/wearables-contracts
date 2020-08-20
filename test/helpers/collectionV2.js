export const BENEFICIARY_ADDRESS = web3.utils.randomHex(20)
export const EMPTY_HASH =
  '0x0000000000000000000000000000000000000000000000000000000000000000'
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
export const BASE_URI =
  'https://api-wearables.decentraland.org/v1/standards/erc721-metadata/collections/'

export const CONTRACT_NAME = 'DummyCollection'
export const CONTRACT_SYMBOL = 'SymbolCollection'
export const ITEMS = [
  [
    10,
    0,
    web3.utils.toWei('10'),
    BENEFICIARY_ADDRESS,
    '1:bird_mask:hat:female,male',
    EMPTY_HASH,
  ],
  [
    10,
    0,
    web3.utils.toWei('10'),
    BENEFICIARY_ADDRESS,
    '1:classic_mask:hat:female,male',
    EMPTY_HASH,
  ],
  [
    10,
    0,
    web3.utils.toWei('10'),
    BENEFICIARY_ADDRESS,
    '1:clown_nose:hat:female,male',
    EMPTY_HASH,
  ],
  [
    10,
    0,
    web3.utils.toWei('10'),
    BENEFICIARY_ADDRESS,
    '1:asian_fox:hat:female,male',
    EMPTY_HASH,
  ],
  [
    10,
    0,
    web3.utils.toWei('10'),
    BENEFICIARY_ADDRESS,
    '1:killer_mask:hat:female,male',
    EMPTY_HASH,
  ],
  [
    10,
    0,
    web3.utils.toWei('10'),
    BENEFICIARY_ADDRESS,
    '1:serial_killer_mask:hat:female,male',
    EMPTY_HASH,
  ],
  [
    10,
    0,
    web3.utils.toWei('10'),
    BENEFICIARY_ADDRESS,
    '1:theater_mask:hat:female,male',
    EMPTY_HASH,
  ],
  [
    10,
    0,
    web3.utils.toWei('10'),
    BENEFICIARY_ADDRESS,
    '1:tropical_mask:hat:female,male',
    EMPTY_HASH,
  ],
]

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

export async function setupItems(contract, wearables = WEARABLES) {
  return contract.addWearables(
    wearables.map((w) => web3.utils.fromAscii(w.name)),
    wearables.map((w) => w.max)
  )
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
          internalType: 'string',
          name: '_baseURI',
          type: 'string',
        },
        {
          components: [
            {
              internalType: 'uint256',
              name: 'maxSupply',
              type: 'uint256',
            },
            {
              internalType: 'uint256',
              name: 'totalSupply',
              type: 'uint256',
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
            {
              internalType: 'bytes32',
              name: 'contentHash',
              type: 'bytes32',
            },
          ],
          internalType: 'struct ERC721BaseCollectionV2.Item[]',
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
      options.creator,
      options.shouldComplete,
      options.baseURI || BASE_URI,
      options.items || ITEMS,
    ]
  )
}
