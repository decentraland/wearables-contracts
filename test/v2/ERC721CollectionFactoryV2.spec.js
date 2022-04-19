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
import {
  ProxyAdmin,
  TransparentUpgradeableProxy,
} from '../helpers/thirdPartyRegistry'
import { ethers } from 'hardhat'

const BN = web3.utils.BN
const expect = require('chai').use(require('bn-chai')(BN)).expect

const ERC721CollectionFactoryV2 = artifacts.require('ERC721CollectionFactoryV2')
const ERC721CollectionV2 = artifacts.require('ERC721CollectionV2')
const Rarities = artifacts.require('Rarities')

describe.only('Factory V2', function () {
  let factoryContract
  let raritiesContract
  let proxyAdminContract

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

    // const collectionProxy = await upgrades.deployProxy(
    //   ERC721CollectionV2foo,
    //   []
    // )

    // const ERC721CollectionV2foo = await ethers.getContractFactory(
    //   'ERC721CollectionV2'
    // )

    const ProxyAdminFactory = await ethers.getContractFactory(
      ProxyAdmin.abi,
      ProxyAdmin.bytecode
    )

    const TransparentUpgradeableProxyFactory = await ethers.getContractFactory(
      TransparentUpgradeableProxy.abi,
      TransparentUpgradeableProxy.bytecode
    )

    const collectionImplementationContract = await ERC721CollectionV2.new()

    proxyAdminContract = await ProxyAdminFactory.deploy()

    // Encode TPR initialize function data, which is used by the Proxy to
    // call the initialize function.
    // const collectionFactoryInterface = ERC721CollectionV2.interface
    // const fragment = collectionFactoryInterface.getFunction('initialize')
    // const encodedFunctionData = collectionFactoryInterface.encodeFunctionData(
    //   fragment,
    //   [
    //     owner,
    //     thirdPartyAggregator,
    //     collector,
    //     committeeContract.address,
    //     manaContract.address,
    //     chainlinkOracleContract.address,
    //     oneEther.toString(),
    //   ]
    // )

    const transparentProxy =
      await TransparentUpgradeableProxyFactory.deploy(
        collectionImplementationContract.address,
        proxyAdminContract.address,
        []
      )

    // ------

    factoryContract = await ERC721CollectionFactoryV2.new(
      factoryOwner,
      transparentProxy.address
    )

    raritiesContract = await Rarities.new(deployer, getInitialRarities())
  })

  describe('create factory', async function () {
    it('deploy with correct values', async function () {
      const collectionImpl = await ERC721CollectionV2.new(creationParams)
      const contract = await ERC721CollectionFactoryV2.new(
        factoryOwner,
        collectionImpl.address
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

      console.log(await proxyAdminContract.getProxyAdmin(expectedAddress))

      let isCollectionFromFactory =
        await factoryContract.isCollectionFromFactory(expectedAddress)
      expect(isCollectionFromFactory).to.be.eq.BN(false)

      const { logs } = await factoryContract.createCollection(
        salt,
        data,
        fromFactoryOwner
      )

      expect(logs.length).to.be.equal(1)

      

      let log = logs[0]
      expect(log.event).to.be.equal('ProxyCreated')
      expect(log.args._address).to.be.equal(expectedAddress)
      expect(log.args._salt).to.be.equal(hexlify(salt))

      collectionsSize = await factoryContract.collectionsSize()

      expect(collectionsSize).to.be.eq.BN(1)

      isCollectionFromFactory = await factoryContract.isCollectionFromFactory(
        expectedAddress
      )

      expect(isCollectionFromFactory).to.be.eq.BN(true)

      const collection = await ERC721CollectionV2.at(expectedAddress)

      const owner_ = await collection.owner(fromUser)

      expect(owner_).to.be.equal(factoryOwner)
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

      expect(logs.length).to.be.equal(1)

      let log = logs[0]
      expect(log.event).to.be.equal('ProxyCreated')
      expect(log.args._address).to.be.equal(expectedAddress)
      expect(log.args._salt).to.be.equal(hexlify(salt))

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
        'MinimalProxyFactory#createProxy: CALL_FAILED'
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
        'MinimalProxyFactory#createProxy: CREATION_FAILED'
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
