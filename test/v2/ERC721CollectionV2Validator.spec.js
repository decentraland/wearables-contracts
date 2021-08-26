import hr from 'hardhat'
import { expect } from 'chai'

import assertRevert from '../helpers/assertRevert'
import {
  ITEMS,
  getInitialRarities,
  createDummyFactory,
  createDummyCollection,
} from '../helpers/collectionV2'

const Rarities = artifacts.require('Rarities')
const ERC721CollectionV2Validator = artifacts.require(
  'ERC721CollectionV2Validator'
)
const ERC721Collection = artifacts.require('ERC721CollectionV2')

describe('ERC721CollectionV2Validator', function () {
  let factoryContract1
  let factoryContract2
  let raritiesContract
  let collection1
  let collection2
  let collection3
  let collection4
  let collectionsV2Validator

  // Accounts
  let accounts
  let deployer
  let user
  let anotherUser
  let owner
  let collector
  let hacker
  let relayer
  let admin
  let rootManager
  let fromUser
  let fromAnotherUser
  let fromHacker
  let fromOwner
  let fromDeployer

  let creationParams

  beforeEach(async function () {
    accounts = await web3.eth.getAccounts()
    deployer = accounts[0]
    user = accounts[1]
    owner = accounts[3]
    hacker = accounts[4]
    anotherUser = accounts[5]
    relayer = accounts[7]
    admin = accounts[8]
    rootManager = accounts[6]

    fromUser = { from: user }
    fromAnotherUser = { from: anotherUser }
    fromHacker = { from: hacker }

    fromOwner = { from: owner }
    fromDeployer = { from: deployer }

    creationParams = {
      ...fromOwner,
      gas: 9e6,
      gasPrice: 21e9,
    }

    raritiesContract = await Rarities.new(owner, getInitialRarities())
    factoryContract1 = await createDummyFactory(deployer)
    factoryContract2 = await createDummyFactory(deployer)

    collectionsV2Validator = await ERC721CollectionV2Validator.new(
      owner,
      [factoryContract1.address],
      [1]
    )

    collection1 = await createDummyCollection(factoryContract1, {
      creator: deployer,
      shouldComplete: true,
      shouldApprove: true,
      items: ITEMS,
      rarities: raritiesContract.address,
    })
    collection2 = await createDummyCollection(factoryContract1, {
      creator: deployer,
      shouldComplete: true,
      shouldApprove: true,
      items: ITEMS,
      rarities: raritiesContract.address,
    })
    collection3 = await createDummyCollection(factoryContract2, {
      creator: deployer,
      shouldComplete: true,
      shouldApprove: true,
      items: ITEMS,
      rarities: raritiesContract.address,
    })
    collection4 = await ERC721Collection.new()
  })

  describe('create collection v2 validator', async function () {
    it('deploy with correct values', async function () {
      let contract = await ERC721CollectionV2Validator.new(
        owner,
        [factoryContract1.address],
        [1]
      )

      let isValid = await contract.factories(factoryContract1.address)
      expect(isValid).to.be.eq.BN(web3.utils.toBN(1))

      isValid = await contract.factories(factoryContract2.address)
      expect(isValid).to.be.eq.BN(web3.utils.toBN(0))
    })
  })

  describe('setFactories', async function () {
    it('should set factories', async function () {
      let isValid = await collectionsV2Validator.factories(
        factoryContract2.address
      )
      expect(isValid).to.be.eq.BN(web3.utils.toBN(0))

      let res = await collectionsV2Validator.setFactories(
        [factoryContract2.address],
        [1],
        fromOwner
      )
      let logs = res.logs
      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('FactorySet')
      expect(logs[0].args._factory).to.be.equal(factoryContract2.address)
      expect(logs[0].args._value).to.be.eq.BN(web3.utils.toBN(1))

      isValid = await collectionsV2Validator.factories(factoryContract2.address)
      expect(isValid).to.be.eq.BN(web3.utils.toBN(1))

      res = await collectionsV2Validator.setFactories(
        [factoryContract1.address, factoryContract2.address],
        [0, 0],
        fromOwner
      )
      logs = res.logs
      expect(logs.length).to.be.equal(2)
      expect(logs[0].event).to.be.equal('FactorySet')
      expect(logs[0].args._factory).to.be.equal(factoryContract1.address)
      expect(logs[0].args._value).to.be.eq.BN(web3.utils.toBN(0))

      expect(logs[1].event).to.be.equal('FactorySet')
      expect(logs[1].args._factory).to.be.equal(factoryContract2.address)
      expect(logs[1].args._value).to.be.eq.BN(web3.utils.toBN(0))

      isValid = await collectionsV2Validator.factories(factoryContract1.address)
      expect(isValid).to.be.eq.BN(web3.utils.toBN(0))

      isValid = await collectionsV2Validator.factories(factoryContract2.address)
      expect(isValid).to.be.eq.BN(web3.utils.toBN(0))
    })

    it('reverts when trying to set a factory by an unauthorized user', async function () {
      await assertRevert(
        collectionsV2Validator.setFactories(
          [factoryContract2.address],
          [1],
          fromHacker
        ),
        'Ownable: caller is not the owner'
      )
    })

    it('reverts when trying to set factories with different length', async function () {
      await assertRevert(
        collectionsV2Validator.setFactories(
          [factoryContract2.address],
          [1, 1],
          fromOwner
        ),
        'CV2V#setFactories: LENGTH_MISMATCH'
      )

      await assertRevert(
        collectionsV2Validator.setFactories(
          [factoryContract1.address, factoryContract2.address],
          [1],
          fromOwner
        ),
        'CV2V#setFactories: LENGTH_MISMATCH'
      )
    })
  })

  describe('isValidCollection', async function () {
    it('should return whether a collection is valid or not', async function () {
      // Ok
      let isValid = await collectionsV2Validator.isValidCollection(
        collection1.address,
        web3.eth.abi.encodeParameters(['address'], [factoryContract1.address])
      )
      expect(isValid).to.be.equal(true)

      // Ok
      isValid = await collectionsV2Validator.isValidCollection(
        collection2.address,
        web3.eth.abi.encodeParameters(['address'], [factoryContract1.address])
      )
      expect(isValid).to.be.equal(true)

      // Invalid factory
      isValid = await collectionsV2Validator.isValidCollection(
        collection1.address,
        web3.eth.abi.encodeParameters(['address'], [factoryContract2.address])
      )
      expect(isValid).to.be.equal(false)

      // Invalid collection not from factory
      isValid = await collectionsV2Validator.isValidCollection(
        collection3.address,
        web3.eth.abi.encodeParameters(['address'], [factoryContract1.address])
      )
      expect(isValid).to.be.equal(false)

      // Invalid collection not from any factory
      isValid = await collectionsV2Validator.isValidCollection(
        collection4.address,
        web3.eth.abi.encodeParameters(['address'], [factoryContract1.address])
      )
      expect(isValid).to.be.equal(false)

      // Invalid data encoding
      isValid = await assertRevert(
        collectionsV2Validator.isValidCollection(collection4.address, '0x')
      )
    })
  })
})
