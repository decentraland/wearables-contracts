import hr from 'hardhat'
import { Mana } from 'decentraland-contract-plugins'
import { expect } from 'chai'

import assertRevert from '../helpers/assertRevert'
import { balanceSnap } from '../helpers/balanceSnap'
import {
  ITEMS,
  ZERO_ADDRESS,
  RARITIES,
  getInitialRarities,
  getRarityNames,
  getRarityDefaulPrices,
  DEFAULT_RARITY_PRICE,
  MAX_UINT256,
  RESCUE_ITEMS_SELECTOR,
  SET_APPROVE_COLLECTION_SELECTOR,
  SET_EDITABLE_SELECTOR,
} from '../helpers/collectionV2'
import { sendMetaTx } from '../helpers/metaTx'

const ERC721CollectionFactoryV2 = artifacts.require('ERC721CollectionFactoryV2')
const ERC721CollectionV2 = artifacts.require('ERC721CollectionV2')
const Committee = artifacts.require('Committee')
const CollectionManager = artifacts.require('CollectionManager')
const Forwarder = artifacts.require('Forwarder')
const Rarities = artifacts.require('Rarities')

describe('Collection Manager', function () {
  let manaContract
  let collectionImplementation
  let factoryContract
  let committeeContract
  let collectionManagerContract
  let forwarderContract
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

  beforeEach(async function () {
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

    committeeContract = await Committee.new(owner, [user], fromDeployer)

    raritiesContract = await Rarities.new(deployer, getInitialRarities())

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

    forwarderContract = await Forwarder.new(
      owner,
      collectionManagerContract.address,
      fromDeployer
    )

    factoryContract = await ERC721CollectionFactoryV2.new(
      forwarderContract.address,
      collectionImplementation.address
    )
  })

  describe('create collection manager', async function () {
    it('deploy with correct values', async function () {
      const contract = await CollectionManager.new(
        owner,
        manaContract.address,
        committeeContract.address,
        collector,
        raritiesContract.address,
        [SET_APPROVE_COLLECTION_SELECTOR],
        [true],
        fromDeployer
      )

      const collectionManagerOwner = await contract.owner()
      const mana = await contract.acceptedToken()
      const committee = await contract.committee()
      const isAllowed = await contract.allowedCommitteeMethods(
        SET_APPROVE_COLLECTION_SELECTOR
      )
      const feesCollector = await contract.feesCollector()
      const rarities = await contract.rarities()

      expect(collectionManagerOwner).to.be.equal(owner)
      expect(mana).to.be.equal(manaContract.address)
      expect(committee).to.be.equal(committeeContract.address)
      expect(isAllowed).to.be.equal(true)
      expect(feesCollector).to.be.equal(collector)
      expect(rarities).to.be.equal(raritiesContract.address)
    })
  })

  describe('setAcceptedToken', async function () {
    it('should set acceptedToken', async function () {
      let acceptedToken = await collectionManagerContract.acceptedToken()
      expect(acceptedToken).to.be.equal(manaContract.address)

      let res = await collectionManagerContract.setAcceptedToken(
        user,
        fromOwner
      )

      let logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('AcceptedTokenSet')
      expect(logs[0].args._oldAcceptedToken).to.be.equal(manaContract.address)
      expect(logs[0].args._newAcceptedToken).to.be.equal(user)

      acceptedToken = await collectionManagerContract.acceptedToken()
      expect(acceptedToken).to.be.equal(user)

      res = await collectionManagerContract.setAcceptedToken(
        manaContract.address,
        fromOwner
      )

      logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('AcceptedTokenSet')
      expect(logs[0].args._oldAcceptedToken).to.be.equal(user)
      expect(logs[0].args._newAcceptedToken).to.be.equal(manaContract.address)

      acceptedToken = await collectionManagerContract.acceptedToken()
      expect(acceptedToken).to.be.equal(manaContract.address)
    })

    it('reverts when trying to set the ZERO_ADDRESS as the acceptedToken', async function () {
      await assertRevert(
        collectionManagerContract.setAcceptedToken(ZERO_ADDRESS, fromOwner),
        'CollectionManager#setAcceptedToken: INVALID_ACCEPTED_TOKEN'
      )
    })

    it('reverts when trying to set a acceptedToken by hacker', async function () {
      await assertRevert(
        collectionManagerContract.setAcceptedToken(user, fromHacker),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('setCommittee', async function () {
    it('should set committee', async function () {
      let committee = await collectionManagerContract.committee()
      expect(committee).to.be.equal(committeeContract.address)

      let res = await collectionManagerContract.setCommittee(user, fromOwner)

      let logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('CommitteeSet')
      expect(logs[0].args._oldCommittee).to.be.equal(committeeContract.address)
      expect(logs[0].args._newCommittee).to.be.equal(user)

      committee = await collectionManagerContract.committee()
      expect(committee).to.be.equal(user)

      res = await collectionManagerContract.setCommittee(
        committeeContract.address,
        fromOwner
      )

      logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('CommitteeSet')
      expect(logs[0].args._oldCommittee).to.be.equal(user)
      expect(logs[0].args._newCommittee).to.be.equal(committeeContract.address)

      committee = await collectionManagerContract.committee()
      expect(committee).to.be.equal(committeeContract.address)
    })

    it('reverts when trying to set the ZERO_ADDRESS as the committee', async function () {
      await assertRevert(
        collectionManagerContract.setCommittee(ZERO_ADDRESS, fromOwner),
        'CollectionManager#setCommittee: INVALID_COMMITTEE'
      )
    })

    it('reverts when trying to set a committee by hacker', async function () {
      await assertRevert(
        collectionManagerContract.setCommittee(user, fromHacker),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('setCommitteeMethods', async function () {
    const methodSelector1 = '0x12345678'
    const methodSelector2 = '0x12345679'

    it('should set committee methods', async function () {
      let isAllowed = await collectionManagerContract.allowedCommitteeMethods(
        methodSelector1
      )
      expect(isAllowed).to.be.equal(false)

      isAllowed = await collectionManagerContract.allowedCommitteeMethods(
        methodSelector2
      )
      expect(isAllowed).to.be.equal(false)

      let res = await collectionManagerContract.setCommitteeMethods(
        [methodSelector1, methodSelector2],
        [true, true],
        fromOwner
      )

      let logs = res.logs

      expect(logs.length).to.be.equal(2)
      expect(logs[0].event).to.be.equal('CommitteeMethodSet')
      expect(logs[0].args._method).to.be.equal(
        web3.utils.padRight(methodSelector1, 64)
      )
      expect(logs[0].args._isAllowed).to.be.equal(true)

      expect(logs[1].event).to.be.equal('CommitteeMethodSet')
      expect(logs[1].args._method).to.be.equal(
        web3.utils.padRight(methodSelector2, 64)
      )
      expect(logs[1].args._isAllowed).to.be.equal(true)

      isAllowed = await collectionManagerContract.allowedCommitteeMethods(
        methodSelector1
      )
      expect(isAllowed).to.be.equal(true)

      isAllowed = await collectionManagerContract.allowedCommitteeMethods(
        methodSelector2
      )
      expect(isAllowed).to.be.equal(true)

      res = await collectionManagerContract.setCommitteeMethods(
        [methodSelector2],
        [false],
        fromOwner
      )

      logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('CommitteeMethodSet')
      expect(logs[0].args._method).to.be.equal(
        web3.utils.padRight(methodSelector2, 64)
      )
      expect(logs[0].args._isAllowed).to.be.equal(false)

      isAllowed = await collectionManagerContract.allowedCommitteeMethods(
        methodSelector1
      )
      expect(isAllowed).to.be.equal(true)

      isAllowed = await collectionManagerContract.allowedCommitteeMethods(
        methodSelector2
      )
      expect(isAllowed).to.be.equal(false)
    })

    it('reverts when trying to set methods with invalid length', async function () {
      await assertRevert(
        collectionManagerContract.setCommitteeMethods(
          [methodSelector1],
          [true, false],
          fromOwner
        ),
        'CollectionManager#setCommitteeMethods: EMPTY_METHODS'
      )

      await assertRevert(
        collectionManagerContract.setCommitteeMethods(
          [methodSelector1, methodSelector2],
          [true],
          fromOwner
        ),
        'CollectionManager#setCommitteeMethods: EMPTY_METHODS'
      )

      await assertRevert(
        collectionManagerContract.setCommitteeMethods([], [], fromOwner),
        'CollectionManager#setCommitteeMethods: EMPTY_METHODS'
      )
    })

    it('reverts when trying to set a committee by hacker', async function () {
      await assertRevert(
        collectionManagerContract.setCommitteeMethods(
          [methodSelector2],
          [true],
          fromHacker
        ),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('setFeesCollector', async function () {
    it('should set feesCollector', async function () {
      let feesCollector = await collectionManagerContract.feesCollector()
      expect(feesCollector).to.be.equal(collector)

      let res = await collectionManagerContract.setFeesCollector(
        user,
        fromOwner
      )

      let logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('FeesCollectorSet')
      expect(logs[0].args._oldFeesCollector).to.be.equal(collector)
      expect(logs[0].args._newFeesCollector).to.be.equal(user)

      feesCollector = await collectionManagerContract.feesCollector()
      expect(feesCollector).to.be.equal(user)

      res = await collectionManagerContract.setFeesCollector(
        collector,
        fromOwner
      )

      logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('FeesCollectorSet')
      expect(logs[0].args._oldFeesCollector).to.be.equal(user)
      expect(logs[0].args._newFeesCollector).to.be.equal(collector)

      feesCollector = await collectionManagerContract.feesCollector()
      expect(feesCollector).to.be.equal(collector)
    })

    it('reverts when trying to set the ZERO_ADDRESS as the feesCollector', async function () {
      await assertRevert(
        collectionManagerContract.setFeesCollector(ZERO_ADDRESS, fromOwner),
        'CollectionManager#setFeesCollector: INVALID_FEES_COLLECTOR'
      )
    })

    it('reverts when trying to set a feesCollector by hacker', async function () {
      await assertRevert(
        collectionManagerContract.setFeesCollector(user, fromHacker),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('setRarities', async function () {
    it('should set rarities', async function () {
      let rarities = await collectionManagerContract.rarities()
      expect(rarities).to.be.equal(raritiesContract.address)

      let res = await collectionManagerContract.setRarities(user, fromOwner)

      let logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('RaritiesSet')
      expect(logs[0].args._oldRarities).to.be.equal(raritiesContract.address)
      expect(logs[0].args._newRarities).to.be.equal(user)

      rarities = await collectionManagerContract.rarities()
      expect(rarities).to.be.equal(user)

      res = await collectionManagerContract.setRarities(
        raritiesContract.address,
        fromOwner
      )

      logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('RaritiesSet')
      expect(logs[0].args._oldRarities).to.be.equal(user)
      expect(logs[0].args._newRarities).to.be.equal(raritiesContract.address)

      rarities = await collectionManagerContract.rarities()
      expect(rarities).to.be.equal(raritiesContract.address)
    })

    it('reverts when trying to set the ZERO_ADDRESS as the rarities', async function () {
      await assertRevert(
        collectionManagerContract.setRarities(ZERO_ADDRESS, fromOwner),
        'CollectionManager#setRarities: INVALID_RARITIES'
      )
    })

    it('reverts when trying to set a rarities by hacker', async function () {
      await assertRevert(
        collectionManagerContract.setRarities(user, fromHacker),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('createCollection', async function () {
    const name = 'collectionName'
    const symbol = 'collectionSymbol'
    const baseURI = 'collectionBaseURI'

    let collectionContract

    beforeEach(async () => {
      const rarities = getInitialRarities()

      await raritiesContract.updatePrices(
        getRarityNames(),
        Array(rarities.length).fill(0)
      )
    })

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

      expect(logs[0].address).to.not.be.equal(ZERO_ADDRESS)

      const name_ = await collectionContract.name()
      expect(name_).to.be.equal(name)

      const symbol_ = await collectionContract.symbol()
      expect(symbol_).to.be.equal(symbol)

      const baseURI_ = await collectionContract.baseURI()
      expect(baseURI_).to.be.equal(baseURI)

      const creator_ = await collectionContract.creator()
      expect(creator_).to.be.equal(user)

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

        expect(rarity).to.be.equal(ITEMS[i][0])
        expect(maxSupply).to.be.eq.BN(RARITIES[ITEMS[i][0]].value)
        expect(totalSupply).to.be.eq.BN(0)
        expect(price).to.be.eq.BN(ITEMS[i][1])
        expect(beneficiary.toLowerCase()).to.be.equal(ITEMS[i][2].toLowerCase())
        expect(metadata).to.be.equal(ITEMS[i][3])
        expect(contentHash).to.be.equal('')
      }
    })

    it('should create a collection :: Relayed EIP721', async function () {
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

        expect(rarity).to.be.equal(ITEMS[i][0])
        expect(maxSupply).to.be.eq.BN(RARITIES[ITEMS[i][0]].value)
        expect(totalSupply).to.be.eq.BN(0)
        expect(price).to.be.eq.BN(ITEMS[i][1])
        expect(beneficiary.toLowerCase()).to.be.equal(ITEMS[i][2].toLowerCase())
        expect(metadata).to.be.equal(ITEMS[i][3])
        expect(contentHash).to.be.equal('')
      }
    })

    it('should create a collection by paying the fees in acceptedToken', async function () {
      await raritiesContract.updatePrices(
        getRarityNames(),
        getRarityDefaulPrices()
      )

      const fee = web3.utils
        .toBN(DEFAULT_RARITY_PRICE)
        .mul(web3.utils.toBN(ITEMS.length))

      await manaContract.approve(
        collectionManagerContract.address,
        fee,
        fromUser
      )

      const creatorBalance = await balanceSnap(manaContract, user, 'creator')
      const feeCollectorBalance = await balanceSnap(
        manaContract,
        collector,
        'feeCollector'
      )

      const salt = web3.utils.randomHex(32)
      const { logs } = await collectionManagerContract.createCollection(
        forwarderContract.address,
        factoryContract.address,
        salt,
        name,
        symbol,
        baseURI,
        anotherUser,
        ITEMS,
        fromUser
      )
      collectionContract = await ERC721CollectionV2.at(logs[0].address)

      expect(logs[0].address).to.not.be.equal(ZERO_ADDRESS)

      const name_ = await collectionContract.name()
      expect(name_).to.be.equal(name)

      const symbol_ = await collectionContract.symbol()
      expect(symbol_).to.be.equal(symbol)

      const baseURI_ = await collectionContract.baseURI()
      expect(baseURI_).to.be.equal(baseURI)

      const creator_ = await collectionContract.creator()
      expect(creator_).to.be.equal(anotherUser)

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

        expect(rarity).to.be.equal(ITEMS[i][0])
        expect(maxSupply).to.be.eq.BN(RARITIES[ITEMS[i][0]].value)
        expect(totalSupply).to.be.eq.BN(0)
        expect(price).to.be.eq.BN(ITEMS[i][1])
        expect(beneficiary.toLowerCase()).to.be.equal(ITEMS[i][2].toLowerCase())
        expect(metadata).to.be.equal(ITEMS[i][3])
        expect(contentHash).to.be.equal('')
      }

      await creatorBalance.requireDecrease(fee)
      await feeCollectorBalance.requireIncrease(fee)
    })

    it('should create a collection by paying the fees in acceptedToken :: Relayed EIP721', async function () {
      await raritiesContract.updatePrices(
        getRarityNames(),
        getRarityDefaulPrices()
      )

      const fee = web3.utils
        .toBN(DEFAULT_RARITY_PRICE)
        .mul(web3.utils.toBN(ITEMS.length))

      await manaContract.approve(
        collectionManagerContract.address,
        fee,
        fromUser
      )

      const creatorBalance = await balanceSnap(manaContract, user, 'creator')
      const feeCollectorBalance = await balanceSnap(
        manaContract,
        collector,
        'feeCollector'
      )

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
          anotherUser,
          ITEMS,
        ]
      )

      const res = await sendMetaTx(
        collectionManagerContract,
        functionSignature,
        user,
        relayer,
        null,
        'Decentraland Collection Manager',
        '1'
      )

      console.log(
        `Deploy a collection with ${ITEMS.length} items -> Gas Used: ${res.receipt.gasUsed}`
      )
      const logs = res.logs

      collectionContract = await ERC721CollectionV2.at(logs[1].address)

      expect(logs[1].address).to.not.be.equal(ZERO_ADDRESS)

      const name_ = await collectionContract.name()
      expect(name_).to.be.equal(name)

      const symbol_ = await collectionContract.symbol()
      expect(symbol_).to.be.equal(symbol)

      const baseURI_ = await collectionContract.baseURI()
      expect(baseURI_).to.be.equal(baseURI)

      const creator_ = await collectionContract.creator()
      expect(creator_).to.be.equal(anotherUser)

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

        expect(rarity).to.be.equal(ITEMS[i][0])
        expect(maxSupply).to.be.eq.BN(RARITIES[ITEMS[i][0]].value)
        expect(totalSupply).to.be.eq.BN(0)
        expect(price).to.be.eq.BN(ITEMS[i][1])
        expect(beneficiary.toLowerCase()).to.be.equal(ITEMS[i][2].toLowerCase())
        expect(metadata).to.be.equal(ITEMS[i][3])
        expect(contentHash).to.be.equal('')
      }

      await creatorBalance.requireDecrease(fee)
      await feeCollectorBalance.requireIncrease(fee)
    })

    it('should create a collection by paying the fees in acceptedToken :: Relayed EIP721 :: Gas estimation', async function () {
      this.timeout(100000)
      await raritiesContract.updatePrices(
        getRarityNames(),
        getRarityDefaulPrices().map((_) => 1)
      )

      await manaContract.approve(
        collectionManagerContract.address,
        MAX_UINT256,
        fromUser
      )

      const itemsInTheSameTx = 55
      const items = []

      for (let i = 0; i < itemsInTheSameTx; i++) {
        items.push(ITEMS[i % ITEMS.length])
      }

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
          anotherUser,
          items,
        ]
      )

      const res = await sendMetaTx(
        collectionManagerContract,
        functionSignature,
        user,
        relayer,
        null,
        'Decentraland Collection Manager',
        '1'
      )

      console.log(
        `Deploy a collection with ${itemsInTheSameTx} items -> Gas Used: ${res.receipt.gasUsed}`
      )
    })

    it('reverts when creating a collection without paying the fees in acceptedToken', async function () {
      await raritiesContract.updatePrices(
        getRarityNames(),
        getRarityDefaulPrices()
      )

      const salt = web3.utils.randomHex(32)

      await assertRevert(
        collectionManagerContract.createCollection(
          forwarderContract.address,
          factoryContract.address,
          salt,
          name,
          symbol,
          baseURI,
          user,
          ITEMS,
          fromOwner
        )
      )

      await manaContract.approve(
        collectionManagerContract.address,
        web3.utils
          .toBN(DEFAULT_RARITY_PRICE)
          .mul(web3.utils.toBN(ITEMS.length))
          .sub(web3.utils.toBN(1)),
        fromUser
      )

      await assertRevert(
        collectionManagerContract.createCollection(
          forwarderContract.address,
          factoryContract.address,
          salt,
          name,
          symbol,
          baseURI,
          user,
          ITEMS,
          fromOwner
        )
      )
    })

    it('reverts when forwarder is the contract', async function () {
      const salt = web3.utils.randomHex(32)
      await assertRevert(
        collectionManagerContract.createCollection(
          collectionManagerContract.address,
          factoryContract.address,
          salt,
          name,
          symbol,
          baseURI,
          anotherUser,
          ITEMS,
          fromUser
        ),
        'CollectionManager#createCollection: FORWARDER_CANT_BE_THIS'
      )
    })
  })

  describe('manageCollection', async function () {
    const name = 'collectionName'
    const symbol = 'collectionSymbol'
    const baseURI = 'collectionBaseURI'

    let collectionContract

    beforeEach(async () => {
      const rarities = getInitialRarities()

      await raritiesContract.updatePrices(
        getRarityNames(),
        Array(rarities.length).fill(0)
      )

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
        fromOwner
      )
      collectionContract = await ERC721CollectionV2.at(logs[0].address)

      await collectionManagerContract.setCommittee(user, fromOwner)
    })

    it('should manage a collection', async function () {
      let isApproved = await collectionContract.isApproved()
      expect(isApproved).to.be.equal(false)

      // Approve collection
      await collectionManagerContract.manageCollection(
        forwarderContract.address,
        collectionContract.address,
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
        fromUser
      )

      isApproved = await collectionContract.isApproved()
      expect(isApproved).to.be.equal(true)

      // Approve collection
      await collectionManagerContract.manageCollection(
        forwarderContract.address,
        collectionContract.address,
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
          [false]
        ),
        fromUser
      )

      isApproved = await collectionContract.isApproved()
      expect(isApproved).to.be.equal(false)

      // Rescue collection
      const hash = web3.utils.randomHex(32)
      const metadata = 'saraza'
      await collectionManagerContract.manageCollection(
        forwarderContract.address,
        collectionContract.address,
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
          [[0], [hash], [metadata]]
        ),
        fromUser
      )

      const item = await collectionContract.items(0)
      expect([item.metadata, item.contentHash]).to.be.eql([metadata, hash])

      await collectionManagerContract.manageCollection(
        forwarderContract.address,
        collectionContract.address,
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
        fromUser
      )

      const isEditable = await collectionContract.isEditable()
      expect(isEditable).to.be.equal(false)
    })

    it('should manage a collection :: Relayed EIP721', async function () {
      let isApproved = await collectionContract.isApproved()
      expect(isApproved).to.be.equal(false)

      // Approve collection
      let functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'contract IForwarder',
              name: '_forwarder',
              type: 'address',
            },
            {
              internalType: 'address',
              name: '_collection',
              type: 'address',
            },
            {
              internalType: 'bytes',
              name: '_data',
              type: 'bytes',
            },
          ],
          name: 'manageCollection',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [
          forwarderContract.address,
          collectionContract.address,
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
        ]
      )

      await sendMetaTx(
        collectionManagerContract,
        functionSignature,
        user,
        relayer,
        null,
        'Decentraland Collection Manager',
        '1'
      )

      isApproved = await collectionContract.isApproved()
      expect(isApproved).to.be.equal(true)

      // Reject collection
      functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'contract IForwarder',
              name: '_forwarder',
              type: 'address',
            },
            {
              internalType: 'address',
              name: '_collection',
              type: 'address',
            },
            {
              internalType: 'bytes',
              name: '_data',
              type: 'bytes',
            },
          ],
          name: 'manageCollection',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [
          forwarderContract.address,
          collectionContract.address,
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
            [false]
          ),
        ]
      )

      await sendMetaTx(
        collectionManagerContract,
        functionSignature,
        user,
        relayer,
        null,
        'Decentraland Collection Manager',
        '1'
      )

      isApproved = await collectionContract.isApproved()
      expect(isApproved).to.be.equal(false)
    })

    it('reverts when trying to manage not a collection', async function () {
      await assertRevert(
        collectionManagerContract.manageCollection(
          forwarderContract.address,
          collectionManagerContract.address,
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
          fromUser
        ),
        'CollectionManager#manageCollection: INVALID_COLLECTION'
      )
    })

    it('reverts when trying to manage a collection by not the committee', async function () {
      await assertRevert(
        collectionManagerContract.manageCollection(
          forwarderContract.address,
          collectionContract.address,
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
          fromHacker
        ),
        'CollectionManager#manageCollection: UNAUTHORIZED_SENDER'
      )

      await assertRevert(
        collectionManagerContract.manageCollection(
          forwarderContract.address,
          collectionContract.address,
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
          fromOwner
        ),
        'CollectionManager#manageCollection: UNAUTHORIZED_SENDER'
      )
    })

    it('reverts when forwarder is the contract', async function () {
      await assertRevert(
        collectionManagerContract.manageCollection(
          collectionManagerContract.address,
          collectionContract.address,
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
          fromUser
        ),
        'CollectionManager#manageCollection: FORWARDER_CANT_BE_THIS'
      )
    })

    it('reverts when forwarder is the contract', async function () {
      await assertRevert(
        collectionManagerContract.manageCollection(
          forwarderContract.address,
          collectionContract.address,
          web3.eth.abi.encodeFunctionCall(
            {
              inputs: [
                {
                  internalType: 'bool',
                  name: '_value',
                  type: 'bool',
                },
              ],
              name: 'transferOwnership',
              outputs: [],
              stateMutability: 'nonpayable',
              type: 'function',
            },
            [true]
          ),
          fromUser
        ),
        'CollectionManager#manageCollection: COMMITTEE_METHOD_NOT_ALLOWED'
      )
    })
  })
})
