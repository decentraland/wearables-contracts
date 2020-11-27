import { keccak256 } from '@ethersproject/solidity'
import { randomBytes } from '@ethersproject/random'
import { hexlify } from '@ethersproject/bytes'

import assertRevert from '../helpers/assertRevert'
import { getInitData, ZERO_ADDRESS, ITEMS } from '../helpers/collectionV2'
import { expect } from 'chai'

const ERC721CollectionFactoryV2 = artifacts.require('ERC721CollectionFactoryV2')
const ERC721CollectionV2 = artifacts.require('ERC721CollectionV2')

function encodeERC721Initialize(
  name,
  symbol,
  creator,
  shouldComplete,
  baseURI,
  items
) {
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
              internalType: 'enum ERC721BaseCollectionV2.RARITY',
              name: 'rarity',
              type: 'uint8',
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
    [name, symbol, creator, shouldComplete, baseURI, items]
  )
}

describe('Factory V2', function () {
  let collectionImplementation
  let factoryContract

  // Accounts
  let accounts
  let deployer
  let user
  let factoryOwner
  let hacker
  let fromUser
  let fromHacker
  let fromFactoryOwner

  let creationParams

  beforeEach(async function () {
    accounts = await web3.eth.getAccounts()
    deployer = accounts[0]
    user = accounts[1]
    factoryOwner = accounts[3]
    hacker = accounts[4]

    fromUser = { from: user }
    fromHacker = { from: hacker }

    fromFactoryOwner = { from: factoryOwner }

    creationParams = {
      ...fromFactoryOwner,
      gas: 9e6,
      gasPrice: 21e9,
    }

    collectionImplementation = await ERC721CollectionV2.new()

    factoryContract = await ERC721CollectionFactoryV2.new(
      collectionImplementation.address,
      factoryOwner
    )
  })

  describe('create factory', async function () {
    it('deploy with correct values', async function () {
      const collectionImpl = await ERC721CollectionV2.new(creationParams)
      const contract = await ERC721CollectionFactoryV2.new(
        collectionImpl.address,
        factoryOwner
      )

      const impl = await contract.implementation()
      const owner = await contract.owner()
      const code = await contract.code()
      const codeHash = await contract.codeHash()

      const expectedCode = `0x3d602d80600a3d3981f3363d3d373d3d3d363d73${collectionImpl.address.replace(
        '0x',
        ''
      )}5af43d82803e903d91602b57fd5bf3`

      expect(impl).to.be.equal(collectionImpl.address)
      expect(owner).to.be.equal(factoryOwner)
      expect(expectedCode.toLowerCase()).to.be.equal(code.toLowerCase())
      expect(web3.utils.soliditySha3(expectedCode)).to.be.equal(codeHash)
    })
  })

  describe('createCollection', function () {
    it('should set an implementation', async function () {
      let impl = await factoryContract.implementation()
      expect(impl).to.be.equal(collectionImplementation.address)

      const newImpl = await ERC721CollectionV2.new()

      const { logs } = await factoryContract.setImplementation(
        newImpl.address,
        fromFactoryOwner
      )

      const expectedCode = `0x3d602d80600a3d3981f3363d3d373d3d3d363d73${newImpl.address.replace(
        '0x',
        ''
      )}5af43d82803e903d91602b57fd5bf3`

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('ImplementationChanged')
      expect(logs[0].args._implementation).to.be.equal(newImpl.address)
      expect(logs[0].args._code.toLowerCase()).to.be.equal(
        expectedCode.toLowerCase()
      )
      expect(logs[0].args._codeHash).to.be.equal(
        keccak256(['bytes'], [expectedCode])
      )

      impl = await factoryContract.implementation()
      expect(impl).to.be.equal(newImpl.address)
    })

    it('reverts when trying to change the implementation by hacker', async function () {
      const newImpl = await ERC721CollectionV2.new()
      await assertRevert(
        factoryContract.setImplementation(newImpl.address, fromHacker),
        'Ownable: caller is not the owner'
      )
    })

    it('reverts when trying to change with an invalid implementation', async function () {
      await assertRevert(
        factoryContract.setImplementation(user, fromFactoryOwner),
        'MinimalProxyFactoryV2#_setImplementation: INVALID_IMPLEMENTATION'
      )

      await assertRevert(
        factoryContract.setImplementation(ZERO_ADDRESS, fromFactoryOwner),
        'MinimalProxyFactoryV2#_setImplementation: INVALID_IMPLEMENTATION'
      )
    })
  })

  describe('getAddress', function () {
    it('should get a deterministic address on-chain', async function () {
      const salt = randomBytes(32)
      const expectedAddress = await factoryContract.getAddress(
        salt,
        factoryOwner
      )

      const { logs } = await factoryContract.createCollection(
        salt,
        getInitData({
          creator: user,
          shouldComplete: true,
          creationParams,
        }),
        fromFactoryOwner
      )

      expect(logs[0].args._address.toLowerCase()).to.be.equal(
        expectedAddress.toLowerCase()
      )
    })

    it('should get a deterministic address off-chain', async function () {
      const codeHash = await factoryContract.codeHash()

      const salt = randomBytes(32)

      const expectedAddress = `0x${keccak256(
        ['bytes1', 'address', 'bytes32', 'bytes32'],
        [
          '0xff',
          factoryContract.address,
          keccak256(['bytes32', 'address'], [salt, factoryOwner]),
          codeHash,
        ]
      ).slice(-40)}`.toLowerCase()

      const { logs } = await factoryContract.createCollection(
        salt,
        getInitData({
          creator: user,
          shouldComplete: true,
          creationParams,
        }),
        fromFactoryOwner
      )

      expect(logs[0].args._address.toLowerCase()).to.be.equal(
        expectedAddress.toLowerCase()
      )
    })
  })

  describe('createCollection', function () {
    const name = 'collectionName'
    const symbol = 'collectionSymbol'
    const shouldComplete = true
    const baseURI = 'collectionBaseURI'
    const items = []

    it('should create a collection', async function () {
      const salt = randomBytes(32)
      const expectedAddress = await factoryContract.getAddress(
        salt,
        factoryOwner
      )

      let collectionsSize = await factoryContract.collectionsSize()
      expect(collectionsSize).to.be.eq.BN(0)

      let isCollectionFromFactory = await factoryContract.isCollectionFromFactory(
        expectedAddress
      )
      expect(isCollectionFromFactory).to.be.eq.BN(false)

      const { logs } = await factoryContract.createCollection(
        salt,
        encodeERC721Initialize(
          name,
          symbol,
          user,
          shouldComplete,
          baseURI,
          items
        ),
        fromFactoryOwner
      )

      expect(logs.length).to.be.equal(3)

      let log = logs[0]
      expect(log.event).to.be.equal('ProxyCreated')
      expect(log.args._address).to.be.equal(expectedAddress)
      expect(log.args._salt).to.be.equal(hexlify(salt))

      log = logs[1]
      expect(log.event).to.be.equal('OwnershipTransferred')
      expect(log.args.previousOwner).to.be.equal(ZERO_ADDRESS)
      expect(log.args.newOwner).to.be.equal(factoryContract.address)

      log = logs[2]
      expect(log.event).to.be.equal('OwnershipTransferred')
      expect(log.args.previousOwner).to.be.equal(factoryContract.address)
      expect(log.args.newOwner).to.be.equal(factoryOwner)

      collectionsSize = await factoryContract.collectionsSize()
      expect(collectionsSize).to.be.eq.BN(1)

      isCollectionFromFactory = await factoryContract.isCollectionFromFactory(
        expectedAddress
      )
      expect(isCollectionFromFactory).to.be.eq.BN(true)
    })

    it('should create a collection with items', async function () {
      const salt = randomBytes(32)
      const expectedAddress = await factoryContract.getAddress(
        salt,
        factoryOwner
      )

      let collectionsSize = await factoryContract.collectionsSize()
      expect(collectionsSize).to.be.eq.BN(0)

      let isCollectionFromFactory = await factoryContract.isCollectionFromFactory(
        expectedAddress
      )
      expect(isCollectionFromFactory).to.be.eq.BN(false)

      const { logs } = await factoryContract.createCollection(
        salt,
        encodeERC721Initialize(
          name,
          symbol,
          user,
          shouldComplete,
          baseURI,
          ITEMS
        ),
        fromFactoryOwner
      )

      expect(logs.length).to.be.equal(3)

      let log = logs[0]
      expect(log.event).to.be.equal('ProxyCreated')
      expect(log.args._address).to.be.equal(expectedAddress)
      expect(log.args._salt).to.be.equal(hexlify(salt))

      log = logs[1]
      expect(log.event).to.be.equal('OwnershipTransferred')
      expect(log.args.previousOwner).to.be.equal(ZERO_ADDRESS)
      expect(log.args.newOwner).to.be.equal(factoryContract.address)

      log = logs[2]
      expect(log.event).to.be.equal('OwnershipTransferred')
      expect(log.args.previousOwner).to.be.equal(factoryContract.address)
      expect(log.args.newOwner).to.be.equal(factoryOwner)

      // Check collection data
      const collection = await ERC721CollectionV2.at(expectedAddress)
      const baseURI_ = await collection.baseURI()
      const creator_ = await collection.creator()
      const owner_ = await collection.owner()
      const name_ = await collection.name()
      const symbol_ = await collection.symbol()
      const isInitialized_ = await collection.isInitialized()
      const isApproved_ = await collection.isApproved()
      const isCompleted_ = await collection.isCompleted()
      const isEditable_ = await collection.isEditable()

      expect(baseURI_).to.be.equal(baseURI)
      expect(creator_).to.be.equal(user)
      expect(owner_).to.be.equal(factoryOwner)
      expect(name_).to.be.equal(name)
      expect(symbol_).to.be.equal(symbol)
      expect(isInitialized_).to.be.equal(true)
      expect(isApproved_).to.be.equal(true)
      expect(isCompleted_).to.be.equal(shouldComplete)
      expect(isEditable_).to.be.equal(true)

      const itemLength = await collection.itemsCount()

      expect(ITEMS.length).to.be.eq.BN(itemLength)

      for (let i = 0; i < ITEMS.length; i++) {
        const {
          maxSupply,
          totalSupply,
          price,
          beneficiary,
          metadata,
          contentHash,
        } = await collection.items(i)

        expect(maxSupply).to.be.eq.BN(ITEMS[i][0])
        expect(totalSupply).to.be.eq.BN(ITEMS[i][1])
        expect(price).to.be.eq.BN(ITEMS[i][2])
        expect(beneficiary.toLowerCase()).to.be.equal(ITEMS[i][3].toLowerCase())
        expect(metadata).to.be.equal(ITEMS[i][4])
        expect(contentHash).to.be.equal(ITEMS[i][5])
      }

      collectionsSize = await factoryContract.collectionsSize()
      expect(collectionsSize).to.be.eq.BN(1)

      isCollectionFromFactory = await factoryContract.isCollectionFromFactory(
        expectedAddress
      )
      expect(isCollectionFromFactory).to.be.eq.BN(true)
    })

    it('should create different addresses from different salts', async function () {
      const salt1 = randomBytes(32)
      const salt2 = randomBytes(32)

      let collectionsSize = await factoryContract.collectionsSize()
      expect(collectionsSize).to.be.eq.BN(0)

      const res1 = await factoryContract.createCollection(
        salt1,
        encodeERC721Initialize(
          name,
          symbol,
          user,
          shouldComplete,
          baseURI,
          ITEMS
        ),
        fromFactoryOwner
      )
      const address1 = res1.logs[0].args._address

      const res2 = await factoryContract.createCollection(
        salt2,
        encodeERC721Initialize(
          name,
          symbol,
          user,
          shouldComplete,
          baseURI,
          ITEMS
        ),
        fromFactoryOwner
      )
      const address2 = res2.logs[0].args._address

      expect(address2).to.not.be.equal(address1)

      collectionsSize = await factoryContract.collectionsSize()
      expect(collectionsSize).to.be.eq.BN(2)

      let isCollectionFromFactory = await factoryContract.isCollectionFromFactory(
        address1
      )
      expect(isCollectionFromFactory).to.be.eq.BN(true)

      isCollectionFromFactory = await factoryContract.isCollectionFromFactory(
        address2
      )
      expect(isCollectionFromFactory).to.be.eq.BN(true)
    })

    it('reverts if initialize call failed', async function () {
      const salt = randomBytes(32)
      await assertRevert(
        factoryContract.createCollection(
          salt,
          encodeERC721Initialize(
            name,
            symbol,
            ZERO_ADDRESS,
            shouldComplete,
            baseURI,
            ITEMS
          ),
          fromFactoryOwner
        ),
        'MinimalProxyFactory#createProxy: CALL_FAILED'
      )
    })

    it('reverts if trying to re-deploy the same collection', async function () {
      const salt = randomBytes(32)
      await factoryContract.createCollection(
        salt,
        encodeERC721Initialize(
          name,
          symbol,
          user,
          shouldComplete,
          baseURI,
          ITEMS
        ),
        fromFactoryOwner
      )

      await assertRevert(
        factoryContract.createCollection(
          salt,
          encodeERC721Initialize(
            name,
            symbol,
            user,
            shouldComplete,
            baseURI,
            ITEMS
          ),
          fromFactoryOwner
        ),
        'MinimalProxyFactory#createProxy: CREATION_FAILED'
      )
    })

    it('reverts if trying to create a collection by not the owner', async function () {
      const salt = randomBytes(32)
      await assertRevert(
        factoryContract.createCollection(
          salt,
          encodeERC721Initialize(
            name,
            symbol,
            user,
            shouldComplete,
            baseURI,
            ITEMS
          ),
          fromUser
        ),
        'Ownable: caller is not the owner'
      )
    })
  })
})
