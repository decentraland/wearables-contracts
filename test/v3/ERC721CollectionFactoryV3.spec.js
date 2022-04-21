import { keccak256 } from '@ethersproject/solidity'
import { hexlify } from '@ethersproject/bytes'

import assertRevert from '../helpers/assertRevert'
import {
  getInitData,
  ZERO_ADDRESS,
  RARITIES,
  ITEMS,
  getInitialRarities,
} from '../helpers/collectionV2'

const BN = web3.utils.BN
const expect = require('chai').use(require('bn-chai')(BN)).expect

const UpgradeableBeacon = artifacts.require('UpgradeableBeacon')
const BeaconProxy = artifacts.require('BeaconProxy')
const ERC721CollectionFactoryV3 = artifacts.require('ERC721CollectionFactoryV3')
const ERC721CollectionV2 = artifacts.require('ERC721CollectionV2')
const DummyERC721CollectionV2Upgrade = artifacts.require(
  'DummyERC721CollectionV2Upgrade'
)
const DummyERC721CollectionV2UpgradeInvalidStorage = artifacts.require(
  'DummyERC721CollectionV2UpgradeInvalidStorage'
)
const Rarities = artifacts.require('Rarities')

describe('Factory V3', function () {
  let upgradeableBeaconContract
  let collectionImplementation
  let factoryContract
  let raritiesContract

  // Accounts
  let accounts
  let deployer
  let user
  let manager
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
    manager = accounts[5]

    fromUser = { from: user }
    fromHacker = { from: hacker }

    fromFactoryOwner = { from: factoryOwner }

    creationParams = {
      ...fromFactoryOwner,
      gas: 9e6,
      gasPrice: 21e9,
    }

    collectionImplementation = await ERC721CollectionV2.new()

    upgradeableBeaconContract = await UpgradeableBeacon.new(
      collectionImplementation.address
    )

    factoryContract = await ERC721CollectionFactoryV3.new(
      factoryOwner,
      upgradeableBeaconContract.address
    )

    raritiesContract = await Rarities.new(deployer, getInitialRarities())
  })

  describe('create factory', async function () {
    it('deploy with correct values', async function () {
      const collectionImpl = await ERC721CollectionV2.new(creationParams)
      const upgradeableBeacon = await UpgradeableBeacon.new(
        collectionImpl.address
      )
      const contract = await ERC721CollectionFactoryV3.new(
        factoryOwner,
        upgradeableBeacon.address
      )

      const impl = await contract.implementation()
      const owner = await contract.owner()
      const code = await contract.code()
      const codeHash = await contract.codeHash()
      const expectedCode = `${BeaconProxy._json.bytecode}${web3.eth.abi
        .encodeParameters(['address', 'bytes'], [upgradeableBeacon.address, []])
        .replace('0x', '')}`

      expect(impl).to.be.equal(upgradeableBeacon.address)
      expect(owner).to.be.equal(factoryOwner)
      expect(expectedCode.toLowerCase()).to.be.equal(code.toLowerCase())
      expect(web3.utils.soliditySha3(expectedCode)).to.be.equal(codeHash)
    })
  })

  describe('getAddress', function () {
    it('should get a deterministic address on-chain', async function () {
      const salt = web3.utils.randomHex(32)
      const data = getInitData({
        creator: user,
        shouldComplete: true,
        isApproved: true,
        rarities: raritiesContract.address,
      })
      const expectedAddress = await factoryContract.getAddress(
        salt,
        factoryOwner,
        data
      )

      const { logs } = await factoryContract.createCollection(
        salt,
        data,
        fromFactoryOwner
      )

      expect(logs[0].args._address.toLowerCase()).to.be.equal(
        expectedAddress.toLowerCase()
      )
    })

    it('should get a deterministic address off-chain', async function () {
      const codeHash = await factoryContract.codeHash()
      console.log(`Codehash: ${codeHash}`)

      const salt = web3.utils.randomHex(32)
      const data = getInitData({
        creator: user,
        shouldComplete: true,
        isApproved: true,
        rarities: raritiesContract.address,
      })

      const expectedAddress = `0x${keccak256(
        ['bytes1', 'address', 'bytes32', 'bytes32'],
        [
          '0xff',
          factoryContract.address,
          keccak256(
            ['bytes32', 'address', 'bytes'],
            [salt, factoryOwner, data]
          ),
          codeHash,
        ]
      ).slice(-40)}`.toLowerCase()

      const { logs } = await factoryContract.createCollection(
        salt,
        data,
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
      const salt = web3.utils.randomHex(32)
      const data = getInitData({
        name,
        symbol,
        baseURI,
        creator: user,
        shouldComplete: true,
        isApproved: true,
        items: ITEMS,
        rarities: raritiesContract.address,
      })
      const expectedAddress = await factoryContract.getAddress(
        salt,
        factoryOwner,
        data
      )

      let collectionsSize = await factoryContract.collectionsSize()
      expect(collectionsSize).to.be.eq.BN(0)

      let isCollectionFromFactory =
        await factoryContract.isCollectionFromFactory(expectedAddress)
      expect(isCollectionFromFactory).to.be.eq.BN(false)

      const { logs } = await factoryContract.createCollection(
        salt,
        data,
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
      const salt = web3.utils.randomHex(32)
      const data = getInitData({
        name,
        symbol,
        baseURI,
        creator: user,
        shouldComplete: true,
        isApproved: true,
        items: ITEMS,
        rarities: raritiesContract.address,
      })
      const expectedAddress = await factoryContract.getAddress(
        salt,
        factoryOwner,
        data
      )

      let collectionsSize = await factoryContract.collectionsSize()
      expect(collectionsSize).to.be.eq.BN(0)

      let isCollectionFromFactory =
        await factoryContract.isCollectionFromFactory(expectedAddress)
      expect(isCollectionFromFactory).to.be.eq.BN(false)

      const { logs } = await factoryContract.createCollection(
        salt,
        data,
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
      const rarities_ = await collection.rarities()

      expect(baseURI_).to.be.equal(baseURI)
      expect(creator_).to.be.equal(user)
      expect(owner_).to.be.equal(factoryOwner)
      expect(name_).to.be.equal(name)
      expect(symbol_).to.be.equal(symbol)
      expect(isInitialized_).to.be.equal(true)
      expect(isApproved_).to.be.equal(false)
      expect(isCompleted_).to.be.equal(shouldComplete)
      expect(isEditable_).to.be.equal(true)
      expect(rarities_).to.be.equal(raritiesContract.address)

      const itemLength = await collection.itemsCount()

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
        } = await collection.items(i)

        expect(rarity).to.be.eq.BN(ITEMS[i][0])
        expect(maxSupply).to.be.eq.BN(RARITIES[ITEMS[i][0]].value)
        expect(totalSupply).to.be.eq.BN(0)
        expect(price).to.be.eq.BN(ITEMS[i][1])
        expect(beneficiary.toLowerCase()).to.be.equal(ITEMS[i][2].toLowerCase())
        expect(metadata).to.be.equal(ITEMS[i][3])
        expect(contentHash).to.be.equal('')
      }

      collectionsSize = await factoryContract.collectionsSize()
      expect(collectionsSize).to.be.eq.BN(1)

      isCollectionFromFactory = await factoryContract.isCollectionFromFactory(
        expectedAddress
      )
      expect(isCollectionFromFactory).to.be.eq.BN(true)
    })

    it('should create different addresses from different salts', async function () {
      const salt1 = web3.utils.randomHex(32)
      const salt2 = web3.utils.randomHex(32)

      let collectionsSize = await factoryContract.collectionsSize()
      expect(collectionsSize).to.be.eq.BN(0)

      const res1 = await factoryContract.createCollection(
        salt1,
        getInitData({
          name,
          symbol,
          baseURI,
          creator: user,
          shouldComplete: true,
          isApproved: true,
          items: ITEMS,
          rarities: raritiesContract.address,
        }),
        fromFactoryOwner
      )
      const address1 = res1.logs[0].args._address

      const res2 = await factoryContract.createCollection(
        salt2,
        getInitData({
          name,
          symbol,
          baseURI,
          creator: user,
          shouldComplete: true,
          isApproved: true,
          items: ITEMS,
          rarities: raritiesContract.address,
        }),
        fromFactoryOwner
      )
      const address2 = res2.logs[0].args._address

      expect(address2).to.not.be.equal(address1)

      collectionsSize = await factoryContract.collectionsSize()
      expect(collectionsSize).to.be.eq.BN(2)

      let isCollectionFromFactory =
        await factoryContract.isCollectionFromFactory(address1)
      expect(isCollectionFromFactory).to.be.eq.BN(true)

      isCollectionFromFactory = await factoryContract.isCollectionFromFactory(
        address2
      )
      expect(isCollectionFromFactory).to.be.eq.BN(true)
    })

    it('should create 3 collections and upgrade all of them', async function () {
      expect(await factoryContract.collectionsSize()).to.be.eq.BN(0)

      const createCollection = async (id) => {
        const salt = web3.utils.randomHex(32)

        const data = getInitData({
          name: name + id,
          symbol: symbol + id,
          baseURI: baseURI + id,
          creator: user,
          shouldComplete: true,
          isApproved: true,
          items: ITEMS,
          rarities: raritiesContract.address,
        })

        await factoryContract.createCollection(salt, data, fromFactoryOwner)

        return factoryContract.getAddress(salt, factoryOwner, data)
      }

      const collectionAddress1 = await createCollection('-1')
      const collectionAddress2 = await createCollection('-2')
      const collectionAddress3 = await createCollection('-3')

      expect(await factoryContract.collectionsSize()).to.be.eq.BN(3)

      const collectionUpgradeImplementation =
        await DummyERC721CollectionV2Upgrade.new()

      await upgradeableBeaconContract.upgradeTo(
        collectionUpgradeImplementation.address
      )

      const collection1 = await DummyERC721CollectionV2Upgrade.at(
        collectionAddress1
      )
      const collection2 = await DummyERC721CollectionV2Upgrade.at(
        collectionAddress2
      )
      const collection3 = await DummyERC721CollectionV2Upgrade.at(
        collectionAddress3
      )

      expect(await collection1.name()).to.be.equal('collectionName-1')
      expect(await collection2.name()).to.be.equal('collectionName-2')
      expect(await collection3.name()).to.be.equal('collectionName-3')

      expect(await collection1.symbol()).to.be.equal('collectionSymbol-1')
      expect(await collection2.symbol()).to.be.equal('collectionSymbol-2')
      expect(await collection3.symbol()).to.be.equal('collectionSymbol-3')

      expect(await collection1.baseURI()).to.be.equal('collectionBaseURI-1')
      expect(await collection2.baseURI()).to.be.equal('collectionBaseURI-2')
      expect(await collection3.baseURI()).to.be.equal('collectionBaseURI-3')

      const msg = 'This is a function from the upgraded collection contract ;)'

      expect(await collection1.addedFunction()).to.be.equal(msg)
      expect(await collection2.addedFunction()).to.be.equal(msg)
      expect(await collection3.addedFunction()).to.be.equal(msg)

      expect(await collection1.globalManagers(manager)).to.be.equal(false)
      expect(await collection2.globalManagers(manager)).to.be.equal(false)
      expect(await collection3.globalManagers(manager)).to.be.equal(false)

      expect(await collection1.upgradeCount()).to.be.eq.BN('0')
      expect(await collection2.upgradeCount()).to.be.eq.BN('0')
      expect(await collection3.upgradeCount()).to.be.eq.BN('0')

      const res1 = await collection1.setManagers([manager], [true], fromUser)
      const res2 = await collection2.setManagers([manager], [true], fromUser)
      const res3 = await collection3.setManagers([manager], [true], fromUser)

      expect(res1.logs[1].event).to.be.equal('UpgradeEvent')
      expect(res1.logs[1].args._caller).to.be.equal(user)
      expect(res1.logs[1].args._upgradeCount).to.be.eq.BN('1')

      expect(res2.logs[1].event).to.be.equal('UpgradeEvent')
      expect(res2.logs[1].args._caller).to.be.equal(user)
      expect(res2.logs[1].args._upgradeCount).to.be.eq.BN('1')

      expect(res3.logs[1].event).to.be.equal('UpgradeEvent')
      expect(res3.logs[1].args._caller).to.be.equal(user)
      expect(res3.logs[1].args._upgradeCount).to.be.eq.BN('1')

      expect(await collection1.upgradeCount()).to.be.eq.BN('1')
      expect(await collection2.upgradeCount()).to.be.eq.BN('1')
      expect(await collection3.upgradeCount()).to.be.eq.BN('1')

      expect(await collection1.globalManagers(manager)).to.be.equal(true)
      expect(await collection2.globalManagers(manager)).to.be.equal(true)
      expect(await collection3.globalManagers(manager)).to.be.equal(true)
    })

    it('should return invalid data when an upgrade with differently ordered state variables is deployed', async function () {
      const salt = web3.utils.randomHex(32)

      const data = getInitData({
        name,
        symbol,
        baseURI,
        creator: user,
        shouldComplete: true,
        isApproved: true,
        items: ITEMS,
        rarities: raritiesContract.address,
      })

      await factoryContract.createCollection(salt, data, fromFactoryOwner)

      const collectionAddress = await factoryContract.getAddress(
        salt,
        factoryOwner,
        data
      )

      const collectionUpgradeImplementation =
        await DummyERC721CollectionV2UpgradeInvalidStorage.new()

      await upgradeableBeaconContract.upgradeTo(
        collectionUpgradeImplementation.address
      )

      const collection =
        await DummyERC721CollectionV2UpgradeInvalidStorage.at(collectionAddress)

      // Should be 0 on a proper upgrade, but as the new state variable was not placed last, things got bad.
      expect(await collection.upgradeCount()).to.not.be.eq.BN(0)
    })

    it('reverts if initialize call failed', async function () {
      const salt = web3.utils.randomHex(32)
      await assertRevert(
        factoryContract.createCollection(
          salt,
          getInitData({
            name,
            symbol,
            baseURI,
            creator: ZERO_ADDRESS,
            shouldComplete: true,
            isApproved: true,
            items: ITEMS,
            rarities: raritiesContract.address,
          }),
          fromFactoryOwner
        ),
        'BeaconProxyFactory#_createProxy: CALL_FAILED'
      )
    })

    it('reverts if trying to re-deploy the same collection', async function () {
      const salt = web3.utils.randomHex(32)
      await factoryContract.createCollection(
        salt,
        getInitData({
          name,
          symbol,
          baseURI,
          creator: user,
          shouldComplete: true,
          isApproved: true,
          items: ITEMS,
          rarities: raritiesContract.address,
        }),
        fromFactoryOwner
      )

      await assertRevert(
        factoryContract.createCollection(
          salt,
          getInitData({
            name,
            symbol,
            baseURI,
            creator: user,
            shouldComplete: true,
            isApproved: true,
            items: ITEMS,
            rarities: raritiesContract.address,
          }),
          fromFactoryOwner
        ),
        'BeaconProxyFactory#_createProxy: CREATION_FAILED'
      )
    })

    it('reverts if trying to create a collection by not the owner', async function () {
      const salt = web3.utils.randomHex(32)
      await assertRevert(
        factoryContract.createCollection(
          salt,
          getInitData({
            name,
            symbol,
            baseURI,
            creator: user,
            shouldComplete: true,
            isApproved: true,
            items: ITEMS,
            rarities: raritiesContract.address,
          }),
          fromUser
        ),
        'Ownable: caller is not the owner'
      )
    })
  })
})
