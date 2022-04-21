import hr from 'hardhat'
import { Mana } from 'decentraland-contract-plugins'

import {
  ITEMS,
  getInitialRarities,
  getRarityNames,
  RARITIES,
  RESCUE_ITEMS_SELECTOR,
  SET_APPROVE_COLLECTION_SELECTOR,
  SET_EDITABLE_SELECTOR,
} from '../helpers/collectionV2'
import { sendMetaTx } from '../helpers/metaTx'

const BN = web3.utils.BN
const expect = require('chai').use(require('bn-chai')(BN)).expect

const UpgradeableBeacon = artifacts.require('UpgradeableBeacon')
const ERC721CollectionFactoryV3 = artifacts.require('ERC721CollectionFactoryV3')
const ERC721CollectionV2 = artifacts.require('ERC721CollectionV2')
const DummyERC721CollectionV2Upgrade = artifacts.require(
  'DummyERC721CollectionV2Upgrade'
)
const Committee = artifacts.require('Committee')
const CollectionManager = artifacts.require('CollectionManager')
const Forwarder = artifacts.require('Forwarder')
const Rarities = artifacts.require('Rarities')

describe('Collections V2 End 2 End with Factory V3: Approval Flow', function () {
  const name = 'collectionName'
  const symbol = 'collectionSymbol'
  const baseURI = 'collectionBaseURI'

  let upgradeableBeaconContract
  let manaContract
  let collectionImplementation
  let collectionUpgradeContract
  let factoryContract
  let committeeContract
  let collectionManagerContract
  let forwarderContract
  let collectionContract
  let raritiesContract

  // Accounts
  let accounts
  let deployer
  let user
  let anotherUser
  let owner
  let collector
  let hacker
  let relayer
  let fromUser
  let fromHacker
  let fromOwner
  let fromDeployer

  let creationParams

  before(async function () {
    accounts = await web3.eth.getAccounts()
    deployer = accounts[0]
    user = accounts[1]
    owner = accounts[3]
    hacker = accounts[4]
    anotherUser = accounts[5]
    collector = accounts[6]
    relayer = accounts[7]

    fromUser = { from: user }
    fromHacker = { from: hacker }

    fromOwner = { from: owner }
    fromDeployer = { from: deployer }

    creationParams = {
      ...fromOwner,
      gas: 9e6,
      gasPrice: 21e9,
    }

    const mana = new Mana({ accounts, artifacts: hr.artifacts })
    await mana.deploy({ txParams: creationParams })
    manaContract = mana.getContract()

    raritiesContract = await Rarities.new(deployer, getInitialRarities())
    committeeContract = await Committee.new(owner, [user], fromDeployer)

    collectionManagerContract = await CollectionManager.new(
      owner,
      manaContract.address,
      committeeContract.address,
      collector,
      raritiesContract.address,
      [
        RESCUE_ITEMS_SELECTOR,
        SET_APPROVE_COLLECTION_SELECTOR,
        SET_EDITABLE_SELECTOR,
      ],
      [true, true, true]
    )

    collectionImplementation = await ERC721CollectionV2.new()

    collectionUpgradeContract = await DummyERC721CollectionV2Upgrade.new()

    upgradeableBeaconContract = await UpgradeableBeacon.new(
      collectionImplementation.address
    )

    forwarderContract = await Forwarder.new(
      owner,
      collectionManagerContract.address,
      fromDeployer
    )

    factoryContract = await ERC721CollectionFactoryV3.new(
      forwarderContract.address,
      upgradeableBeaconContract.address
    )

    // Rarities at price 0
    const rarities = getInitialRarities()

    await raritiesContract.updatePrices(
      getRarityNames(),
      Array(rarities.length).fill(0)
    )
  })

  // Wrapped the tests inside a function so they can be run before and after upgrading
  // the collection contract without rewriting the whole set of tests.
  function tests() {
    describe('User Tx', function () {
      describe('Deploy collection', async function () {
        it('should create a collection', async function () {
          const salt = web3.utils.randomHex(32)
          const { logs } = await collectionManagerContract.createCollection(
            forwarderContract.address,
            factoryContract.address,
            salt,
            name,
            symbol,
            baseURI,
            user,
            ITEMS,
            fromUser
          )
          collectionContract = await ERC721CollectionV2.at(logs[0].address)

          const name_ = await collectionContract.name()
          expect(name_).to.be.equal(name)

          const symbol_ = await collectionContract.symbol()
          expect(symbol_).to.be.equal(symbol)

          const baseURI_ = await collectionContract.baseURI()
          expect(baseURI_).to.be.equal(baseURI)

          const creator_ = await collectionContract.creator()
          expect(creator_).to.be.equal(user)

          const owner_ = await collectionContract.owner()
          expect(owner_).to.be.equal(forwarderContract.address)

          const isApproved = await collectionContract.isApproved()
          expect(isApproved).to.be.equal(false)

          const isCompleted = await collectionContract.isCompleted()
          expect(isCompleted).to.be.equal(true)

          const rarities = await collectionContract.rarities()
          expect(rarities).to.be.equal(raritiesContract.address)

          const itemLength = await collectionContract.itemsCount()

          expect(ITEMS.length).to.be.eq.BN(itemLength)

          for (let i = 0; i < ITEMS.length; i++) {
            const {
              rarity,
              maxSupply,
              totalSupply,
              price,
              beneficiary,
              metadata,
              contentHash,
            } = await collectionContract.items(i)

            expect(rarity).to.be.eq.BN(ITEMS[i][0])
            expect(maxSupply).to.be.eq.BN(RARITIES[ITEMS[i][0]].value)
            expect(totalSupply).to.be.eq.BN(0)
            expect(price).to.be.eq.BN(ITEMS[i][1])
            expect(beneficiary.toLowerCase()).to.be.equal(
              ITEMS[i][2].toLowerCase()
            )
            expect(metadata).to.be.equal(ITEMS[i][3])
            expect(contentHash).to.be.equal('')
          }
        })
      })

      describe('Manage collection', async function () {
        it('should approve a collection by the committee', async function () {
          let isApproved = await collectionContract.isApproved()
          expect(isApproved).to.be.equal(false)

          // Approve collection
          await committeeContract.manageCollection(
            collectionManagerContract.address,
            forwarderContract.address,
            collectionContract.address,
            [
              web3.eth.abi.encodeFunctionCall(
                {
                  inputs: [
                    {
                      internalType: 'bool',
                      name: '_value',
                      type: 'bool',
                    },
                  ],
                  name: 'setApproved',
                  outputs: [],
                  stateMutability: 'nonpayable',
                  type: 'function',
                },
                [true]
              ),
            ],
            fromUser
          )

          isApproved = await collectionContract.isApproved()
          expect(isApproved).to.be.equal(true)
        })

        it('should set not editable a collection by the committee', async function () {
          let isEditable = await collectionContract.isEditable()
          expect(isEditable).to.be.equal(true)
          // Set Editable false to collection
          await committeeContract.manageCollection(
            collectionManagerContract.address,
            forwarderContract.address,
            collectionContract.address,
            [
              web3.eth.abi.encodeFunctionCall(
                {
                  inputs: [
                    {
                      internalType: 'bool',
                      name: '_value',
                      type: 'bool',
                    },
                  ],
                  name: 'setEditable',
                  outputs: [],
                  stateMutability: 'nonpayable',
                  type: 'function',
                },
                [false]
              ),
            ],
            fromUser
          )

          isEditable = await collectionContract.isEditable()
          expect(isEditable).to.be.equal(false)
        })

        it('should rescue items by the committee', async function () {
          const newContentHash0 =
            'bafybeiemxf5abjwjbikoz4mc3a3dla6ual3jsgpdr4cjr3oz3evfyavhwq'
          const newMetadata0 = '1:crocodile_mask:earrings:female'
          const newContentHash1 =
            'bafybeiemxf5abjwjbikoz4mc3a3dla6ual3jsgpdr4cjr3oz3evfyavhwc'
          const newMetadata1 = '1:whale_mask:earrings:female'

          let item0 = await collectionContract.items(0)
          expect([
            item0.rarity.toString(),
            item0.maxSupply.toString(),
            item0.totalSupply.toString(),
            item0.price.toString(),
            item0.beneficiary.toLowerCase(),
            item0.metadata,
            item0.contentHash,
          ]).to.be.eql([
            ITEMS[0][0].toString(),
            RARITIES[ITEMS[0][0]].value.toString(),
            '0',
            ITEMS[0][1].toString(),
            ITEMS[0][2].toLowerCase(),
            ITEMS[0][3],
            '',
          ])

          let item1 = await collectionContract.items(1)
          expect([
            item1.rarity.toString(),
            item1.maxSupply.toString(),
            item1.totalSupply.toString(),
            item1.price.toString(),
            item1.beneficiary.toLowerCase(),
            item1.metadata,
            item1.contentHash,
          ]).to.be.eql([
            ITEMS[1][0].toString(),
            RARITIES[ITEMS[1][0]].value.toString(),
            '0',
            ITEMS[1][1].toString(),
            ITEMS[1][2].toLowerCase(),
            ITEMS[1][3],
            '',
          ])

          // Rescue items
          await committeeContract.manageCollection(
            collectionManagerContract.address,
            forwarderContract.address,
            collectionContract.address,
            [
              web3.eth.abi.encodeFunctionCall(
                {
                  inputs: [
                    {
                      internalType: 'uint256[]',
                      name: '_itemIds',
                      type: 'uint256[]',
                    },
                    {
                      internalType: 'string[]',
                      name: '_contentHashes',
                      type: 'string[]',
                    },
                    {
                      internalType: 'string[]',
                      name: '_metadatas',
                      type: 'string[]',
                    },
                  ],
                  name: 'rescueItems',
                  outputs: [],
                  stateMutability: 'nonpayable',
                  type: 'function',
                },
                [
                  [0, 1],
                  [newContentHash0, newContentHash1],
                  [newMetadata0, newMetadata1],
                ]
              ),
            ],
            fromUser
          )

          item0 = await collectionContract.items(0)
          expect([
            item0.rarity.toString(),
            item0.maxSupply.toString(),
            item0.totalSupply.toString(),
            item0.price.toString(),
            item0.beneficiary.toLowerCase(),
            item0.metadata,
            item0.contentHash,
          ]).to.be.eql([
            ITEMS[0][0].toString(),
            RARITIES[ITEMS[0][0]].value.toString(),
            '0',
            ITEMS[0][1].toString(),
            ITEMS[0][2].toLowerCase(),
            newMetadata0,
            newContentHash0,
          ])

          item1 = await collectionContract.items(1)
          expect([
            item1.rarity.toString(),
            item0.maxSupply.toString(),
            item1.totalSupply.toString(),
            item1.price.toString(),
            item1.beneficiary.toLowerCase(),
            item1.metadata,
            item1.contentHash,
          ]).to.be.eql([
            ITEMS[1][0].toString(),
            RARITIES[ITEMS[1][0]].value.toString(),
            '0',
            ITEMS[1][1].toString(),
            ITEMS[1][2].toLowerCase(),
            newMetadata1,
            newContentHash1,
          ])
        })
      })
    })

    describe('Relayed EIP721', function () {
      describe('Deploy collection :: Relayed EIP721', async function () {
        it('should create a collection', async function () {
          const salt = web3.utils.randomHex(32)
          const functionSignature = web3.eth.abi.encodeFunctionCall(
            {
              inputs: [
                {
                  internalType: 'contract IForwarder',
                  name: '_forwarder',
                  type: 'address',
                },
                {
                  internalType: 'contract IERC721CollectionFactoryV2',
                  name: '_factory',
                  type: 'address',
                },
                {
                  internalType: 'bytes32',
                  name: '_salt',
                  type: 'bytes32',
                },
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
                  components: [
                    {
                      internalType: 'string',
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
                  internalType: 'struct IERC721CollectionV2.ItemParam[]',
                  name: '_items',
                  type: 'tuple[]',
                },
              ],
              name: 'createCollection',
              outputs: [],
              stateMutability: 'nonpayable',
              type: 'function',
            },
            [
              forwarderContract.address,
              factoryContract.address,
              salt,
              name,
              symbol,
              baseURI,
              user,
              ITEMS,
            ]
          )

          const { logs } = await sendMetaTx(
            collectionManagerContract,
            functionSignature,
            user,
            relayer,
            null,
            'Decentraland Collection Manager',
            '1'
          )

          collectionContract = await ERC721CollectionV2.at(logs[1].address)

          const name_ = await collectionContract.name()
          expect(name_).to.be.equal(name)

          const symbol_ = await collectionContract.symbol()
          expect(symbol_).to.be.equal(symbol)

          const baseURI_ = await collectionContract.baseURI()
          expect(baseURI_).to.be.equal(baseURI)

          const creator_ = await collectionContract.creator()
          expect(creator_).to.be.equal(user)

          const owner_ = await collectionContract.owner()
          expect(owner_).to.be.equal(forwarderContract.address)

          const isApproved = await collectionContract.isApproved()
          expect(isApproved).to.be.equal(false)

          const isCompleted = await collectionContract.isCompleted()
          expect(isCompleted).to.be.equal(true)

          const rarities = await collectionContract.rarities()
          expect(rarities).to.be.equal(raritiesContract.address)

          const itemLength = await collectionContract.itemsCount()

          expect(ITEMS.length).to.be.eq.BN(itemLength)

          for (let i = 0; i < ITEMS.length; i++) {
            const {
              rarity,
              maxSupply,
              totalSupply,
              price,
              beneficiary,
              metadata,
              contentHash,
            } = await collectionContract.items(i)

            expect(rarity).to.be.eq.BN(ITEMS[i][0])
            expect(maxSupply).to.be.eq.BN(RARITIES[ITEMS[i][0]].value)
            expect(totalSupply).to.be.eq.BN(0)
            expect(price).to.be.eq.BN(ITEMS[i][1])
            expect(beneficiary.toLowerCase()).to.be.equal(
              ITEMS[i][2].toLowerCase()
            )
            expect(metadata).to.be.equal(ITEMS[i][3])
            expect(contentHash).to.be.equal('')
          }
        })
      })

      describe('Manage collection :: Relayed EIP721', async function () {
        it('should approve a collection by the committee', async function () {
          let isApproved = await collectionContract.isApproved()
          expect(isApproved).to.be.equal(false)

          const functionSignature = web3.eth.abi.encodeFunctionCall(
            {
              inputs: [
                {
                  internalType: 'contract ICollectionManager',
                  name: '_collectionManager',
                  type: 'address',
                },
                {
                  internalType: 'address',
                  name: '_forwarder',
                  type: 'address',
                },
                {
                  internalType: 'address',
                  name: '_collection',
                  type: 'address',
                },
                {
                  internalType: 'bytes[]',
                  name: '_data',
                  type: 'bytes[]',
                },
              ],
              name: 'manageCollection',
              outputs: [],
              stateMutability: 'nonpayable',
              type: 'function',
            },
            [
              collectionManagerContract.address,
              forwarderContract.address,
              collectionContract.address,
              [
                web3.eth.abi.encodeFunctionCall(
                  {
                    inputs: [
                      {
                        internalType: 'bool',
                        name: '_value',
                        type: 'bool',
                      },
                    ],
                    name: 'setApproved',
                    outputs: [],
                    stateMutability: 'nonpayable',
                    type: 'function',
                  },
                  [true]
                ),
              ],
            ]
          )

          await sendMetaTx(
            committeeContract,
            functionSignature,
            user,
            relayer,
            null,
            'Decentraland Collection Committee',
            '1'
          )

          isApproved = await collectionContract.isApproved()
          expect(isApproved).to.be.equal(true)
        })

        it('should set not editable a collection by the committee', async function () {
          let isEditable = await collectionContract.isEditable()
          expect(isEditable).to.be.equal(true)

          // Set Editable false to collection
          const functionSignature = web3.eth.abi.encodeFunctionCall(
            {
              inputs: [
                {
                  internalType: 'contract ICollectionManager',
                  name: '_collectionManager',
                  type: 'address',
                },
                {
                  internalType: 'address',
                  name: '_forwarder',
                  type: 'address',
                },
                {
                  internalType: 'address',
                  name: '_collection',
                  type: 'address',
                },
                {
                  internalType: 'bytes[]',
                  name: '_data',
                  type: 'bytes[]',
                },
              ],
              name: 'manageCollection',
              outputs: [],
              stateMutability: 'nonpayable',
              type: 'function',
            },
            [
              collectionManagerContract.address,
              forwarderContract.address,
              collectionContract.address,
              [
                web3.eth.abi.encodeFunctionCall(
                  {
                    inputs: [
                      {
                        internalType: 'bool',
                        name: '_value',
                        type: 'bool',
                      },
                    ],
                    name: 'setEditable',
                    outputs: [],
                    stateMutability: 'nonpayable',
                    type: 'function',
                  },
                  [false]
                ),
              ],
            ]
          )

          await sendMetaTx(
            committeeContract,
            functionSignature,
            user,
            relayer,
            null,
            'Decentraland Collection Committee',
            '1'
          )

          isEditable = await collectionContract.isEditable()
          expect(isEditable).to.be.equal(false)
        })

        it('should rescue items by the committee', async function () {
          const newContentHash0 =
            'bafybeiemxf5abjwjbikoz4mc3a3dla6ual3jsgpdr4cjr3oz3evfyavhwq'
          const newMetadata0 = '1:crocodile_mask:earrings:female'
          const newContentHash1 =
            'bafybeiemxf5abjwjbikoz4mc3a3dla6ual3jsgpdr4cjr3oz3evfyavhwc'
          const newMetadata1 = '1:whale_mask:earrings:female'

          let item0 = await collectionContract.items(0)
          expect([
            item0.rarity.toString(),
            item0.maxSupply.toString(),
            item0.totalSupply.toString(),
            item0.price.toString(),
            item0.beneficiary.toLowerCase(),
            item0.metadata,
            item0.contentHash,
          ]).to.be.eql([
            ITEMS[0][0].toString(),
            RARITIES[ITEMS[0][0]].value.toString(),
            '0',
            ITEMS[0][1].toString(),
            ITEMS[0][2].toLowerCase(),
            ITEMS[0][3],
            '',
          ])

          let item1 = await collectionContract.items(1)
          expect([
            item1.rarity.toString(),
            item1.maxSupply.toString(),
            item1.totalSupply.toString(),
            item1.price.toString(),
            item1.beneficiary.toLowerCase(),
            item1.metadata,
            item1.contentHash,
          ]).to.be.eql([
            ITEMS[1][0].toString(),
            RARITIES[ITEMS[1][0]].value.toString(),
            '0',
            ITEMS[1][1].toString(),
            ITEMS[1][2].toLowerCase(),
            ITEMS[1][3],
            '',
          ])

          // Rescue items
          const functionSignature = web3.eth.abi.encodeFunctionCall(
            {
              inputs: [
                {
                  internalType: 'contract ICollectionManager',
                  name: '_collectionManager',
                  type: 'address',
                },
                {
                  internalType: 'address',
                  name: '_forwarder',
                  type: 'address',
                },
                {
                  internalType: 'address',
                  name: '_collection',
                  type: 'address',
                },
                {
                  internalType: 'bytes[]',
                  name: '_data',
                  type: 'bytes[]',
                },
              ],
              name: 'manageCollection',
              outputs: [],
              stateMutability: 'nonpayable',
              type: 'function',
            },
            [
              collectionManagerContract.address,
              forwarderContract.address,
              collectionContract.address,
              [
                web3.eth.abi.encodeFunctionCall(
                  {
                    inputs: [
                      {
                        internalType: 'uint256[]',
                        name: '_itemIds',
                        type: 'uint256[]',
                      },
                      {
                        internalType: 'string[]',
                        name: '_contentHashes',
                        type: 'string[]',
                      },
                      {
                        internalType: 'string[]',
                        name: '_metadatas',
                        type: 'string[]',
                      },
                    ],
                    name: 'rescueItems',
                    outputs: [],
                    stateMutability: 'nonpayable',
                    type: 'function',
                  },
                  [
                    [0, 1],
                    [newContentHash0, newContentHash1],
                    [newMetadata0, newMetadata1],
                  ]
                ),
              ],
            ]
          )

          await sendMetaTx(
            committeeContract,
            functionSignature,
            user,
            relayer,
            null,
            'Decentraland Collection Committee',
            '1'
          )

          item0 = await collectionContract.items(0)
          expect([
            item0.rarity.toString(),
            item0.maxSupply.toString(),
            item0.totalSupply.toString(),
            item0.price.toString(),
            item0.beneficiary.toLowerCase(),
            item0.metadata,
            item0.contentHash,
          ]).to.be.eql([
            ITEMS[0][0].toString(),
            RARITIES[ITEMS[0][0]].value.toString(),
            '0',
            ITEMS[0][1].toString(),
            ITEMS[0][2].toLowerCase(),
            newMetadata0,
            newContentHash0,
          ])

          item1 = await collectionContract.items(1)
          expect([
            item1.rarity.toString(),
            item0.maxSupply.toString(),
            item1.totalSupply.toString(),
            item1.price.toString(),
            item1.beneficiary.toLowerCase(),
            item1.metadata,
            item1.contentHash,
          ]).to.be.eql([
            ITEMS[1][0].toString(),
            RARITIES[ITEMS[1][0]].value.toString(),
            '0',
            ITEMS[1][1].toString(),
            ITEMS[1][2].toLowerCase(),
            newMetadata1,
            newContentHash1,
          ])
        })
      })
    })
  }

  // Run the set of tests before the upgrade
  tests()

  describe('Upgrade Collection implementation', function () {
    before(async function () {
      await upgradeableBeaconContract.upgradeTo(
        collectionUpgradeContract.address
      )
    })

    it('should set the collection upgrade address as implementation in the upgradable beacon contract', async function () {
      expect(await upgradeableBeaconContract.implementation()).to.be.equal(
        collectionUpgradeContract.address
      )
    })

    it('should still have the previously created collection', async function () {
      const name_ = await collectionContract.name()
      expect(name_).to.be.equal(name)

      const symbol_ = await collectionContract.symbol()
      expect(symbol_).to.be.equal(symbol)

      const baseURI_ = await collectionContract.baseURI()
      expect(baseURI_).to.be.equal(baseURI)

      const creator_ = await collectionContract.creator()
      expect(creator_).to.be.equal(user)

      const owner_ = await collectionContract.owner()
      expect(owner_).to.be.equal(forwarderContract.address)

      const isApproved = await collectionContract.isApproved()
      expect(isApproved).to.be.equal(true)

      const isCompleted = await collectionContract.isCompleted()
      expect(isCompleted).to.be.equal(true)

      const rarities = await collectionContract.rarities()
      expect(rarities).to.be.equal(raritiesContract.address)

      const itemLength = await collectionContract.itemsCount()

      // Clone original ITEMS
      const ITEMS_2 = JSON.parse(JSON.stringify(ITEMS)).map((item) => {
        // Set content hash to empty string
        item[4] = ''
        return item
      })

      // Updated previously rescued items to match current state
      ITEMS_2[0][3] = '1:crocodile_mask:earrings:female'
      ITEMS_2[0][4] =
        'bafybeiemxf5abjwjbikoz4mc3a3dla6ual3jsgpdr4cjr3oz3evfyavhwq'

      ITEMS_2[1][3] = '1:whale_mask:earrings:female'
      ITEMS_2[1][4] =
        'bafybeiemxf5abjwjbikoz4mc3a3dla6ual3jsgpdr4cjr3oz3evfyavhwc'

      expect(ITEMS_2.length).to.be.eq.BN(itemLength)

      for (let i = 0; i < ITEMS_2.length; i++) {
        const {
          rarity,
          maxSupply,
          totalSupply,
          price,
          beneficiary,
          metadata,
          contentHash,
        } = await collectionContract.items(i)

        expect(rarity).to.be.eq.BN(ITEMS_2[i][0])
        expect(maxSupply).to.be.eq.BN(RARITIES[ITEMS_2[i][0]].value)
        expect(totalSupply).to.be.eq.BN(0)
        expect(price).to.be.eq.BN(ITEMS_2[i][1])
        expect(beneficiary.toLowerCase()).to.be.equal(
          ITEMS_2[i][2].toLowerCase()
        )
        expect(metadata).to.be.equal(ITEMS_2[i][3])
        expect(contentHash).to.be.equal(ITEMS_2[i][4])
      }
    })

    // Run the set of tests after the upgrade
    tests()
  })
})
