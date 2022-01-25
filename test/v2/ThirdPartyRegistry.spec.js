import hr from 'hardhat'
import { Mana } from 'decentraland-contract-plugins'

import assertRevert from '../helpers/assertRevert'
import { balanceSnap } from '../helpers/balanceSnap'
import { THIRD_PARTY_ITEMS, ZERO_ADDRESS } from '../helpers/collectionV2'
import { sendMetaTx } from '../helpers/metaTx'

const Committee = artifacts.require('Committee')
const ThirdPartyRegistry = artifacts.require('ThirdPartyRegistry')
const ChainlinkOracle = artifacts.require('ChainlinkOracle')
const InvalidOracle = artifacts.require('DummyInvalidOracle')
const DummyAggregatorV3Interface = artifacts.require(
  'DummyAggregatorV3Interface'
)

const BN = web3.utils.BN
const toBN = web3.utils.toBN
const expect = require('chai').use(require('bn-chai')(BN)).expect
const domain = 'Decentraland Third Party Registry'
const version = '1'
const initialValueForThirdParties = true
const initialValueForItems = false
const oneEther = toBN(web3.utils.toWei('1'))

const contentHashes = [
  'QmbpvfgQt2dFCYurW4tKjea2yaDZ9XCaVCTDJ5oxTYT8Zv',
  'QmbpvfgQt2dFCYurW4tKjea2yaDZ9XCaVCTDJ5oxTYT8Zd',
  'QmbpvfgQt2dFCYurW4tKjea2yaDZ9XCaVCTDJ5oxTYT8Ze',
]
let THIRD_PARTIES
let thirdParty1
let thirdParty2

const getPrice = (slots) => oneEther.mul(toBN((slots / 2).toString()))

const slotsToAddOrBuy = 10
const priceOfSlotsToBuy = getPrice(slotsToAddOrBuy)

describe('ThirdPartyRegistry', function () {
  this.timeout(100000)
  // mana
  let mana
  // Accounts
  let accounts
  let deployer
  let user
  let manager
  let anotherManager
  let committeeMember
  let thirdPartyAgregator
  let collector
  let hacker
  let relayer
  let owner
  let creator
  let fromUser
  let fromManager
  let fromAnotherManager
  let fromHacker
  let fromDeployer
  let fromRelayer
  let fromOwner
  let fromCommitteeMember
  let fromThirdPartyAgregator

  // Contracts
  let committeeContract
  let manaContract
  let thirdPartyRegistryContract
  let chainlinkOracleContract
  let dataFeedContract

  async function createMANA() {
    if (!manaContract) {
      mana = new Mana({ accounts, artifacts: hr.artifacts })
      await mana.deploy({
        txParams: {
          ...fromOwner,
          gas: 9e6,
          gasPrice: 21e9,
        },
      })
      manaContract = mana.getContract()
    }
  }

  beforeEach(async function () {
    // Create Listing environment
    accounts = await web3.eth.getAccounts()
    deployer = accounts[0]
    user = accounts[1]
    manager = accounts[2]
    hacker = accounts[3]
    relayer = accounts[4]
    committeeMember = accounts[5]
    collector = accounts[6]
    owner = accounts[7]
    anotherManager = accounts[8]
    thirdPartyAgregator = accounts[9]
    fromUser = { from: user }
    fromManager = { from: manager }
    fromHacker = { from: hacker }
    fromRelayer = { from: relayer }
    fromDeployer = { from: deployer }
    fromOwner = { from: owner }
    fromAnotherManager = { from: anotherManager }
    fromCommitteeMember = { from: committeeMember }
    fromThirdPartyAgregator = { from: thirdPartyAgregator }

    await createMANA()

    committeeContract = await Committee.new(
      owner,
      [committeeMember],
      fromDeployer
    )

    const dataFeedDecimals = 8
    const dataFeedAnswer = 2 * 10 ** dataFeedDecimals // 200000000

    dataFeedContract = await DummyAggregatorV3Interface.new(
      dataFeedDecimals,
      dataFeedAnswer
    )

    chainlinkOracleContract = await ChainlinkOracle.new(
      dataFeedContract.address,
      18
    )

    thirdPartyRegistryContract = await ThirdPartyRegistry.new(
      owner,
      thirdPartyAgregator,
      collector,
      committeeContract.address,
      manaContract.address,
      chainlinkOracleContract.address,
      oneEther,
      fromDeployer
    )

    thirdParty1 = [
      'urn:decentraland:matic:ext-thirdparty1',
      'tp:1:third party 1: the third party 1 desc',
      'https://api.thirdparty1.com/v1/',
      [manager],
      [],
    ]

    thirdParty2 = [
      'urn:decentraland:matic:ext-thirdparty2',
      'tp:1:third party 2: the third party 2 desc',
      'https://api.thirdparty2.com/v1/',
      [manager, anotherManager],
      [],
    ]

    THIRD_PARTIES = [thirdParty1, thirdParty2]
  })

  describe('initialize', function () {
    it('should be initialized with correct values', async function () {
      const contract = await ThirdPartyRegistry.new(
        owner,
        thirdPartyAgregator,
        collector,
        committeeContract.address,
        manaContract.address,
        chainlinkOracleContract.address,
        oneEther,
        fromDeployer
      )

      const contractOwner = await contract.owner()
      expect(contractOwner).to.be.equal(owner)

      const thirdPartyAgregatorContract = await contract.thirdPartyAgregator()
      expect(thirdPartyAgregatorContract).to.be.equal(thirdPartyAgregator)

      const feesCollector = await contract.feesCollector()
      expect(feesCollector).to.be.equal(collector)

      const committee = await contract.committee()
      expect(committee).to.be.equal(committeeContract.address)

      const mana = await contract.acceptedToken()
      expect(mana).to.be.equal(manaContract.address)

      const thirdPartiesCount = await contract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(0)

      const initialThirdPartyValue = await contract.initialThirdPartyValue()
      expect(initialThirdPartyValue).to.be.equal(initialValueForThirdParties)

      const initialItemValue = await contract.initialItemValue()
      expect(initialItemValue).to.be.equal(initialValueForItems)

      const oracle = await contract.oracle()
      expect(oracle).to.be.equal(chainlinkOracleContract.address)

      const itemSlotPrice = await contract.itemSlotPrice()
      expect(itemSlotPrice).to.be.eq.BN(oneEther)
    })
  })

  describe('setThirdPartyAgregator', async function () {
    it('should set thirdPartyAgregator', async function () {
      let thirdPartyAgregatorContract =
        await thirdPartyRegistryContract.thirdPartyAgregator()
      expect(thirdPartyAgregatorContract).to.be.equal(thirdPartyAgregator)

      let res = await thirdPartyRegistryContract.setThirdPartyAgregator(
        user,
        fromOwner
      )

      let logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('ThirdPartyAgregatorSet')
      expect(logs[0].args._oldThirdPartyAgregator).to.be.equal(
        thirdPartyAgregator
      )
      expect(logs[0].args._newThirdPartyAgregator).to.be.equal(user)

      thirdPartyAgregatorContract =
        await thirdPartyRegistryContract.thirdPartyAgregator()
      expect(thirdPartyAgregatorContract).to.be.equal(user)

      res = await thirdPartyRegistryContract.setThirdPartyAgregator(
        thirdPartyAgregator,
        fromOwner
      )

      logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('ThirdPartyAgregatorSet')
      expect(logs[0].args._oldThirdPartyAgregator).to.be.equal(user)
      expect(logs[0].args._newThirdPartyAgregator).to.be.equal(
        thirdPartyAgregator
      )

      thirdPartyAgregatorContract =
        await thirdPartyRegistryContract.thirdPartyAgregator()
      expect(thirdPartyAgregatorContract).to.be.equal(thirdPartyAgregator)
    })

    it('reverts when trying to set the ZERO_ADDRESS as the thirdPartyAgregator', async function () {
      await assertRevert(
        thirdPartyRegistryContract.setThirdPartyAgregator(
          ZERO_ADDRESS,
          fromOwner
        ),
        'TPR#setThirdPartyAgregator: INVALID_THIRD_PARTY_AGREGATOR'
      )
    })

    it('reverts when trying to set a thirdPartyAgregator by hacker', async function () {
      await assertRevert(
        thirdPartyRegistryContract.setThirdPartyAgregator(user, fromHacker),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('setFeesCollector', async function () {
    it('should set feesCollector', async function () {
      let feesCollector = await thirdPartyRegistryContract.feesCollector()
      expect(feesCollector).to.be.equal(collector)

      let res = await thirdPartyRegistryContract.setFeesCollector(
        user,
        fromOwner
      )

      let logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('FeesCollectorSet')
      expect(logs[0].args._oldFeesCollector).to.be.equal(collector)
      expect(logs[0].args._newFeesCollector).to.be.equal(user)

      feesCollector = await thirdPartyRegistryContract.feesCollector()
      expect(feesCollector).to.be.equal(user)

      res = await thirdPartyRegistryContract.setFeesCollector(
        collector,
        fromOwner
      )

      logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('FeesCollectorSet')
      expect(logs[0].args._oldFeesCollector).to.be.equal(user)
      expect(logs[0].args._newFeesCollector).to.be.equal(collector)

      feesCollector = await thirdPartyRegistryContract.feesCollector()
      expect(feesCollector).to.be.equal(collector)
    })

    it('reverts when trying to set the ZERO_ADDRESS as the feesCollector', async function () {
      await assertRevert(
        thirdPartyRegistryContract.setFeesCollector(ZERO_ADDRESS, fromOwner),
        'TPR#setFeesCollector: INVALID_FEES_COLLECTOR'
      )
    })

    it('reverts when trying to set a feesCollector by hacker', async function () {
      await assertRevert(
        thirdPartyRegistryContract.setFeesCollector(user, fromHacker),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('setAcceptedToken', async function () {
    it('should set acceptedToken', async function () {
      let acceptedToken = await thirdPartyRegistryContract.acceptedToken()
      expect(acceptedToken).to.be.equal(manaContract.address)

      let res = await thirdPartyRegistryContract.setAcceptedToken(
        user,
        fromOwner
      )

      let logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('AcceptedTokenSet')
      expect(logs[0].args._oldAcceptedToken).to.be.equal(manaContract.address)
      expect(logs[0].args._newAcceptedToken).to.be.equal(user)

      acceptedToken = await thirdPartyRegistryContract.acceptedToken()
      expect(acceptedToken).to.be.equal(user)

      res = await thirdPartyRegistryContract.setAcceptedToken(
        manaContract.address,
        fromOwner
      )

      logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('AcceptedTokenSet')
      expect(logs[0].args._oldAcceptedToken).to.be.equal(user)
      expect(logs[0].args._newAcceptedToken).to.be.equal(manaContract.address)

      acceptedToken = await thirdPartyRegistryContract.acceptedToken()
      expect(acceptedToken).to.be.equal(manaContract.address)
    })

    it('reverts when trying to set the ZERO_ADDRESS as the acceptedToken', async function () {
      await assertRevert(
        thirdPartyRegistryContract.setAcceptedToken(ZERO_ADDRESS, fromOwner),
        'TPR#setAcceptedToken: INVALID_ACCEPTED_TOKEN'
      )
    })

    it('reverts when trying to set a acceptedToken by hacker', async function () {
      await assertRevert(
        thirdPartyRegistryContract.setAcceptedToken(user, fromHacker),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('setCommittee', async function () {
    it('should set committee', async function () {
      let committee = await thirdPartyRegistryContract.committee()
      expect(committee).to.be.equal(committeeContract.address)

      let res = await thirdPartyRegistryContract.setCommittee(user, fromOwner)

      let logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('CommitteeSet')
      expect(logs[0].args._oldCommittee).to.be.equal(committeeContract.address)
      expect(logs[0].args._newCommittee).to.be.equal(user)

      committee = await thirdPartyRegistryContract.committee()
      expect(committee).to.be.equal(user)

      res = await thirdPartyRegistryContract.setCommittee(
        committeeContract.address,
        fromOwner
      )

      logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('CommitteeSet')
      expect(logs[0].args._oldCommittee).to.be.equal(user)
      expect(logs[0].args._newCommittee).to.be.equal(committeeContract.address)

      committee = await thirdPartyRegistryContract.committee()
      expect(committee).to.be.equal(committeeContract.address)
    })

    it('reverts when trying to set the ZERO_ADDRESS as the committee', async function () {
      await assertRevert(
        thirdPartyRegistryContract.setCommittee(ZERO_ADDRESS, fromOwner),
        'TPR#setCommittee: INVALID_COMMITTEE'
      )
    })

    it('reverts when trying to set a committee by hacker', async function () {
      await assertRevert(
        thirdPartyRegistryContract.setCommittee(user, fromHacker),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('setInitialThirdPartyValue', async function () {
    it('should set initial value for third parties', async function () {
      let initialValue =
        await thirdPartyRegistryContract.initialThirdPartyValue()
      expect(initialValue).to.be.equal(initialValueForThirdParties)

      let res = await thirdPartyRegistryContract.setInitialThirdPartyValue(
        !initialValueForThirdParties,
        fromOwner
      )

      let logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('InitialThirdPartyValueSet')
      expect(logs[0].args._oldInitialThirdPartyValue).to.be.equal(
        initialValueForThirdParties
      )
      expect(logs[0].args._newInitialThirdPartyValue).to.be.equal(
        !initialValueForThirdParties
      )

      initialValue = await thirdPartyRegistryContract.initialThirdPartyValue()
      expect(initialValue).to.be.equal(!initialValueForThirdParties)

      res = await thirdPartyRegistryContract.setInitialThirdPartyValue(
        initialValueForThirdParties,
        fromOwner
      )

      logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('InitialThirdPartyValueSet')
      expect(logs[0].args._oldInitialThirdPartyValue).to.be.equal(
        !initialValueForThirdParties
      )
      expect(logs[0].args._newInitialThirdPartyValue).to.be.equal(
        initialValueForThirdParties
      )

      initialValue = await thirdPartyRegistryContract.initialThirdPartyValue()
      expect(initialValue).to.be.equal(initialValueForThirdParties)
    })

    it('reverts when trying to set the initial third party value by hacker', async function () {
      await assertRevert(
        thirdPartyRegistryContract.setInitialThirdPartyValue(false, fromHacker),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('setInitialItemValue', async function () {
    it('should set initial value for items', async function () {
      let initialValue = await thirdPartyRegistryContract.initialItemValue()
      expect(initialValue).to.be.equal(initialValueForItems)

      let res = await thirdPartyRegistryContract.setInitialItemValue(
        !initialValueForItems,
        fromOwner
      )

      let logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('InitialItemValueSet')
      expect(logs[0].args._oldInitialItemValue).to.be.equal(
        initialValueForItems
      )
      expect(logs[0].args._newInitialItemValue).to.be.equal(
        !initialValueForItems
      )

      initialValue = await thirdPartyRegistryContract.initialItemValue()
      expect(initialValue).to.be.equal(!initialValueForItems)

      res = await thirdPartyRegistryContract.setInitialItemValue(
        initialValueForItems,
        fromOwner
      )

      logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('InitialItemValueSet')
      expect(logs[0].args._oldInitialItemValue).to.be.equal(
        !initialValueForItems
      )
      expect(logs[0].args._newInitialItemValue).to.be.equal(
        initialValueForItems
      )

      initialValue = await thirdPartyRegistryContract.initialItemValue()
      expect(initialValue).to.be.equal(initialValueForItems)
    })

    it('reverts when trying to set the initial item value by hacker', async function () {
      await assertRevert(
        thirdPartyRegistryContract.setInitialItemValue(false, fromHacker),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('addThirdParties', function () {
    it('should add third parties', async function () {
      let thirdPartiesCount =
        await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(0)

      const { logs } = await thirdPartyRegistryContract.addThirdParties(
        [thirdParty1, thirdParty2],
        fromThirdPartyAgregator
      )

      expect(logs.length).to.be.equal(2)

      expect(logs[0].event).to.be.equal('ThirdPartyAdded')
      expect(logs[0].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[0].args._metadata).to.be.eql(thirdParty1[1])
      expect(logs[0].args._resolver).to.be.eql(thirdParty1[2])
      expect(logs[0].args._isApproved).to.be.eql(initialValueForThirdParties)
      expect(logs[0].args._managers).to.be.eql(thirdParty1[3])
      expect(logs[0].args._caller).to.be.eql(thirdPartyAgregator)

      expect(logs[1].event).to.be.equal('ThirdPartyAdded')
      expect(logs[1].args._thirdPartyId).to.be.eql(thirdParty2[0])
      expect(logs[1].args._metadata).to.be.eql(thirdParty2[1])
      expect(logs[1].args._resolver).to.be.eql(thirdParty2[2])
      expect(logs[1].args._isApproved).to.be.eql(initialValueForThirdParties)
      expect(logs[1].args._managers).to.be.eql(thirdParty2[3])
      expect(logs[1].args._caller).to.be.eql(thirdPartyAgregator)

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      // Third Party 1
      let thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(0)
      expect(thirdParty.registered).to.be.eq.BN(1)

      for (let i = 0; i < thirdParty1[3].length; i++) {
        const isManager = await thirdPartyRegistryContract.isThirdPartyManager(
          thirdPartyId,
          thirdParty1[3][i]
        )
        expect(isManager).to.be.equal(true)
      }

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(0)

      // Third Party 2
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(1)
      expect(thirdPartyId).to.be.eql(thirdParty2[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty2[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty2[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty2[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(0)
      expect(thirdParty.registered).to.be.eq.BN(1)

      for (let i = 0; i < thirdParty2[3].length; i++) {
        const isManager = await thirdPartyRegistryContract.isThirdPartyManager(
          thirdPartyId,
          thirdParty2[3][i]
        )
        expect(isManager).to.be.equal(true)
      }

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty2[0])
      expect(itemsCount).to.be.eq.BN(0)
    })

    it('should add third parties :: Relayed EIP721', async function () {
      let thirdPartiesCount =
        await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(0)

      const functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              components: [
                {
                  internalType: 'string',
                  name: 'id',
                  type: 'string',
                },
                {
                  internalType: 'string',
                  name: 'metadata',
                  type: 'string',
                },
                {
                  internalType: 'string',
                  name: 'resolver',
                  type: 'string',
                },
                {
                  internalType: 'address[]',
                  name: 'managers',
                  type: 'address[]',
                },
                {
                  internalType: 'bool[]',
                  name: 'managerValues',
                  type: 'bool[]',
                },
              ],
              internalType: 'struct ThirdPartyRegistry.ThirdPartyParam[]',
              name: '_thirdParties',
              type: 'tuple[]',
            },
          ],
          name: 'addThirdParties',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [[thirdParty1, thirdParty2]]
      )

      const { logs } = await sendMetaTx(
        thirdPartyRegistryContract,
        functionSignature,
        thirdPartyAgregator,
        relayer,
        null,
        domain,
        version
      )

      expect(logs.length).to.be.equal(3)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(thirdPartyAgregator)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      expect(logs[1].event).to.be.equal('ThirdPartyAdded')
      expect(logs[1].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[1].args._metadata).to.be.eql(thirdParty1[1])
      expect(logs[1].args._resolver).to.be.eql(thirdParty1[2])
      expect(logs[1].args._isApproved).to.be.eql(initialValueForThirdParties)
      expect(logs[1].args._managers).to.be.eql(thirdParty1[3])
      expect(logs[1].args._caller).to.be.eql(thirdPartyAgregator)

      expect(logs[2].event).to.be.equal('ThirdPartyAdded')
      expect(logs[2].args._thirdPartyId).to.be.eql(thirdParty2[0])
      expect(logs[2].args._metadata).to.be.eql(thirdParty2[1])
      expect(logs[2].args._resolver).to.be.eql(thirdParty2[2])
      expect(logs[2].args._isApproved).to.be.eql(initialValueForThirdParties)
      expect(logs[2].args._managers).to.be.eql(thirdParty2[3])
      expect(logs[2].args._caller).to.be.eql(thirdPartyAgregator)

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      // Third Party 1
      let thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(0)
      expect(thirdParty.registered).to.be.eq.BN(1)

      for (let i = 0; i < thirdParty1[3].length; i++) {
        const isManager = await thirdPartyRegistryContract.isThirdPartyManager(
          thirdPartyId,
          thirdParty1[3][i]
        )
        expect(isManager).to.be.equal(true)
      }

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(0)

      // Third Party 2
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(1)
      expect(thirdPartyId).to.be.eql(thirdParty2[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty2[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty2[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty2[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(0)
      expect(thirdParty.registered).to.be.eq.BN(1)

      for (let i = 0; i < thirdParty2[3].length; i++) {
        const isManager = await thirdPartyRegistryContract.isThirdPartyManager(
          thirdPartyId,
          thirdParty2[3][i]
        )
        expect(isManager).to.be.equal(true)
      }

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty2[0])
      expect(itemsCount).to.be.eq.BN(0)
    })

    it('reverts when trying to add third parties without id', async function () {
      const thirdPartyToBeAdded = [
        '',
        'tp:1:third party 1: the third party 1 desc',
        'https://api.thirdparty1.com/v1/',
        [manager],
        [],
      ]

      await assertRevert(
        thirdPartyRegistryContract.addThirdParties(
          [thirdPartyToBeAdded],
          fromThirdPartyAgregator
        ),
        'TPR#addThirdParties: EMPTY_ID'
      )
    })

    it('reverts when trying to add third parties without metadata', async function () {
      const thirdPartyToBeAdded = [
        'urn:decentraland:matic:ext-thirdparty1',
        '',
        'https://api.thirdparty1.com/v1/',
        [manager],
        [],
      ]

      await assertRevert(
        thirdPartyRegistryContract.addThirdParties(
          [thirdPartyToBeAdded],
          fromThirdPartyAgregator
        ),
        'TPR#addThirdParties: EMPTY_METADATA'
      )
    })

    it('reverts when trying to add third parties without resolver', async function () {
      const thirdPartyToBeAdded = [
        'urn:decentraland:matic:ext-thirdparty1',
        'tp:1:third party 1: the third party 1 desc',
        '',
        [manager],
        [],
      ]

      await assertRevert(
        thirdPartyRegistryContract.addThirdParties(
          [thirdPartyToBeAdded],
          fromThirdPartyAgregator
        ),
        'TPR#addThirdParties: EMPTY_RESOLVER'
      )
    })

    it('reverts when trying to add third parties without managers', async function () {
      const thirdPartyToBeAdded = [
        'urn:decentraland:matic:ext-thirdparty1',
        'tp:1:third party 1: the third party 1 desc',
        'https://api.thirdparty1.com/v1/',
        [],
        [],
      ]

      await assertRevert(
        thirdPartyRegistryContract.addThirdParties(
          [thirdPartyToBeAdded],
          fromThirdPartyAgregator
        ),
        'TPR#addThirdParties: EMPTY_MANAGERS'
      )
    })

    it('reverts when trying to repeat an id for a third parties', async function () {
      const thirdPartyToBeAdded1 = [
        'urn:decentraland:matic:ext-thirdparty1',
        'tp:1:third party 1: the third party 1 desc',
        'https://api.thirdparty1.com/v1/',
        [manager],
        [],
      ]

      const thirdPartyToBeAdded2 = [
        'urn:decentraland:matic:ext-thirdparty1',
        'tp:1:third party 2: the third party 2 desc',
        'https://api.thirdparty2.com/v1/',
        [manager],
        [],
      ]

      await thirdPartyRegistryContract.addThirdParties(
        [thirdPartyToBeAdded1],
        fromThirdPartyAgregator
      )

      await assertRevert(
        thirdPartyRegistryContract.addThirdParties(
          [thirdPartyToBeAdded2],
          fromThirdPartyAgregator
        ),
        'TPR#addThirdParties: THIRD_PARTY_ALREADY_ADDED'
      )
    })

    it('reverts when trying to add a third party by hacker', async function () {
      await assertRevert(
        thirdPartyRegistryContract.addThirdParties([thirdParty1], fromHacker),
        'TPR#onlyThirdPartyAgregator: CALLER_IS_NOT_THE_PARTY_AGREGATOR'
      )

      const functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              components: [
                {
                  internalType: 'string',
                  name: 'id',
                  type: 'string',
                },
                {
                  internalType: 'string',
                  name: 'metadata',
                  type: 'string',
                },
                {
                  internalType: 'string',
                  name: 'resolver',
                  type: 'string',
                },
                {
                  internalType: 'address[]',
                  name: 'managers',
                  type: 'address[]',
                },
                {
                  internalType: 'bool[]',
                  name: 'managerValues',
                  type: 'bool[]',
                },
              ],
              internalType: 'struct ThirdPartyRegistry.ThirdPartyParam[]',
              name: '_thirdParties',
              type: 'tuple[]',
            },
          ],
          name: 'addThirdParties',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [[thirdParty1]]
      )

      await assertRevert(
        sendMetaTx(
          thirdPartyRegistryContract,
          functionSignature,
          hacker,
          relayer,
          null,
          domain,
          version
        ),
        'NMT#executeMetaTransaction: CALL_FAILED'
      )
    })
  })

  describe('setOracle', function () {
    it('should set the oracle', async function () {
      let oracle
      let response
      let logs

      oracle = await thirdPartyRegistryContract.oracle()
      expect(oracle).to.be.equal(chainlinkOracleContract.address)

      response = await thirdPartyRegistryContract.setOracle(user, fromOwner)

      logs = response.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('OracleSet')
      expect(logs[0].args._oldOracle).to.be.equal(oracle)
      expect(logs[0].args._newOracle).to.be.equal(user)

      response = await thirdPartyRegistryContract.setOracle(oracle, fromOwner)

      logs = response.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('OracleSet')
      expect(logs[0].args._oldOracle).to.be.equal(user)
      expect(logs[0].args._newOracle).to.be.equal(oracle)

      oracle = await thirdPartyRegistryContract.oracle()
      expect(oracle).to.be.equal(chainlinkOracleContract.address)
    })

    it('reverts when trying to set the ZERO_ADDRESS as the oracle', async function () {
      await assertRevert(
        thirdPartyRegistryContract.setOracle(ZERO_ADDRESS, fromOwner),
        'TPR#setOracle: INVALID_ORACLE'
      )
    })

    it('reverts when trying to set a acceptedToken by hacker', async function () {
      await assertRevert(
        thirdPartyRegistryContract.setOracle(user, fromHacker),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('setItemSlotPrice', function () {
    it('should set the price of the slots', async function () {
      const twoEther = oneEther.mul(toBN('2'))

      let itemSlotPrice
      let response
      let logs

      itemSlotPrice = await thirdPartyRegistryContract.itemSlotPrice()
      expect(itemSlotPrice).to.be.eq.BN(oneEther)

      response = await thirdPartyRegistryContract.setItemSlotPrice(
        twoEther,
        fromOwner
      )

      logs = response.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('ItemSlotPriceSet')
      expect(logs[0].args._oldItemSlotPrice).to.be.eq.BN(oneEther)
      expect(logs[0].args._newItemSlotPrice).to.be.eq.BN(twoEther)

      itemSlotPrice = await thirdPartyRegistryContract.itemSlotPrice()
      expect(itemSlotPrice).to.be.eq.BN(twoEther)

      response = await thirdPartyRegistryContract.setItemSlotPrice(
        oneEther,
        fromOwner
      )

      logs = response.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('ItemSlotPriceSet')
      expect(logs[0].args._oldItemSlotPrice).to.be.eq.BN(twoEther)
      expect(logs[0].args._newItemSlotPrice).to.be.eq.BN(oneEther)

      itemSlotPrice = await thirdPartyRegistryContract.itemSlotPrice()
      expect(itemSlotPrice).to.be.eq.BN(oneEther)
    })

    it('reverts when trying to set a acceptedToken by hacker', async function () {
      await assertRevert(
        thirdPartyRegistryContract.setItemSlotPrice(oneEther, fromHacker),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('updateThirdParties', function () {
    let updatedThirdParty1
    let updatedThirdParty2
    beforeEach(async () => {
      await thirdPartyRegistryContract.addThirdParties(
        [thirdParty1, thirdParty2],
        fromThirdPartyAgregator
      )

      updatedThirdParty1 = [
        thirdParty1[0],
        'tp:1:updated third party 1: the third party 1 updated desc',
        'https://api.thirdparty1.com/v2/',
        [anotherManager],
        [true],
      ]

      updatedThirdParty2 = [
        thirdParty2[0],
        'tp:1:updated third party 2: the third party 2 desc updated',
        'https://api.thirdparty2.com/v2/',
        [],
        [],
      ]
    })

    it('should update third parties by a manager', async function () {
      let thirdPartiesCount =
        await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      const { logs } = await thirdPartyRegistryContract.updateThirdParties(
        [updatedThirdParty1, updatedThirdParty2],
        fromManager
      )

      expect(logs.length).to.be.equal(2)

      expect(logs[0].event).to.be.equal('ThirdPartyUpdated')
      expect(logs[0].args._thirdPartyId).to.be.eql(updatedThirdParty1[0])
      expect(logs[0].args._metadata).to.be.eql(updatedThirdParty1[1])
      expect(logs[0].args._resolver).to.be.eql(updatedThirdParty1[2])
      expect(logs[0].args._managers).to.be.eql(updatedThirdParty1[3])
      expect(logs[0].args._managerValues).to.be.eql(updatedThirdParty1[4])
      expect(logs[0].args._caller).to.be.eql(manager)

      expect(logs[1].event).to.be.equal('ThirdPartyUpdated')
      expect(logs[1].args._thirdPartyId).to.be.eql(updatedThirdParty2[0])
      expect(logs[1].args._metadata).to.be.eql(updatedThirdParty2[1])
      expect(logs[1].args._resolver).to.be.eql(updatedThirdParty2[2])
      expect(logs[1].args._managers).to.be.eql(updatedThirdParty2[3])
      expect(logs[1].args._managerValues).to.be.eql(updatedThirdParty2[4])
      expect(logs[1].args._caller).to.be.eql(manager)

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      // Third Party 1
      let thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(updatedThirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(updatedThirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(0)
      expect(thirdParty.registered).to.be.eq.BN(1)

      let isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        manager
      )
      expect(isManager).to.be.equal(true)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        anotherManager
      )
      expect(isManager).to.be.equal(true)

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(0)

      // Third Party 2
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(1)
      expect(thirdPartyId).to.be.eql(thirdParty2[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty2[0])

      expect(thirdParty.metadata).to.be.eql(updatedThirdParty2[1])
      expect(thirdParty.resolver).to.be.eql(updatedThirdParty2[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(0)
      expect(thirdParty.registered).to.be.eq.BN(1)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty2[0],
        manager
      )
      expect(isManager).to.be.equal(true)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty2[0],
        anotherManager
      )
      expect(isManager).to.be.equal(true)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty2[0])
      expect(itemsCount).to.be.eq.BN(0)
    })

    it('should update third parties by a committee member', async function () {
      let thirdPartiesCount =
        await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      const { logs } = await thirdPartyRegistryContract.updateThirdParties(
        [updatedThirdParty1, updatedThirdParty2],
        fromThirdPartyAgregator
      )

      expect(logs.length).to.be.equal(2)

      expect(logs[0].event).to.be.equal('ThirdPartyUpdated')
      expect(logs[0].args._thirdPartyId).to.be.eql(updatedThirdParty1[0])
      expect(logs[0].args._metadata).to.be.eql(updatedThirdParty1[1])
      expect(logs[0].args._resolver).to.be.eql(updatedThirdParty1[2])
      expect(logs[0].args._managers).to.be.eql(updatedThirdParty1[3])
      expect(logs[0].args._managerValues).to.be.eql(updatedThirdParty1[4])
      expect(logs[0].args._caller).to.be.eql(thirdPartyAgregator)

      expect(logs[1].event).to.be.equal('ThirdPartyUpdated')
      expect(logs[1].args._thirdPartyId).to.be.eql(updatedThirdParty2[0])
      expect(logs[1].args._metadata).to.be.eql(updatedThirdParty2[1])
      expect(logs[1].args._resolver).to.be.eql(updatedThirdParty2[2])
      expect(logs[1].args._managers).to.be.eql(updatedThirdParty2[3])
      expect(logs[1].args._managerValues).to.be.eql(updatedThirdParty2[4])
      expect(logs[1].args._caller).to.be.eql(thirdPartyAgregator)

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      // Third Party 1
      let thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(updatedThirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(updatedThirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(0)
      expect(thirdParty.registered).to.be.eq.BN(1)

      let isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        manager
      )
      expect(isManager).to.be.equal(true)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        anotherManager
      )
      expect(isManager).to.be.equal(true)

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(0)

      // Third Party 2
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(1)
      expect(thirdPartyId).to.be.eql(thirdParty2[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty2[0])

      expect(thirdParty.metadata).to.be.eql(updatedThirdParty2[1])
      expect(thirdParty.resolver).to.be.eql(updatedThirdParty2[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(0)
      expect(thirdParty.registered).to.be.eq.BN(1)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty2[0],
        manager
      )
      expect(isManager).to.be.equal(true)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty2[0],
        anotherManager
      )
      expect(isManager).to.be.equal(true)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty2[0])
      expect(itemsCount).to.be.eq.BN(0)
    })

    it('should update third parties :: Relayed EIP721', async function () {
      let thirdPartiesCount =
        await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      const functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              components: [
                {
                  internalType: 'string',
                  name: 'id',
                  type: 'string',
                },
                {
                  internalType: 'string',
                  name: 'metadata',
                  type: 'string',
                },
                {
                  internalType: 'string',
                  name: 'resolver',
                  type: 'string',
                },
                {
                  internalType: 'address[]',
                  name: 'managers',
                  type: 'address[]',
                },
                {
                  internalType: 'bool[]',
                  name: 'managerValues',
                  type: 'bool[]',
                },
              ],
              internalType: 'struct ThirdPartyRegistry.ThirdPartyParam[]',
              name: '_thirdParties',
              type: 'tuple[]',
            },
          ],
          name: 'updateThirdParties',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [[updatedThirdParty1, updatedThirdParty2]]
      )

      const { logs } = await sendMetaTx(
        thirdPartyRegistryContract,
        functionSignature,
        manager,
        relayer,
        null,
        domain,
        version
      )

      expect(logs.length).to.be.equal(3)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(manager)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      expect(logs[1].event).to.be.equal('ThirdPartyUpdated')
      expect(logs[1].args._thirdPartyId).to.be.eql(updatedThirdParty1[0])
      expect(logs[1].args._metadata).to.be.eql(updatedThirdParty1[1])
      expect(logs[1].args._resolver).to.be.eql(updatedThirdParty1[2])
      expect(logs[1].args._managers).to.be.eql(updatedThirdParty1[3])
      expect(logs[1].args._managerValues).to.be.eql(updatedThirdParty1[4])
      expect(logs[1].args._caller).to.be.eql(manager)

      expect(logs[2].event).to.be.equal('ThirdPartyUpdated')
      expect(logs[2].args._thirdPartyId).to.be.eql(updatedThirdParty2[0])
      expect(logs[2].args._metadata).to.be.eql(updatedThirdParty2[1])
      expect(logs[2].args._resolver).to.be.eql(updatedThirdParty2[2])
      expect(logs[2].args._managers).to.be.eql(updatedThirdParty2[3])
      expect(logs[2].args._managerValues).to.be.eql(updatedThirdParty2[4])
      expect(logs[2].args._caller).to.be.eql(manager)

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      // Third Party 1
      let thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(updatedThirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(updatedThirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(0)
      expect(thirdParty.registered).to.be.eq.BN(1)

      let isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        manager
      )
      expect(isManager).to.be.equal(true)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        anotherManager
      )
      expect(isManager).to.be.equal(true)

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(0)

      // Third Party 2
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(1)
      expect(thirdPartyId).to.be.eql(thirdParty2[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty2[0])

      expect(thirdParty.metadata).to.be.eql(updatedThirdParty2[1])
      expect(thirdParty.resolver).to.be.eql(updatedThirdParty2[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(0)
      expect(thirdParty.registered).to.be.eq.BN(1)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty2[0],
        manager
      )
      expect(isManager).to.be.equal(true)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty2[0],
        anotherManager
      )
      expect(isManager).to.be.equal(true)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty2[0])
      expect(itemsCount).to.be.eq.BN(0)
    })

    it('should update third parties :: metadata', async function () {
      updatedThirdParty1 = [
        thirdParty1[0],
        'tp:1:updated third party 1: the third party 1 updated desc',
        '',
        [],
        [],
      ]

      let thirdPartiesCount =
        await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      const { logs } = await thirdPartyRegistryContract.updateThirdParties(
        [updatedThirdParty1],
        fromThirdPartyAgregator
      )

      expect(logs.length).to.be.equal(1)

      expect(logs[0].event).to.be.equal('ThirdPartyUpdated')
      expect(logs[0].args._thirdPartyId).to.be.eql(updatedThirdParty1[0])
      expect(logs[0].args._metadata).to.be.eql(updatedThirdParty1[1])
      expect(logs[0].args._resolver).to.be.eql(thirdParty1[2])
      expect(logs[0].args._managers).to.be.eql(updatedThirdParty1[3])
      expect(logs[0].args._managerValues).to.be.eql(updatedThirdParty1[4])
      expect(logs[0].args._caller).to.be.eql(thirdPartyAgregator)

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      // Third Party 1
      let thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(updatedThirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(0)
      expect(thirdParty.registered).to.be.eq.BN(1)

      let isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        manager
      )
      expect(isManager).to.be.equal(true)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        anotherManager
      )
      expect(isManager).to.be.equal(false)

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(0)
    })

    it('should update third parties :: resolver', async function () {
      updatedThirdParty1 = [
        thirdParty1[0],
        '',
        'https://api.thirdparty1.com/v2/',
        [],
        [],
      ]

      let thirdPartiesCount =
        await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      const { logs } = await thirdPartyRegistryContract.updateThirdParties(
        [updatedThirdParty1],
        fromThirdPartyAgregator
      )

      expect(logs.length).to.be.equal(1)

      expect(logs[0].event).to.be.equal('ThirdPartyUpdated')
      expect(logs[0].args._thirdPartyId).to.be.eql(updatedThirdParty1[0])
      expect(logs[0].args._metadata).to.be.eql(thirdParty1[1])
      expect(logs[0].args._resolver).to.be.eql(updatedThirdParty1[2])
      expect(logs[0].args._managers).to.be.eql(updatedThirdParty1[3])
      expect(logs[0].args._managerValues).to.be.eql(updatedThirdParty1[4])
      expect(logs[0].args._caller).to.be.eql(thirdPartyAgregator)

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      // Third Party 1
      let thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(updatedThirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(0)
      expect(thirdParty.registered).to.be.eq.BN(1)

      let isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        manager
      )
      expect(isManager).to.be.equal(true)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        anotherManager
      )
      expect(isManager).to.be.equal(false)

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(0)
    })

    it('should update third parties :: managers', async function () {
      updatedThirdParty1 = [thirdParty1[0], '', '', [anotherManager], [true]]

      let thirdPartiesCount =
        await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      const { logs } = await thirdPartyRegistryContract.updateThirdParties(
        [updatedThirdParty1],
        fromThirdPartyAgregator
      )

      expect(logs.length).to.be.equal(1)

      expect(logs[0].event).to.be.equal('ThirdPartyUpdated')
      expect(logs[0].args._thirdPartyId).to.be.eql(updatedThirdParty1[0])
      expect(logs[0].args._metadata).to.be.eql(thirdParty1[1])
      expect(logs[0].args._resolver).to.be.eql(thirdParty1[2])
      expect(logs[0].args._managers).to.be.eql(updatedThirdParty1[3])
      expect(logs[0].args._managerValues).to.be.eql(updatedThirdParty1[4])
      expect(logs[0].args._caller).to.be.eql(thirdPartyAgregator)

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      // Third Party 1
      let thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(0)
      expect(thirdParty.registered).to.be.eq.BN(1)

      let isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        manager
      )
      expect(isManager).to.be.equal(true)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        anotherManager
      )
      expect(isManager).to.be.equal(true)

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(0)
    })

    it('should empty third parties managers by committee member', async function () {
      updatedThirdParty1 = [thirdParty1[0], '', '', [manager], [false]]

      let thirdPartiesCount =
        await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      const { logs } = await thirdPartyRegistryContract.updateThirdParties(
        [updatedThirdParty1],
        fromThirdPartyAgregator
      )

      expect(logs.length).to.be.equal(1)

      expect(logs[0].event).to.be.equal('ThirdPartyUpdated')
      expect(logs[0].args._thirdPartyId).to.be.eql(updatedThirdParty1[0])
      expect(logs[0].args._metadata).to.be.eql(thirdParty1[1])
      expect(logs[0].args._resolver).to.be.eql(thirdParty1[2])
      expect(logs[0].args._managers).to.be.eql(updatedThirdParty1[3])
      expect(logs[0].args._managerValues).to.be.eql(updatedThirdParty1[4])
      expect(logs[0].args._caller).to.be.eql(thirdPartyAgregator)

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      // Third Party 1
      let thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(0)
      expect(thirdParty.registered).to.be.eq.BN(1)

      let isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        manager
      )
      expect(isManager).to.be.equal(false)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        anotherManager
      )
      expect(isManager).to.be.equal(false)

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(0)
    })

    it('reverts when trying to update third parties without id', async function () {
      const thirdPartyToBeUpdated = [
        '',
        'tp:1:third party 1: the third party 1 desc',
        'https://api.thirdparty1.com/v1/',
        [manager],
        [true],
      ]

      await assertRevert(
        thirdPartyRegistryContract.updateThirdParties(
          [thirdPartyToBeUpdated],
          fromManager
        ),
        'TPR#updateThirdParties: EMPTY_ID'
      )
    })

    it('reverts when manager mismatch', async function () {
      const thirdPartyToBeUpdated = [
        thirdParty1[0],
        'tp:1:third party 1: the third party 1 desc',
        'https://api.thirdparty1.com/v1/',
        [manager],
        [],
      ]

      await assertRevert(
        thirdPartyRegistryContract.updateThirdParties(
          [thirdPartyToBeUpdated],
          fromManager
        ),
        'TPR#updateThirdParties: LENGTH_MISMATCH'
      )
    })

    it('reverts when a manager tries to be self-removed', async function () {
      const thirdPartyToBeUpdated = [
        thirdParty1[0],
        'tp:1:third party 1: the third party 1 desc',
        'https://api.thirdparty1.com/v1/',
        [manager],
        [false],
      ]

      await assertRevert(
        thirdPartyRegistryContract.updateThirdParties(
          [thirdPartyToBeUpdated],
          fromManager
        ),
        'TPR#updateThirdParties: MANAGER_CANT_SELF_REMOVE'
      )
    })

    it('reverts when trying to update a third party by hacker', async function () {
      await assertRevert(
        thirdPartyRegistryContract.updateThirdParties(
          [updatedThirdParty1],
          fromHacker
        ),
        'TPR#updateThirdParties: CALLER_IS_NOT_MANAGER_OR_THIRD_PARTY_AGREGATOR'
      )

      const functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              components: [
                {
                  internalType: 'string',
                  name: 'id',
                  type: 'string',
                },
                {
                  internalType: 'string',
                  name: 'metadata',
                  type: 'string',
                },
                {
                  internalType: 'string',
                  name: 'resolver',
                  type: 'string',
                },
                {
                  internalType: 'address[]',
                  name: 'managers',
                  type: 'address[]',
                },
                {
                  internalType: 'bool[]',
                  name: 'managerValues',
                  type: 'bool[]',
                },
              ],
              internalType: 'struct ThirdPartyRegistry.ThirdPartyParam[]',
              name: '_thirdParties',
              type: 'tuple[]',
            },
          ],
          name: 'updateThirdParties',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [[updatedThirdParty1, updatedThirdParty2]]
      )

      await assertRevert(
        sendMetaTx(
          thirdPartyRegistryContract,
          functionSignature,
          hacker,
          relayer,
          null,
          domain,
          version
        ),
        'NMT#executeMetaTransaction: CALL_FAILED'
      )
    })
  })

  describe('buyItemSlots', function () {
    beforeEach(async () => {
      await thirdPartyRegistryContract.addThirdParties(
        [thirdParty1, thirdParty2],
        fromThirdPartyAgregator
      )
    })

    it('should buy item slots by paying in acceptedToken', async function () {
      let thirdPartiesCount
      let totalManaPaid
      let response
      let logs
      let thirdPartyId
      let thirdParty
      let maxItemsExpected
      let isManager
      let itemsCount

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      await manaContract.approve(
        thirdPartyRegistryContract.address,
        priceOfSlotsToBuy,
        fromUser
      )

      const slotsBuyer = await balanceSnap(manaContract, user, 'creator')

      const feeCollectorBalance = await balanceSnap(
        manaContract,
        collector,
        'feeCollector'
      )

      response = await thirdPartyRegistryContract.buyItemSlots(
        thirdParty1[0],
        slotsToAddOrBuy,
        priceOfSlotsToBuy,
        fromUser
      )

      logs = response.logs

      expect(logs.length).to.be.equal(1)

      expect(logs[0].event).to.be.equal('ThirdPartyItemSlotsBought')
      expect(logs[0].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[0].args._price).to.be.eq.BN(priceOfSlotsToBuy)
      expect(logs[0].args._value).to.be.eq.BN(slotsToAddOrBuy)
      expect(logs[0].args._caller).to.be.eql(user)

      totalManaPaid = priceOfSlotsToBuy

      await slotsBuyer.requireDecrease(totalManaPaid)
      await feeCollectorBalance.requireIncrease(totalManaPaid)

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      // Third Party 1
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])

      maxItemsExpected = slotsToAddOrBuy

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(maxItemsExpected)
      expect(thirdParty.registered).to.be.eq.BN(1)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        manager
      )
      expect(isManager).to.be.equal(true)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty1[0])
      expect(itemsCount).to.be.eq.BN(0)

      await manaContract.approve(
        thirdPartyRegistryContract.address,
        priceOfSlotsToBuy,
        fromUser
      )

      response = await thirdPartyRegistryContract.buyItemSlots(
        thirdParty1[0],
        slotsToAddOrBuy,
        priceOfSlotsToBuy,
        fromUser
      )

      logs = response.logs

      expect(logs.length).to.be.equal(1)

      expect(logs[0].event).to.be.equal('ThirdPartyItemSlotsBought')
      expect(logs[0].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[0].args._price).to.be.eq.BN(priceOfSlotsToBuy)
      expect(logs[0].args._value).to.be.eq.BN(slotsToAddOrBuy)
      expect(logs[0].args._caller).to.be.eql(user)

      totalManaPaid = totalManaPaid.add(priceOfSlotsToBuy)

      await slotsBuyer.requireDecrease(totalManaPaid)
      await feeCollectorBalance.requireIncrease(totalManaPaid)

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      // Third Party 1
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])

      maxItemsExpected += slotsToAddOrBuy

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(maxItemsExpected)
      expect(thirdParty.registered).to.be.eq.BN(1)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        manager
      )
      expect(isManager).to.be.equal(true)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty1[0])
      expect(itemsCount).to.be.eq.BN(0)
    })

    it('should buy item slots by paying in acceptedToken :: Relayed EIP721', async function () {
      let thirdPartiesCount
      let totalManaPaid
      let functionSignature
      let response
      let logs
      let thirdPartyId
      let thirdParty
      let maxItemsExpected
      let isManager
      let itemsCount

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      await manaContract.approve(
        thirdPartyRegistryContract.address,
        priceOfSlotsToBuy,
        fromUser
      )

      const slotsBuyer = await balanceSnap(manaContract, user, 'creator')

      const feeCollectorBalance = await balanceSnap(
        manaContract,
        collector,
        'feeCollector'
      )

      functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'string',
              name: '_thirdPartyId',
              type: 'string',
            },
            {
              internalType: 'uint256',
              name: '_qty',
              type: 'uint256',
            },
            {
              internalType: 'uint256',
              name: '_maxPrice',
              type: 'uint256',
            },
          ],
          name: 'buyItemSlots',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [thirdParty1[0], slotsToAddOrBuy, priceOfSlotsToBuy]
      )

      response = await sendMetaTx(
        thirdPartyRegistryContract,
        functionSignature,
        user,
        relayer,
        null,
        domain,
        version
      )

      logs = response.logs

      expect(logs.length).to.be.equal(2)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(user)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      expect(logs[1].event).to.be.equal('ThirdPartyItemSlotsBought')
      expect(logs[1].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[1].args._price).to.be.eq.BN(priceOfSlotsToBuy)
      expect(logs[1].args._value).to.be.eq.BN(slotsToAddOrBuy)
      expect(logs[1].args._caller).to.be.eql(user)

      totalManaPaid = priceOfSlotsToBuy

      await slotsBuyer.requireDecrease(totalManaPaid)
      await feeCollectorBalance.requireIncrease(totalManaPaid)

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      // Third Party 1
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])

      maxItemsExpected = slotsToAddOrBuy

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(maxItemsExpected)
      expect(thirdParty.registered).to.be.eq.BN(1)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        manager
      )
      expect(isManager).to.be.equal(true)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty1[0])
      expect(itemsCount).to.be.eq.BN(0)

      await manaContract.approve(
        thirdPartyRegistryContract.address,
        priceOfSlotsToBuy,
        fromUser
      )

      functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'string',
              name: '_thirdPartyId',
              type: 'string',
            },
            {
              internalType: 'uint256',
              name: '_qty',
              type: 'uint256',
            },
            {
              internalType: 'uint256',
              name: '_maxPrice',
              type: 'uint256',
            },
          ],
          name: 'buyItemSlots',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [thirdParty1[0], slotsToAddOrBuy, priceOfSlotsToBuy]
      )

      response = await sendMetaTx(
        thirdPartyRegistryContract,
        functionSignature,
        user,
        relayer,
        null,
        domain,
        version
      )

      logs = response.logs

      expect(logs.length).to.be.equal(2)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(user)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      expect(logs[1].event).to.be.equal('ThirdPartyItemSlotsBought')
      expect(logs[1].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[1].args._price).to.be.eq.BN(priceOfSlotsToBuy)
      expect(logs[1].args._value).to.be.eq.BN(slotsToAddOrBuy)
      expect(logs[1].args._caller).to.be.eql(user)

      totalManaPaid = totalManaPaid.add(priceOfSlotsToBuy)

      await slotsBuyer.requireDecrease(totalManaPaid)
      await feeCollectorBalance.requireIncrease(totalManaPaid)

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      // Third Party 1
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])

      maxItemsExpected += slotsToAddOrBuy

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(maxItemsExpected)
      expect(thirdParty.registered).to.be.eq.BN(1)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        manager
      )
      expect(isManager).to.be.equal(true)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty1[0])
      expect(itemsCount).to.be.eq.BN(0)
    })

    it('should only transfer the price calculated by the rate and not the max price', async function () {
      const maxPrice = priceOfSlotsToBuy.mul(toBN('2')) // twice the amount required for the slots

      await manaContract.approve(
        thirdPartyRegistryContract.address,
        maxPrice,
        fromUser
      )

      const buyer = await balanceSnap(manaContract, user, 'creator')

      const feeCollector = await balanceSnap(
        manaContract,
        collector,
        'feeCollector'
      )

      await thirdPartyRegistryContract.buyItemSlots(
        thirdParty1[0],
        slotsToAddOrBuy,
        maxPrice,
        fromUser
      )

      // Only the required amount is transfered, meaning half the max price provided
      await buyer.requireDecrease(priceOfSlotsToBuy)
      await feeCollector.requireIncrease(priceOfSlotsToBuy)
    })

    it('reverts when the third party is invalid', async function () {
      await assertRevert(
        thirdPartyRegistryContract.buyItemSlots(
          thirdParty1[0] + 'a',
          slotsToAddOrBuy,
          priceOfSlotsToBuy,
          fromUser
        ),
        'TPR#_checkThirdParty: INVALID_THIRD_PARTY'
      )
    })

    it('reverts when trying to buy item slots without approving accepted token', async function () {
      await assertRevert(
        thirdPartyRegistryContract.buyItemSlots(
          thirdParty1[0],
          slotsToAddOrBuy,
          priceOfSlotsToBuy,
          fromUser
        )
      )
    })

    it('reverts when the sender has not balance', async function () {
      await manaContract.approve(
        thirdPartyRegistryContract.address,
        priceOfSlotsToBuy,
        fromUser
      )

      const balance = await manaContract.balanceOf(user)
      await manaContract.transfer(hacker, balance, fromUser)

      await assertRevert(
        thirdPartyRegistryContract.buyItemSlots(
          thirdParty1[0],
          slotsToAddOrBuy,
          priceOfSlotsToBuy,
          fromUser
        )
      )
    })

    it('reverts when the max price provided is 0', async function () {
      await assertRevert(
        thirdPartyRegistryContract.buyItemSlots(
          thirdParty1[0],
          slotsToAddOrBuy,
          toBN(0),
          fromUser
        ),
        'TPR#buyItems: PRICE_HIGHER_THAN_MAX_PRICE'
      )
    })

    it('reverts when the max price provided is 1 wei less than required', async function () {
      await assertRevert(
        thirdPartyRegistryContract.buyItemSlots(
          thirdParty1[0],
          slotsToAddOrBuy,
          priceOfSlotsToBuy.sub(toBN('1')),
          fromUser
        ),
        'TPR#buyItems: PRICE_HIGHER_THAN_MAX_PRICE'
      )
    })

    it('reverts when oracle.getRate attempts to change the state', async function () {
      const oracleContract = await InvalidOracle.new()

      thirdPartyRegistryContract = await ThirdPartyRegistry.new(
        owner,
        thirdPartyAgregator,
        collector,
        committeeContract.address,
        manaContract.address,
        oracleContract.address,
        oneEther,
        fromDeployer
      )

      await thirdPartyRegistryContract.addThirdParties(
        [thirdParty1],
        fromThirdPartyAgregator
      )

      await assertRevert(
        thirdPartyRegistryContract.buyItemSlots(
          thirdParty1[0],
          slotsToAddOrBuy,
          priceOfSlotsToBuy,
          fromUser
        ),
        'TPR#_getRateFromOracle: INVALID_RATE_FROM_ORACLE'
      )
    })
  })

  describe('addItemSlots', function () {
    beforeEach(async () => {
      await thirdPartyRegistryContract.addThirdParties(
        [thirdParty1, thirdParty2],
        fromThirdPartyAgregator
      )
    })

    it('should add item slots to a third party', async function () {
      let thirdPartiesCount
      let response
      let logs
      let thirdPartyId
      let thirdParty
      let maxItemsExpected

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      response = await thirdPartyRegistryContract.addItemSlots(
        thirdParty1[0],
        slotsToAddOrBuy,
        fromThirdPartyAgregator
      )

      logs = response.logs

      expect(logs.length).to.be.equal(1)

      expect(logs[0].event).to.be.equal('ThirdPartyItemSlotsAdded')
      expect(logs[0].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[0].args._value).to.be.eq.BN(slotsToAddOrBuy)
      expect(logs[0].args._caller).to.be.eql(thirdPartyAgregator)

      // Third Party 1
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])

      maxItemsExpected = slotsToAddOrBuy

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(maxItemsExpected)
      expect(thirdParty.registered).to.be.eq.BN(1)

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      response = await thirdPartyRegistryContract.addItemSlots(
        thirdParty1[0],
        slotsToAddOrBuy,
        fromThirdPartyAgregator
      )

      logs = response.logs

      expect(logs.length).to.be.equal(1)

      expect(logs[0].event).to.be.equal('ThirdPartyItemSlotsAdded')
      expect(logs[0].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[0].args._value).to.be.eq.BN(slotsToAddOrBuy)
      expect(logs[0].args._caller).to.be.eql(thirdPartyAgregator)

      // Third Party 1
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])

      maxItemsExpected += slotsToAddOrBuy

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(maxItemsExpected)
      expect(thirdParty.registered).to.be.eq.BN(1)
    })

    it('should add item slots to a third party :: Relayed EIP721', async function () {
      let thirdPartiesCount
      let functionSignature
      let response
      let logs
      let thirdPartyId
      let thirdParty
      let maxItemsExpected

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'string',
              name: '_thirdPartyId',
              type: 'string',
            },
            {
              internalType: 'uint256',
              name: '_qty',
              type: 'uint256',
            },
          ],
          name: 'addItemSlots',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [thirdParty1[0], slotsToAddOrBuy]
      )

      response = await sendMetaTx(
        thirdPartyRegistryContract,
        functionSignature,
        thirdPartyAgregator,
        relayer,
        null,
        domain,
        version
      )

      logs = response.logs

      expect(logs.length).to.be.equal(2)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(thirdPartyAgregator)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      expect(logs[1].event).to.be.equal('ThirdPartyItemSlotsAdded')
      expect(logs[1].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[1].args._value).to.be.eq.BN(slotsToAddOrBuy)
      expect(logs[1].args._caller).to.be.eql(thirdPartyAgregator)

      // Third Party 1
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])

      maxItemsExpected = slotsToAddOrBuy

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(maxItemsExpected)
      expect(thirdParty.registered).to.be.eq.BN(1)

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'string',
              name: '_thirdPartyId',
              type: 'string',
            },
            {
              internalType: 'uint256',
              name: '_qty',
              type: 'uint256',
            },
          ],
          name: 'addItemSlots',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [thirdParty1[0], slotsToAddOrBuy]
      )

      response = await sendMetaTx(
        thirdPartyRegistryContract,
        functionSignature,
        thirdPartyAgregator,
        relayer,
        null,
        domain,
        version
      )

      logs = response.logs

      expect(logs.length).to.be.equal(2)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(thirdPartyAgregator)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      expect(logs[1].event).to.be.equal('ThirdPartyItemSlotsAdded')
      expect(logs[1].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[1].args._value).to.be.eq.BN(slotsToAddOrBuy)
      expect(logs[1].args._caller).to.be.eql(thirdPartyAgregator)

      // Third Party 1
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])

      maxItemsExpected += slotsToAddOrBuy

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(maxItemsExpected)
      expect(thirdParty.registered).to.be.eq.BN(1)
    })

    it('reverts when sender is not the third party aggregator', async function () {
      await assertRevert(
        thirdPartyRegistryContract.addItemSlots(
          thirdParty1[0],
          slotsToAddOrBuy,
          fromUser
        ),
        'TPR#onlyThirdPartyAgregator: CALLER_IS_NOT_THE_PARTY_AGREGATOR'
      )
    })

    it('reverts when the third party is invalid', async function () {
      await assertRevert(
        thirdPartyRegistryContract.addItemSlots(
          thirdParty1[0] + 'a',
          slotsToAddOrBuy,
          fromThirdPartyAgregator
        ),
        'TPR#_checkThirdParty: INVALID_THIRD_PARTY'
      )
    })
  })

  describe('addItems', function () {
    beforeEach(async () => {
      await thirdPartyRegistryContract.addThirdParties(
        [thirdParty1, thirdParty2],
        fromThirdPartyAgregator
      )

      await mana.setInitialBalances()

      // Buy 10 item slots
      await manaContract.approve(
        thirdPartyRegistryContract.address,
        priceOfSlotsToBuy,
        fromUser
      )
      await thirdPartyRegistryContract.buyItemSlots(
        thirdParty1[0],
        slotsToAddOrBuy,
        priceOfSlotsToBuy,
        fromUser
      )
    })

    it('should add items', async function () {
      // Third Party 1
      let thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(0)

      const { logs } = await thirdPartyRegistryContract.addItems(
        thirdParty1[0],
        [THIRD_PARTY_ITEMS[0], THIRD_PARTY_ITEMS[1]],
        fromManager
      )

      expect(logs.length).to.be.equal(2)

      expect(logs[0].event).to.be.equal('ItemAdded')
      expect(logs[0].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[0].args._itemId).to.be.eq.BN(THIRD_PARTY_ITEMS[0][0])
      expect(logs[0].args._metadata).to.be.eq.BN(THIRD_PARTY_ITEMS[0][1])
      expect(logs[0].args._value).to.be.eql(initialValueForItems)
      expect(logs[0].args._caller).to.be.eql(manager)

      expect(logs[1].event).to.be.equal('ItemAdded')
      expect(logs[1].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[1].args._itemId).to.be.eq.BN(THIRD_PARTY_ITEMS[1][0])
      expect(logs[1].args._metadata).to.be.eq.BN(THIRD_PARTY_ITEMS[1][1])
      expect(logs[1].args._value).to.be.eql(initialValueForItems)
      expect(logs[1].args._caller).to.be.eql(manager)

      // Third Party 1
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

      let isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        manager
      )
      expect(isManager).to.be.equal(true)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty1[0])
      expect(itemsCount).to.be.eq.BN(2)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty1[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty1[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
        expect(item.registered).to.be.eq.BN(1)
      }
    })

    it('should add items :: Relayed EIP721', async function () {
      // Third Party 1
      let thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(0)

      let functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'string',
              name: '_thirdPartyId',
              type: 'string',
            },
            {
              components: [
                {
                  internalType: 'string',
                  name: 'id',
                  type: 'string',
                },
                {
                  internalType: 'string',
                  name: 'metadata',
                  type: 'string',
                },
              ],
              internalType: 'struct ThirdPartyRegistry.ItemParam[]',
              name: '_items',
              type: 'tuple[]',
            },
          ],
          name: 'addItems',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [thirdParty1[0], [THIRD_PARTY_ITEMS[0], THIRD_PARTY_ITEMS[1]]]
      )

      const { logs } = await sendMetaTx(
        thirdPartyRegistryContract,
        functionSignature,
        manager,
        relayer,
        null,
        domain,
        version
      )

      expect(logs.length).to.be.equal(3)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(manager)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      expect(logs[1].event).to.be.equal('ItemAdded')
      expect(logs[1].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[1].args._itemId).to.be.eq.BN(THIRD_PARTY_ITEMS[0][0])
      expect(logs[1].args._metadata).to.be.eq.BN(THIRD_PARTY_ITEMS[0][1])
      expect(logs[1].args._value).to.be.eql(initialValueForItems)
      expect(logs[1].args._caller).to.be.eql(manager)

      expect(logs[2].event).to.be.equal('ItemAdded')
      expect(logs[2].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[2].args._itemId).to.be.eq.BN(THIRD_PARTY_ITEMS[1][0])
      expect(logs[2].args._metadata).to.be.eq.BN(THIRD_PARTY_ITEMS[1][1])
      expect(logs[2].args._value).to.be.eql(initialValueForItems)
      expect(logs[2].args._caller).to.be.eql(manager)

      // Third Party 1
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

      let isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        manager
      )
      expect(isManager).to.be.equal(true)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty1[0])
      expect(itemsCount).to.be.eq.BN(2)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty1[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty1[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
        expect(item.registered).to.be.eq.BN(1)
      }
    })

    it('should add the same item to another third party', async function () {
      // Buy 1000 item slots
      await manaContract.approve(
        thirdPartyRegistryContract.address,
        getPrice(1000),
        fromUser
      )
      await thirdPartyRegistryContract.buyItemSlots(
        thirdParty2[0],
        1000,
        getPrice(1000),
        fromUser
      )

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(0)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty2[0])
      expect(itemsCount).to.be.eq.BN(0)

      await thirdPartyRegistryContract.addItems(
        thirdParty1[0],
        [THIRD_PARTY_ITEMS[0], THIRD_PARTY_ITEMS[1]],
        fromManager
      )

      await thirdPartyRegistryContract.addItems(
        thirdParty2[0],
        [THIRD_PARTY_ITEMS[0], THIRD_PARTY_ITEMS[2]],
        fromManager
      )

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty1[0])
      expect(itemsCount).to.be.eq.BN(2)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty1[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty1[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
        expect(item.registered).to.be.eq.BN(1)
      }

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty2[0])
      expect(itemsCount).to.be.eq.BN(2)

      let itemId = await thirdPartyRegistryContract.itemIdByIndex(
        thirdParty2[0],
        0
      )
      let item = await thirdPartyRegistryContract.itemsById(
        thirdParty2[0],
        itemId
      )

      expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[0][1])
      expect(item.contentHash).to.be.eql('')
      expect(item.isApproved).to.be.eql(initialValueForItems)
      expect(item.registered).to.be.eq.BN(1)

      itemId = await thirdPartyRegistryContract.itemIdByIndex(thirdParty2[0], 1)
      item = await thirdPartyRegistryContract.itemsById(thirdParty2[0], itemId)

      expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[2][1])
      expect(item.contentHash).to.be.eql('')
      expect(item.isApproved).to.be.eql(initialValueForItems)
      expect(item.registered).to.be.eq.BN(1)
    })

    it('add 50 items :: gas estimation', async function () {
      // Buy 1000 item slots
      await manaContract.approve(
        thirdPartyRegistryContract.address,
        getPrice(50),
        fromUser
      )
      await thirdPartyRegistryContract.buyItemSlots(
        thirdParty1[0],
        50,
        getPrice(50),
        fromUser
      )

      const items = []
      for (let i = 0; i < 50; i++) {
        items.push([
          THIRD_PARTY_ITEMS[0][0] + i.toString(),
          THIRD_PARTY_ITEMS[0][1] + i.toString(),
        ])
      }

      const { receipt } = await thirdPartyRegistryContract.addItems(
        thirdParty1[0],
        items,
        fromManager
      )
      console.log(receipt.gasUsed)
    })

    it('reverts when trying to add an item by a hacker', async function () {
      await assertRevert(
        thirdPartyRegistryContract.addItems(
          thirdParty1[0],
          [THIRD_PARTY_ITEMS[0], THIRD_PARTY_ITEMS[1]],
          fromHacker
        ),
        'TPR#addItems: INVALID_SENDER'
      )
    })

    it('reverts when trying to add an item when there is no slots available', async function () {
      for (let i = 0; i < 10; i++) {
        await thirdPartyRegistryContract.addItems(
          thirdParty1[0],
          [[THIRD_PARTY_ITEMS[0][0] + i, THIRD_PARTY_ITEMS[0][1]]],
          fromManager
        )
      }

      await assertRevert(
        thirdPartyRegistryContract.addItems(
          thirdParty1[0],
          [THIRD_PARTY_ITEMS[0], THIRD_PARTY_ITEMS[1]],
          fromManager
        ),
        'TPR#addItems: NO_ITEM_SLOTS_AVAILABLE'
      )
    })

    it('reverts when trying to add an item whith empty id', async function () {
      await assertRevert(
        thirdPartyRegistryContract.addItems(
          thirdParty1[0],
          [['', THIRD_PARTY_ITEMS[0][1]]],
          fromManager
        ),
        'TPR#_checkItemParam: EMPTY_ID'
      )
    })

    it('reverts when trying to add an item whith empty metadata', async function () {
      await assertRevert(
        thirdPartyRegistryContract.addItems(
          thirdParty1[0],
          [[THIRD_PARTY_ITEMS[0][1], '']],
          fromManager
        ),
        'TPR#_checkItemParam: EMPTY_METADATA'
      )
    })

    it('reverts when trying to add an item already added', async function () {
      await assertRevert(
        thirdPartyRegistryContract.addItems(
          thirdParty1[0],
          [THIRD_PARTY_ITEMS[0], THIRD_PARTY_ITEMS[0]],
          fromManager
        ),
        'TPR#addItems: ITEM_ALREADY_ADDED'
      )

      await thirdPartyRegistryContract.addItems(
        thirdParty1[0],
        [THIRD_PARTY_ITEMS[0]],
        fromManager
      )

      await assertRevert(
        thirdPartyRegistryContract.addItems(
          thirdParty1[0],
          [THIRD_PARTY_ITEMS[0]],
          fromManager
        ),
        'TPR#addItems: ITEM_ALREADY_ADDED'
      )
    })
  })

  describe('updateItems', function () {
    let UPDATED_THIRD_PARTY_ITEMS
    beforeEach(async () => {
      await thirdPartyRegistryContract.addThirdParties(
        [thirdParty1, thirdParty2],
        fromThirdPartyAgregator
      )

      await mana.setInitialBalances()

      // Buy 10 item slots
      await manaContract.approve(
        thirdPartyRegistryContract.address,
        priceOfSlotsToBuy,
        fromUser
      )
      await thirdPartyRegistryContract.buyItemSlots(
        thirdParty1[0],
        slotsToAddOrBuy,
        priceOfSlotsToBuy,
        fromUser
      )

      await thirdPartyRegistryContract.addItems(
        thirdParty1[0],
        [THIRD_PARTY_ITEMS[0], THIRD_PARTY_ITEMS[1]],
        fromManager
      )

      UPDATED_THIRD_PARTY_ITEMS = [
        [THIRD_PARTY_ITEMS[0][0], THIRD_PARTY_ITEMS[0][1] + ' updated'],
        [THIRD_PARTY_ITEMS[1][0], THIRD_PARTY_ITEMS[1][1] + ' updated'],
      ]
    })

    it('should update items', async function () {
      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(2)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty1[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty1[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
        expect(item.registered).to.be.eq.BN(1)
      }

      const { logs } = await thirdPartyRegistryContract.updateItems(
        thirdParty1[0],
        [UPDATED_THIRD_PARTY_ITEMS[0], UPDATED_THIRD_PARTY_ITEMS[1]],
        fromManager
      )

      expect(logs.length).to.be.equal(2)

      expect(logs[0].event).to.be.equal('ItemUpdated')
      expect(logs[0].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[0].args._itemId).to.be.eq.BN(UPDATED_THIRD_PARTY_ITEMS[0][0])
      expect(logs[0].args._metadata).to.be.eq.BN(
        UPDATED_THIRD_PARTY_ITEMS[0][1]
      )
      expect(logs[0].args._caller).to.be.eql(manager)

      expect(logs[1].event).to.be.equal('ItemUpdated')
      expect(logs[1].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[1].args._itemId).to.be.eq.BN(UPDATED_THIRD_PARTY_ITEMS[1][0])
      expect(logs[1].args._metadata).to.be.eq.BN(
        UPDATED_THIRD_PARTY_ITEMS[1][1]
      )
      expect(logs[1].args._caller).to.be.eql(manager)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty1[0])
      expect(itemsCount).to.be.eq.BN(2)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty1[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty1[0],
          itemId
        )

        expect(item.metadata).to.be.eql(UPDATED_THIRD_PARTY_ITEMS[i][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
        expect(item.registered).to.be.eq.BN(1)
      }
    })

    it('should update items :: Relayed EIP721', async function () {
      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(2)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty1[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty1[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
        expect(item.registered).to.be.eq.BN(1)
      }

      let functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'string',
              name: '_thirdPartyId',
              type: 'string',
            },
            {
              components: [
                {
                  internalType: 'string',
                  name: 'id',
                  type: 'string',
                },
                {
                  internalType: 'string',
                  name: 'metadata',
                  type: 'string',
                },
              ],
              internalType: 'struct ThirdPartyRegistry.ItemParam[]',
              name: '_items',
              type: 'tuple[]',
            },
          ],
          name: 'updateItems',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [
          thirdParty1[0],
          [UPDATED_THIRD_PARTY_ITEMS[0], UPDATED_THIRD_PARTY_ITEMS[1]],
        ]
      )

      const { logs } = await sendMetaTx(
        thirdPartyRegistryContract,
        functionSignature,
        manager,
        relayer,
        null,
        domain,
        version
      )

      expect(logs.length).to.be.equal(3)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(manager)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      expect(logs[1].event).to.be.equal('ItemUpdated')
      expect(logs[1].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[1].args._itemId).to.be.eq.BN(UPDATED_THIRD_PARTY_ITEMS[0][0])
      expect(logs[1].args._metadata).to.be.eq.BN(
        UPDATED_THIRD_PARTY_ITEMS[0][1]
      )
      expect(logs[1].args._caller).to.be.eql(manager)

      expect(logs[2].event).to.be.equal('ItemUpdated')
      expect(logs[2].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[2].args._itemId).to.be.eq.BN(UPDATED_THIRD_PARTY_ITEMS[1][0])
      expect(logs[2].args._metadata).to.be.eq.BN(
        UPDATED_THIRD_PARTY_ITEMS[1][1]
      )
      expect(logs[2].args._caller).to.be.eql(manager)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty1[0])
      expect(itemsCount).to.be.eq.BN(2)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty1[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty1[0],
          itemId
        )

        expect(item.metadata).to.be.eql(UPDATED_THIRD_PARTY_ITEMS[i][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
        expect(item.registered).to.be.eq.BN(1)
      }
    })

    it('reverts when trying to update an item for an invalid third party', async function () {
      await assertRevert(
        thirdPartyRegistryContract.updateItems(
          thirdParty1[0] + 'a',
          [UPDATED_THIRD_PARTY_ITEMS[0], UPDATED_THIRD_PARTY_ITEMS[1]],
          fromHacker
        ),
        'TPR#updateItems: INVALID_SENDER'
      )
    })

    it('reverts when trying to update an item by a hacker', async function () {
      await assertRevert(
        thirdPartyRegistryContract.updateItems(
          thirdParty1[0],
          [UPDATED_THIRD_PARTY_ITEMS[0], UPDATED_THIRD_PARTY_ITEMS[1]],
          fromHacker
        ),
        'TPR#updateItems: INVALID_SENDER'
      )
    })

    it('reverts when trying to update an item with invalid id', async function () {
      await assertRevert(
        thirdPartyRegistryContract.updateItems(
          thirdParty1[0],
          [
            [
              UPDATED_THIRD_PARTY_ITEMS[0][0] + 'a',
              UPDATED_THIRD_PARTY_ITEMS[0][1],
            ],
          ],
          fromManager
        ),
        'TPR#_checkItem: INVALID_ITEM'
      )

      await assertRevert(
        thirdPartyRegistryContract.updateItems(
          thirdParty1[0],
          [['', UPDATED_THIRD_PARTY_ITEMS[0][1]]],
          fromManager
        ),
        'TPR#_checkItemParam: EMPTY_ID'
      )
    })

    it('reverts when trying to update an item with invalid metadata', async function () {
      await assertRevert(
        thirdPartyRegistryContract.updateItems(
          thirdParty1[0],
          [[UPDATED_THIRD_PARTY_ITEMS[0][0] + 'a', '']],
          fromManager
        ),
        'TPR#_checkItemParam: EMPTY_METADATA'
      )
    })

    it('reverts when trying to update an item already approved by a manager', async function () {
      await thirdPartyRegistryContract.reviewThirdParties(
        [
          [
            thirdParty1[0],
            true,
            [[...UPDATED_THIRD_PARTY_ITEMS[0], '0x12', true]],
          ],
        ],
        fromCommitteeMember
      )

      await assertRevert(
        thirdPartyRegistryContract.updateItems(
          thirdParty1[0],
          [UPDATED_THIRD_PARTY_ITEMS[0]],
          fromManager
        ),
        'TPR#updateItems: ITEM_IS_APPROVED'
      )
    })
  })

  describe('reviewThirdParties', function () {
    let UPDATED_THIRD_PARTY_ITEMS
    beforeEach(async () => {
      await thirdPartyRegistryContract.addThirdParties(
        [thirdParty1, thirdParty2],
        fromThirdPartyAgregator
      )

      await mana.setInitialBalances()

      // Buy 10 item slots
      await manaContract.approve(
        thirdPartyRegistryContract.address,
        priceOfSlotsToBuy,
        fromUser
      )
      await thirdPartyRegistryContract.buyItemSlots(
        thirdParty1[0],
        slotsToAddOrBuy,
        priceOfSlotsToBuy,
        fromUser
      )

      await thirdPartyRegistryContract.addItems(
        thirdParty1[0],
        [THIRD_PARTY_ITEMS[0], THIRD_PARTY_ITEMS[1]],
        fromManager
      )

      // Buy 10 item slots
      await manaContract.approve(
        thirdPartyRegistryContract.address,
        priceOfSlotsToBuy,
        fromUser
      )
      await thirdPartyRegistryContract.buyItemSlots(
        thirdParty2[0],
        slotsToAddOrBuy,
        priceOfSlotsToBuy,
        fromUser
      )

      await thirdPartyRegistryContract.addItems(
        thirdParty2[0],
        [THIRD_PARTY_ITEMS[2]],
        fromManager
      )

      UPDATED_THIRD_PARTY_ITEMS = [
        [THIRD_PARTY_ITEMS[0][0], THIRD_PARTY_ITEMS[0][1] + ' updated'],
        [THIRD_PARTY_ITEMS[1][0], THIRD_PARTY_ITEMS[1][1] + ' updated'],
      ]
    })

    it('should review third parties', async function () {
      // Third Party 1
      let thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(2)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty1[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty1[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
      }

      // Third Party 2
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(1)
      expect(thirdPartyId).to.be.eql(thirdParty2[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty2[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty2[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty2[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty2[0])
      expect(itemsCount).to.be.eq.BN(1)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty2[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty2[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i + 2][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
      }

      const { logs } = await thirdPartyRegistryContract.reviewThirdParties(
        [
          [thirdParty1[0], false, []],
          [thirdParty2[0], false, []],
        ],
        fromCommitteeMember
      )

      expect(logs.length).to.be.equal(2)

      expect(logs[0].event).to.be.equal('ThirdPartyReviewed')
      expect(logs[0].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[0].args._value).to.be.eql(false)
      expect(logs[0].args._caller).to.be.eql(committeeMember)

      expect(logs[1].event).to.be.equal('ThirdPartyReviewed')
      expect(logs[1].args._thirdPartyId).to.be.eql(thirdParty2[0])
      expect(logs[1].args._value).to.be.eql(false)
      expect(logs[1].args._caller).to.be.eql(committeeMember)

      // Third Party 1
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(false)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty1[0])
      expect(itemsCount).to.be.eq.BN(2)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty1[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty1[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
      }

      // Third Party 2
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(1)
      expect(thirdPartyId).to.be.eql(thirdParty2[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty2[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty2[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty2[2])
      expect(thirdParty.isApproved).to.be.eql(false)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty2[0])
      expect(itemsCount).to.be.eq.BN(1)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty2[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty2[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i + 2][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
      }
    })

    it('should review third parties :: Relayed EIP721', async function () {
      // Third Party 1
      let thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(2)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty1[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty1[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
      }

      // Third Party 2
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(1)
      expect(thirdPartyId).to.be.eql(thirdParty2[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty2[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty2[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty2[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty2[0])
      expect(itemsCount).to.be.eq.BN(1)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty2[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty2[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i + 2][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
      }

      let functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              components: [
                {
                  internalType: 'string',
                  name: 'id',
                  type: 'string',
                },
                {
                  internalType: 'bool',
                  name: 'value',
                  type: 'bool',
                },
                {
                  components: [
                    {
                      internalType: 'string',
                      name: 'id',
                      type: 'string',
                    },
                    {
                      internalType: 'string',
                      name: 'metadata',
                      type: 'string',
                    },
                    {
                      internalType: 'string',
                      name: 'contentHash',
                      type: 'string',
                    },
                    {
                      internalType: 'bool',
                      name: 'value',
                      type: 'bool',
                    },
                  ],
                  internalType: 'struct ThirdPartyRegistry.ItemReviewParam[]',
                  name: 'items',
                  type: 'tuple[]',
                },
              ],
              internalType: 'struct ThirdPartyRegistry.ThirdPartyReviewParam[]',
              name: '_thirdParties',
              type: 'tuple[]',
            },
          ],
          name: 'reviewThirdParties',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [
          [
            [thirdParty1[0], false, []],
            [thirdParty2[0], false, []],
          ],
        ]
      )

      const { logs } = await sendMetaTx(
        thirdPartyRegistryContract,
        functionSignature,
        committeeMember,
        relayer,
        null,
        domain,
        version
      )

      expect(logs.length).to.be.equal(3)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(committeeMember)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      expect(logs[1].event).to.be.equal('ThirdPartyReviewed')
      expect(logs[1].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[1].args._value).to.be.eql(false)
      expect(logs[1].args._caller).to.be.eql(committeeMember)

      expect(logs[2].event).to.be.equal('ThirdPartyReviewed')
      expect(logs[2].args._thirdPartyId).to.be.eql(thirdParty2[0])
      expect(logs[2].args._value).to.be.eql(false)
      expect(logs[2].args._caller).to.be.eql(committeeMember)

      // Third Party 1
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(false)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty1[0])
      expect(itemsCount).to.be.eq.BN(2)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty1[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty1[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
      }

      // Third Party 2
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(1)
      expect(thirdPartyId).to.be.eql(thirdParty2[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty2[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty2[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty2[2])
      expect(thirdParty.isApproved).to.be.eql(false)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty2[0])
      expect(itemsCount).to.be.eq.BN(1)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty2[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty2[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i + 2][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
      }
    })

    it('should review items', async function () {
      // Third Party 1
      let thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(2)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty1[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty1[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
        expect(item.registered).to.be.eq.BN(1)
      }

      // Third Party 2
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(1)
      expect(thirdPartyId).to.be.eql(thirdParty2[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty2[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty2[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty2[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty2[0])
      expect(itemsCount).to.be.eq.BN(1)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty2[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty2[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i + 2][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
        expect(item.registered).to.be.eq.BN(1)
      }

      const { logs } = await thirdPartyRegistryContract.reviewThirdParties(
        [
          [
            thirdParty1[0],
            true,
            [
              [...THIRD_PARTY_ITEMS[0], contentHashes[0], true],
              [...THIRD_PARTY_ITEMS[1], contentHashes[1], true],
            ],
          ],
          [
            thirdParty2[0],
            true,
            [[...THIRD_PARTY_ITEMS[2], contentHashes[2], true]],
          ],
        ],
        fromCommitteeMember
      )

      expect(logs.length).to.be.equal(5)

      expect(logs[0].event).to.be.equal('ThirdPartyReviewed')
      expect(logs[0].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[0].args._value).to.be.eql(true)
      expect(logs[0].args._caller).to.be.eql(committeeMember)

      expect(logs[1].event).to.be.equal('ItemReviewed')
      expect(logs[1].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[1].args._itemId).to.be.eql(THIRD_PARTY_ITEMS[0][0])
      expect(logs[1].args._metadata).to.be.eql(THIRD_PARTY_ITEMS[0][1])
      expect(logs[1].args._contentHash).to.be.eql(contentHashes[0])
      expect(logs[1].args._value).to.be.eql(true)
      expect(logs[1].args._caller).to.be.eql(committeeMember)

      expect(logs[2].event).to.be.equal('ItemReviewed')
      expect(logs[2].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[2].args._itemId).to.be.eql(THIRD_PARTY_ITEMS[1][0])
      expect(logs[2].args._metadata).to.be.eql(THIRD_PARTY_ITEMS[1][1])
      expect(logs[2].args._contentHash).to.be.eql(contentHashes[1])
      expect(logs[2].args._value).to.be.eql(true)
      expect(logs[2].args._caller).to.be.eql(committeeMember)

      expect(logs[3].event).to.be.equal('ThirdPartyReviewed')
      expect(logs[3].args._thirdPartyId).to.be.eql(thirdParty2[0])
      expect(logs[3].args._value).to.be.eql(true)
      expect(logs[3].args._caller).to.be.eql(committeeMember)

      expect(logs[4].event).to.be.equal('ItemReviewed')
      expect(logs[4].args._thirdPartyId).to.be.eql(thirdParty2[0])
      expect(logs[4].args._itemId).to.be.eql(THIRD_PARTY_ITEMS[2][0])
      expect(logs[4].args._metadata).to.be.eql(THIRD_PARTY_ITEMS[2][1])
      expect(logs[4].args._contentHash).to.be.eql(contentHashes[2])
      expect(logs[4].args._value).to.be.eql(true)
      expect(logs[4].args._caller).to.be.eql(committeeMember)

      // Third Party 1
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty1[0])
      expect(itemsCount).to.be.eq.BN(2)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty1[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty1[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i][1])
        expect(item.contentHash).to.be.eql(contentHashes[i])
        expect(item.isApproved).to.be.eql(true)
        expect(item.registered).to.be.eq.BN(1)
      }

      // Third Party 2
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(1)
      expect(thirdPartyId).to.be.eql(thirdParty2[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty2[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty2[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty2[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty2[0])
      expect(itemsCount).to.be.eq.BN(1)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty2[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty2[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i + 2][1])
        expect(item.contentHash).to.be.eql(contentHashes[i + 2])
        expect(item.isApproved).to.be.eql(true)
        expect(item.registered).to.be.eq.BN(1)
      }
    })

    it('should review items :: Relayed EIP721', async function () {
      // Third Party 1
      let thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(2)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty1[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty1[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
        expect(item.registered).to.be.eq.BN(1)
      }

      // Third Party 2
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(1)
      expect(thirdPartyId).to.be.eql(thirdParty2[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty2[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty2[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty2[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty2[0])
      expect(itemsCount).to.be.eq.BN(1)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty2[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty2[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i + 2][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
        expect(item.registered).to.be.eq.BN(1)
      }

      let functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              components: [
                {
                  internalType: 'string',
                  name: 'id',
                  type: 'string',
                },
                {
                  internalType: 'bool',
                  name: 'value',
                  type: 'bool',
                },
                {
                  components: [
                    {
                      internalType: 'string',
                      name: 'id',
                      type: 'string',
                    },
                    {
                      internalType: 'string',
                      name: 'metadata',
                      type: 'string',
                    },
                    {
                      internalType: 'string',
                      name: 'contentHash',
                      type: 'string',
                    },
                    {
                      internalType: 'bool',
                      name: 'value',
                      type: 'bool',
                    },
                  ],
                  internalType: 'struct ThirdPartyRegistry.ItemReviewParam[]',
                  name: 'items',
                  type: 'tuple[]',
                },
              ],
              internalType: 'struct ThirdPartyRegistry.ThirdPartyReviewParam[]',
              name: '_thirdParties',
              type: 'tuple[]',
            },
          ],
          name: 'reviewThirdParties',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [
          [
            [
              thirdParty1[0],
              true,
              [
                [...UPDATED_THIRD_PARTY_ITEMS[0], contentHashes[0], true],
                [...UPDATED_THIRD_PARTY_ITEMS[1], contentHashes[1], true],
              ],
            ],
            [
              thirdParty2[0],
              true,
              [[...THIRD_PARTY_ITEMS[2], contentHashes[2], true]],
            ],
          ],
        ]
      )

      const { logs } = await sendMetaTx(
        thirdPartyRegistryContract,
        functionSignature,
        committeeMember,
        relayer,
        null,
        domain,
        version
      )

      expect(logs.length).to.be.equal(6)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(committeeMember)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      expect(logs[1].event).to.be.equal('ThirdPartyReviewed')
      expect(logs[1].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[1].args._value).to.be.eql(true)
      expect(logs[1].args._caller).to.be.eql(committeeMember)

      expect(logs[2].event).to.be.equal('ItemReviewed')
      expect(logs[2].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[2].args._itemId).to.be.eql(UPDATED_THIRD_PARTY_ITEMS[0][0])
      expect(logs[2].args._metadata).to.be.eql(UPDATED_THIRD_PARTY_ITEMS[0][1])
      expect(logs[2].args._contentHash).to.be.eql(contentHashes[0])
      expect(logs[2].args._value).to.be.eql(true)
      expect(logs[2].args._caller).to.be.eql(committeeMember)

      expect(logs[3].event).to.be.equal('ItemReviewed')
      expect(logs[3].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[3].args._itemId).to.be.eql(UPDATED_THIRD_PARTY_ITEMS[1][0])
      expect(logs[3].args._metadata).to.be.eql(UPDATED_THIRD_PARTY_ITEMS[1][1])
      expect(logs[3].args._contentHash).to.be.eql(contentHashes[1])
      expect(logs[3].args._value).to.be.eql(true)
      expect(logs[3].args._caller).to.be.eql(committeeMember)

      expect(logs[4].event).to.be.equal('ThirdPartyReviewed')
      expect(logs[4].args._thirdPartyId).to.be.eql(thirdParty2[0])
      expect(logs[4].args._value).to.be.eql(true)
      expect(logs[4].args._caller).to.be.eql(committeeMember)

      expect(logs[5].event).to.be.equal('ItemReviewed')
      expect(logs[5].args._thirdPartyId).to.be.eql(thirdParty2[0])
      expect(logs[5].args._itemId).to.be.eql(THIRD_PARTY_ITEMS[2][0])
      expect(logs[5].args._metadata).to.be.eql(THIRD_PARTY_ITEMS[2][1])
      expect(logs[5].args._contentHash).to.be.eql(contentHashes[2])
      expect(logs[5].args._value).to.be.eql(true)
      expect(logs[5].args._caller).to.be.eql(committeeMember)

      // Third Party 1
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty1[0])
      expect(itemsCount).to.be.eq.BN(2)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty1[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty1[0],
          itemId
        )

        expect(item.metadata).to.be.eql(UPDATED_THIRD_PARTY_ITEMS[i][1])
        expect(item.contentHash).to.be.eql(contentHashes[i])
        expect(item.isApproved).to.be.eql(true)
        expect(item.registered).to.be.eq.BN(1)
      }

      // Third Party 2
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(1)
      expect(thirdPartyId).to.be.eql(thirdParty2[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty2[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty2[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty2[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty2[0])
      expect(itemsCount).to.be.eq.BN(1)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty2[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty2[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i + 2][1])
        expect(item.contentHash).to.be.eql(contentHashes[i + 2])
        expect(item.isApproved).to.be.eql(true)
        expect(item.registered).to.be.eq.BN(1)
      }
    })

    it('should review third parties with items', async function () {
      // Third Party 1
      let thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(2)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty1[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty1[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
        expect(item.registered).to.be.eq.BN(1)
      }

      // Third Party 2
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(1)
      expect(thirdPartyId).to.be.eql(thirdParty2[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty2[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty2[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty2[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty2[0])
      expect(itemsCount).to.be.eq.BN(1)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty2[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty2[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i + 2][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
        expect(item.registered).to.be.eq.BN(1)
      }

      const { logs } = await thirdPartyRegistryContract.reviewThirdParties(
        [
          [
            thirdParty1[0],
            false,
            [
              [...THIRD_PARTY_ITEMS[0], contentHashes[0], true],
              [...THIRD_PARTY_ITEMS[1], contentHashes[1], true],
            ],
          ],
          [
            thirdParty2[0],
            false,
            [[...THIRD_PARTY_ITEMS[2], contentHashes[2], true]],
          ],
        ],
        fromCommitteeMember
      )

      expect(logs.length).to.be.equal(5)

      expect(logs[0].event).to.be.equal('ThirdPartyReviewed')
      expect(logs[0].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[0].args._value).to.be.eql(false)
      expect(logs[0].args._caller).to.be.eql(committeeMember)

      expect(logs[1].event).to.be.equal('ItemReviewed')
      expect(logs[1].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[1].args._itemId).to.be.eql(THIRD_PARTY_ITEMS[0][0])
      expect(logs[1].args._metadata).to.be.eql(THIRD_PARTY_ITEMS[0][1])
      expect(logs[1].args._contentHash).to.be.eql(contentHashes[0])
      expect(logs[1].args._value).to.be.eql(true)
      expect(logs[1].args._caller).to.be.eql(committeeMember)

      expect(logs[2].event).to.be.equal('ItemReviewed')
      expect(logs[2].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[2].args._itemId).to.be.eql(THIRD_PARTY_ITEMS[1][0])
      expect(logs[2].args._metadata).to.be.eql(THIRD_PARTY_ITEMS[1][1])
      expect(logs[2].args._contentHash).to.be.eql(contentHashes[1])
      expect(logs[2].args._value).to.be.eql(true)
      expect(logs[2].args._caller).to.be.eql(committeeMember)

      expect(logs[3].event).to.be.equal('ThirdPartyReviewed')
      expect(logs[3].args._thirdPartyId).to.be.eql(thirdParty2[0])
      expect(logs[3].args._value).to.be.eql(false)
      expect(logs[3].args._caller).to.be.eql(committeeMember)

      expect(logs[4].event).to.be.equal('ItemReviewed')
      expect(logs[4].args._thirdPartyId).to.be.eql(thirdParty2[0])
      expect(logs[4].args._itemId).to.be.eql(THIRD_PARTY_ITEMS[2][0])
      expect(logs[4].args._metadata).to.be.eql(THIRD_PARTY_ITEMS[2][1])
      expect(logs[4].args._contentHash).to.be.eql(contentHashes[2])
      expect(logs[4].args._value).to.be.eql(true)
      expect(logs[4].args._caller).to.be.eql(committeeMember)

      // Third Party 1
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(false)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty1[0])
      expect(itemsCount).to.be.eq.BN(2)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty1[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty1[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i][1])
        expect(item.contentHash).to.be.eql(contentHashes[i])
        expect(item.isApproved).to.be.eql(true)
        expect(item.registered).to.be.eq.BN(1)
      }

      // Third Party 2
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(1)
      expect(thirdPartyId).to.be.eql(thirdParty2[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty2[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty2[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty2[2])
      expect(thirdParty.isApproved).to.be.eql(false)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty2[0])
      expect(itemsCount).to.be.eq.BN(1)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty2[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty2[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i + 2][1])
        expect(item.contentHash).to.be.eql(contentHashes[i + 2])
        expect(item.isApproved).to.be.eql(true)
        expect(item.registered).to.be.eq.BN(1)
      }
    })

    it('should review third parties with items :: Relayed EIP721', async function () {
      // Third Party 1
      let thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(2)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty1[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty1[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
        expect(item.registered).to.be.eq.BN(1)
      }

      // Third Party 2
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(1)
      expect(thirdPartyId).to.be.eql(thirdParty2[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty2[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty2[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty2[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty2[0])
      expect(itemsCount).to.be.eq.BN(1)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty2[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty2[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i + 2][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
        expect(item.registered).to.be.eq.BN(1)
      }

      let functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              components: [
                {
                  internalType: 'string',
                  name: 'id',
                  type: 'string',
                },
                {
                  internalType: 'bool',
                  name: 'value',
                  type: 'bool',
                },
                {
                  components: [
                    {
                      internalType: 'string',
                      name: 'id',
                      type: 'string',
                    },
                    {
                      internalType: 'string',
                      name: 'metadata',
                      type: 'string',
                    },
                    {
                      internalType: 'string',
                      name: 'contentHash',
                      type: 'string',
                    },
                    {
                      internalType: 'bool',
                      name: 'value',
                      type: 'bool',
                    },
                  ],
                  internalType: 'struct ThirdPartyRegistry.ItemReviewParam[]',
                  name: 'items',
                  type: 'tuple[]',
                },
              ],
              internalType: 'struct ThirdPartyRegistry.ThirdPartyReviewParam[]',
              name: '_thirdParties',
              type: 'tuple[]',
            },
          ],
          name: 'reviewThirdParties',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [
          [
            [
              thirdParty1[0],
              false,
              [
                [...THIRD_PARTY_ITEMS[0], contentHashes[0], true],
                [...THIRD_PARTY_ITEMS[1], contentHashes[1], true],
              ],
            ],
            [
              thirdParty2[0],
              false,
              [[...THIRD_PARTY_ITEMS[2], contentHashes[2], true]],
            ],
          ],
        ]
      )

      const { logs } = await sendMetaTx(
        thirdPartyRegistryContract,
        functionSignature,
        committeeMember,
        relayer,
        null,
        domain,
        version
      )

      expect(logs.length).to.be.equal(6)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(committeeMember)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      expect(logs[1].event).to.be.equal('ThirdPartyReviewed')
      expect(logs[1].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[1].args._value).to.be.eql(false)
      expect(logs[1].args._caller).to.be.eql(committeeMember)

      expect(logs[2].event).to.be.equal('ItemReviewed')
      expect(logs[2].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[2].args._itemId).to.be.eql(THIRD_PARTY_ITEMS[0][0])
      expect(logs[2].args._metadata).to.be.eql(THIRD_PARTY_ITEMS[0][1])
      expect(logs[2].args._contentHash).to.be.eql(contentHashes[0])
      expect(logs[2].args._value).to.be.eql(true)
      expect(logs[2].args._caller).to.be.eql(committeeMember)

      expect(logs[3].event).to.be.equal('ItemReviewed')
      expect(logs[3].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[3].args._itemId).to.be.eql(THIRD_PARTY_ITEMS[1][0])
      expect(logs[3].args._metadata).to.be.eql(THIRD_PARTY_ITEMS[1][1])
      expect(logs[3].args._contentHash).to.be.eql(contentHashes[1])
      expect(logs[3].args._value).to.be.eql(true)
      expect(logs[3].args._caller).to.be.eql(committeeMember)

      expect(logs[4].event).to.be.equal('ThirdPartyReviewed')
      expect(logs[4].args._thirdPartyId).to.be.eql(thirdParty2[0])
      expect(logs[4].args._value).to.be.eql(false)
      expect(logs[4].args._caller).to.be.eql(committeeMember)

      expect(logs[5].event).to.be.equal('ItemReviewed')
      expect(logs[5].args._thirdPartyId).to.be.eql(thirdParty2[0])
      expect(logs[5].args._itemId).to.be.eql(THIRD_PARTY_ITEMS[2][0])
      expect(logs[5].args._metadata).to.be.eql(THIRD_PARTY_ITEMS[2][1])
      expect(logs[5].args._contentHash).to.be.eql(contentHashes[2])
      expect(logs[5].args._value).to.be.eql(true)
      expect(logs[5].args._caller).to.be.eql(committeeMember)

      // Third Party 1
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(false)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty1[0])
      expect(itemsCount).to.be.eq.BN(2)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty1[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty1[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i][1])
        expect(item.contentHash).to.be.eql(contentHashes[i])
        expect(item.isApproved).to.be.eql(true)
        expect(item.registered).to.be.eq.BN(1)
      }

      // Third Party 2
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(1)
      expect(thirdPartyId).to.be.eql(thirdParty2[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty2[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty2[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty2[2])
      expect(thirdParty.isApproved).to.be.eql(false)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty2[0])
      expect(itemsCount).to.be.eq.BN(1)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty2[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty2[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i + 2][1])
        expect(item.contentHash).to.be.eql(contentHashes[i + 2])
        expect(item.isApproved).to.be.eql(true)
        expect(item.registered).to.be.eq.BN(1)
      }
    })

    it('should review third parties with 50 items :: gas estimation', async function () {
      // Buy 1000 item slots
      await manaContract.approve(
        thirdPartyRegistryContract.address,
        getPrice(1000),
        fromUser
      )
      await thirdPartyRegistryContract.buyItemSlots(
        thirdParty1[0],
        1000,
        getPrice(1000),
        fromUser
      )

      const items = []
      const thirdPartyItemsReview = []
      for (let i = 0; i < 50; i++) {
        items.push([
          THIRD_PARTY_ITEMS[0][0] + i.toString(),
          THIRD_PARTY_ITEMS[0][1] + i.toString(),
        ])
        thirdPartyItemsReview.push([
          THIRD_PARTY_ITEMS[0][0] + i.toString(),
          THIRD_PARTY_ITEMS[0][1] + i.toString(),
          contentHashes[0],
          true,
        ])
      }

      await thirdPartyRegistryContract.addItems(
        thirdParty1[0],
        items,
        fromManager
      )

      const { receipt } = await thirdPartyRegistryContract.reviewThirdParties(
        [[thirdParty1[0], true, thirdPartyItemsReview]],
        fromCommitteeMember
      )

      console.log(receipt.gasUsed)
    })

    it('reverts when trying to review a third party by hacker', async function () {
      await assertRevert(
        thirdPartyRegistryContract.reviewThirdParties(
          [
            [
              thirdParty1[0],
              false,
              [[...THIRD_PARTY_ITEMS[0], contentHashes[0], true]],
            ],
          ],
          fromManager
        ),
        'TPR#onlyCommittee: CALLER_IS_NOT_A_COMMITTEE_MEMBER'
      )

      await assertRevert(
        thirdPartyRegistryContract.reviewThirdParties(
          [
            [
              thirdParty1[0],
              false,
              [[...THIRD_PARTY_ITEMS[0], contentHashes[0], true]],
            ],
          ],
          fromHacker
        ),
        'TPR#onlyCommittee: CALLER_IS_NOT_A_COMMITTEE_MEMBER'
      )
    })

    it('reverts when trying to review an invalid third party', async function () {
      await assertRevert(
        thirdPartyRegistryContract.reviewThirdParties(
          [
            [
              thirdParty1[0] + 'invalid',
              false,
              [[...THIRD_PARTY_ITEMS[0], contentHashes[0], true]],
            ],
          ],
          fromCommitteeMember
        ),
        'TPR#_checkThirdParty: INVALID_THIRD_PARTY'
      )
    })

    it('reverts when trying to review a third party item without content hash', async function () {
      await assertRevert(
        thirdPartyRegistryContract.reviewThirdParties(
          [[thirdParty1[0], false, [[...THIRD_PARTY_ITEMS[0], '', true]]]],
          fromCommitteeMember
        ),
        'TPR#reviewThirdParties: INVALID_CONTENT_HASH'
      )
    })

    it('reverts when trying to review an invalid third party item', async function () {
      await assertRevert(
        thirdPartyRegistryContract.reviewThirdParties(
          [
            [
              thirdParty1[0],
              false,
              [
                [
                  THIRD_PARTY_ITEMS[0][0] + 'invalid',
                  '',
                  contentHashes[0],
                  true,
                ],
              ],
            ],
          ],
          fromCommitteeMember
        ),
        'TPR#_checkItem: INVALID_ITEM'
      )
    })
  })

  describe.only('reviewThirdPartyWithRoot', function () {
    const dummyBytes32 =
      '0xfb29356fd617c9cd94242484eb432bffba7866624463d685cd6453d68c1073b3'

    it('should approve the third party, update the root and emit the reviewed event when qty is 0', async function () {
      await thirdPartyRegistryContract.addThirdParties(
        [thirdParty1],
        fromThirdPartyAgregator
      )

      await thirdPartyRegistryContract.reviewThirdPartyWithRoot(
        thirdParty1[0],
        0,
        dummyBytes32,
        dummyBytes32,
        dummyBytes32,
        0,
        fromCommitteeMember
      )
    })

    it('reverts when sender is not from commitee', async function () {
      await assertRevert(
        thirdPartyRegistryContract.reviewThirdPartyWithRoot(
          'some-third-party-id',
          0,
          dummyBytes32,
          dummyBytes32,
          dummyBytes32,
          0,
          fromUser
        ),
        'TPR#onlyCommittee: CALLER_IS_NOT_A_COMMITTEE_MEMBER'
      )
    })

    it('reverts when third party is not registered', async function () {
      await assertRevert(
        thirdPartyRegistryContract.reviewThirdPartyWithRoot(
          'unregistered-third-party-id',
          0,
          dummyBytes32,
          dummyBytes32,
          dummyBytes32,
          0,
          fromCommitteeMember
        ),
        'TPR#_checkThirdParty: INVALID_THIRD_PARTY'
      )
    })
  })

  describe('end2end', function () {
    const itemsToAdd = []
    const reviewedThirdPartyItems = []
    let tprContract

    for (let i = 0; i < 10; i++) {
      itemsToAdd.push([
        THIRD_PARTY_ITEMS[0][0] + i.toString(),
        ...THIRD_PARTY_ITEMS[0].slice(1),
      ])
    }

    it('should deploy the TPR contract', async function () {
      tprContract = await ThirdPartyRegistry.new(
        owner,
        thirdPartyAgregator,
        collector,
        committeeContract.address,
        manaContract.address,
        chainlinkOracleContract.address,
        oneEther,
        fromDeployer
      )

      await mana.setInitialBalances()
    })

    it('should add two third parties (thirdparty1 & thirdparty2)', async function () {
      let thirdPartiesCount = await tprContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(0)

      await tprContract.addThirdParties(THIRD_PARTIES, fromThirdPartyAgregator)

      thirdPartiesCount = await tprContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      for (let t = 0; t < thirdPartiesCount; t++) {
        const expectedThirdParty = THIRD_PARTIES[t]
        const thirdPartyId = await tprContract.thirdPartyIds(t)
        expect(thirdPartyId).to.be.eql(expectedThirdParty[0])

        const thirdParty = await tprContract.thirdParties(thirdPartyId)

        expect(thirdParty.metadata).to.be.eql(expectedThirdParty[1])
        expect(thirdParty.resolver).to.be.eql(expectedThirdParty[2])
        expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
        expect(thirdParty.maxItems).to.be.eq.BN(0)
        expect(thirdParty.registered).to.be.eq.BN(1)

        for (let i = 0; i < expectedThirdParty[3].length; i++) {
          const isManager = await tprContract.isThirdPartyManager(
            thirdPartyId,
            expectedThirdParty[3][i]
          )
          expect(isManager).to.be.equal(true)
        }

        const itemsCount = await tprContract.itemsCount(thirdParty1[0])
        expect(itemsCount).to.be.eq.BN(0)
      }
    })

    it('reverts when trying to re-add thirdparty2', async function () {
      await assertRevert(
        tprContract.addThirdParties(
          [THIRD_PARTIES[1]],
          fromThirdPartyAgregator
        ),
        'TPR#addThirdParties: THIRD_PARTY_ALREADY_ADDED'
      )
    })

    it('should reject thirdparty1', async function () {
      let thirdParty = await tprContract.thirdParties(THIRD_PARTIES[0][0])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)

      await tprContract.reviewThirdParties(
        [[THIRD_PARTIES[0][0], false, []]],
        fromCommitteeMember
      )

      thirdParty = await tprContract.thirdParties(THIRD_PARTIES[0][0])
      expect(thirdParty.isApproved).to.be.eql(false)
    })

    it('should buy 10 item slots for thirdparty1', async function () {
      // Buy 10 item slots
      await manaContract.approve(
        tprContract.address,
        priceOfSlotsToBuy,
        fromManager
      )

      await tprContract.buyItemSlots(
        THIRD_PARTIES[0][0],
        slotsToAddOrBuy,
        priceOfSlotsToBuy,
        fromManager
      )

      const thirdParty = await tprContract.thirdParties(THIRD_PARTIES[0][0])
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)

      const itemsCount = await tprContract.itemsCount(thirdParty1[0])
      expect(itemsCount).to.be.eq.BN(0)
    })

    it('should add one manager for thirdparty1', async function () {
      let isManager = await tprContract.isThirdPartyManager(
        THIRD_PARTIES[0][0],
        manager
      )
      expect(isManager).to.be.equal(true)

      isManager = await tprContract.isThirdPartyManager(
        THIRD_PARTIES[0][0],
        anotherManager
      )
      expect(isManager).to.be.equal(false)

      await tprContract.updateThirdParties(
        [
          [
            THIRD_PARTIES[0][0],
            THIRD_PARTIES[0][1],
            THIRD_PARTIES[0][2],
            [anotherManager],
            [true],
          ],
        ],
        fromManager
      )

      isManager = await tprContract.isThirdPartyManager(
        THIRD_PARTIES[0][0],
        manager
      )
      expect(isManager).to.be.equal(true)

      isManager = await tprContract.isThirdPartyManager(
        THIRD_PARTIES[0][0],
        anotherManager
      )
      expect(isManager).to.be.equal(true)
    })

    it('reverts when trying to add items by not a manager', async function () {
      await assertRevert(
        tprContract.addItems(
          THIRD_PARTIES[0][0],
          [THIRD_PARTY_ITEMS[0], THIRD_PARTY_ITEMS[1]],
          fromCommitteeMember
        ),
        'TPR#addItems: INVALID_SENDER'
      )
    })

    it('should add 10 items to thirdparty1', async function () {
      let itemsCount = await tprContract.itemsCount(THIRD_PARTIES[0][0])
      expect(itemsCount).to.be.eq.BN(0)

      await tprContract.addItems(THIRD_PARTIES[0][0], itemsToAdd, fromManager)

      itemsCount = await tprContract.itemsCount(THIRD_PARTIES[0][0])
      expect(itemsCount).to.be.eq.BN(itemsToAdd.length)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await tprContract.itemIdByIndex(THIRD_PARTIES[0][0], i)
        expect(itemId).to.be.equal(itemsToAdd[i][0])

        const item = await tprContract.itemsById(THIRD_PARTIES[0][0], itemId)
        expect(item.metadata).to.be.eql(itemsToAdd[i][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
        expect(item.registered).to.be.eq.BN(1)
      }
    })

    it('reverts when trying to add more items to thirdparty1', async function () {
      await assertRevert(
        tprContract.addItems(
          THIRD_PARTIES[0][0],
          [THIRD_PARTY_ITEMS[1]],
          fromManager
        ),
        'as'
      )
    })

    it('should update thirdparty1 resolver', async function () {
      let thirdParty = await tprContract.thirdParties(THIRD_PARTIES[0][0])
      expect(thirdParty.resolver).to.be.eql(THIRD_PARTIES[0][2])

      const newResolver = 'https://new.api.thirdparty/v1'
      await tprContract.updateThirdParties(
        [[THIRD_PARTIES[0][0], THIRD_PARTIES[0][1], newResolver, [], []]],
        fromAnotherManager
      )

      thirdParty = await tprContract.thirdParties(THIRD_PARTIES[0][0])
      expect(thirdParty.resolver).to.be.eql(newResolver)
    })

    it('aprove thirdparty1 and items', async function () {
      for (let i = 0; i < itemsToAdd.length; i++) {
        reviewedThirdPartyItems.push([
          ...itemsToAdd[i],
          'contentHash' + i.toString(),
          true,
        ])
      }

      let thirdParty = await tprContract.thirdParties(THIRD_PARTIES[0][0])
      expect(thirdParty.isApproved).to.be.equal(false)

      let itemsCount = await tprContract.itemsCount(THIRD_PARTIES[0][0])
      expect(itemsCount).to.be.eq.BN(reviewedThirdPartyItems.length)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await tprContract.itemIdByIndex(THIRD_PARTIES[0][0], i)
        expect(itemId).to.be.equal(itemsToAdd[i][0])

        const item = await tprContract.itemsById(THIRD_PARTIES[0][0], itemId)
        expect(item.metadata).to.be.eql(itemsToAdd[i][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
        expect(item.registered).to.be.eq.BN(1)
      }

      await tprContract.reviewThirdParties(
        [[THIRD_PARTIES[0][0], true, reviewedThirdPartyItems]],
        fromCommitteeMember
      )

      thirdParty = await tprContract.thirdParties(THIRD_PARTIES[0][0])
      expect(thirdParty.isApproved).to.be.equal(true)

      itemsCount = await tprContract.itemsCount(THIRD_PARTIES[0][0])
      expect(itemsCount).to.be.eq.BN(reviewedThirdPartyItems.length)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await tprContract.itemIdByIndex(THIRD_PARTIES[0][0], i)
        expect(itemId).to.be.equal(reviewedThirdPartyItems[i][0])

        const item = await tprContract.itemsById(THIRD_PARTIES[0][0], itemId)
        expect(item.metadata).to.be.eql(reviewedThirdPartyItems[i][1])
        expect(item.contentHash).to.be.eql(reviewedThirdPartyItems[i][2])
        expect(item.isApproved).to.be.eql(true)
        expect(item.registered).to.be.eq.BN(1)
      }
    })

    it('should buy 10 item slots more for thirdparty1', async function () {
      let thirdParty = await tprContract.thirdParties(THIRD_PARTIES[0][0])
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)

      let itemsCount = await tprContract.itemsCount(thirdParty1[0])
      expect(itemsCount).to.be.eq.BN(10)

      // Buy 10 item slots
      await manaContract.approve(
        tprContract.address,
        priceOfSlotsToBuy,
        fromManager
      )

      await tprContract.buyItemSlots(
        THIRD_PARTIES[0][0],
        slotsToAddOrBuy,
        priceOfSlotsToBuy,
        fromManager
      )

      thirdParty = await tprContract.thirdParties(THIRD_PARTIES[0][0])
      expect(thirdParty.maxItems).to.be.eq.BN(20)

      itemsCount = await tprContract.itemsCount(thirdParty1[0])
      expect(itemsCount).to.be.eq.BN(10)
    })

    it('should add 5 items to thirdparty1', async function () {
      let itemsCount = await tprContract.itemsCount(THIRD_PARTIES[0][0])
      expect(itemsCount).to.be.eq.BN(10)

      for (let i = 0; i < 5; i++) {
        itemsToAdd.push([
          THIRD_PARTY_ITEMS[1][0] + i.toString(),
          THIRD_PARTY_ITEMS[1][1],
        ])
      }

      await tprContract.addItems(
        THIRD_PARTIES[0][0],
        itemsToAdd.slice(10),
        fromManager
      )

      itemsCount = await tprContract.itemsCount(THIRD_PARTIES[0][0])
      expect(itemsCount).to.be.eq.BN(itemsToAdd.length)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await tprContract.itemIdByIndex(THIRD_PARTIES[0][0], i)
        expect(itemId).to.be.equal(itemsToAdd[i][0])

        const item = await tprContract.itemsById(THIRD_PARTIES[0][0], itemId)
        expect(item.metadata).to.be.eql(itemsToAdd[i][1])
        expect(item.contentHash).to.be.eql(
          i < 10 ? reviewedThirdPartyItems[i][2] : ''
        )
        expect(item.isApproved).to.be.eql(i < 10 ? true : initialValueForItems)
        expect(item.registered).to.be.eq.BN(1)
      }
    })

    it('reverts when trying to approve by not a committee member', async function () {
      await assertRevert(
        tprContract.reviewThirdParties(
          [[THIRD_PARTIES[0][0], true, reviewedThirdPartyItems]],
          fromManager
        ),
        'TPR#onlyCommittee: CALLER_IS_NOT_A_COMMITTEE_MEMBER'
      )

      await assertRevert(
        tprContract.reviewThirdParties(
          [[THIRD_PARTIES[0][0], true, reviewedThirdPartyItems]],
          fromHacker
        ),
        'TPR#onlyCommittee: CALLER_IS_NOT_A_COMMITTEE_MEMBER'
      )

      await assertRevert(
        tprContract.reviewThirdParties(
          [[THIRD_PARTIES[0][0], true, reviewedThirdPartyItems]],
          fromUser
        ),
        'TPR#onlyCommittee: CALLER_IS_NOT_A_COMMITTEE_MEMBER'
      )
    })

    it('should aprove thirdparty1 and items', async function () {
      for (let i = 0; i < 5; i++) {
        reviewedThirdPartyItems.push([
          ...itemsToAdd[i + 10],
          'contentHash' + (i + 10).toString(),
          true,
        ])
      }

      let thirdParty = await tprContract.thirdParties(THIRD_PARTIES[0][0])
      expect(thirdParty.isApproved).to.be.equal(true)

      let itemsCount = await tprContract.itemsCount(THIRD_PARTIES[0][0])
      expect(itemsCount).to.be.eq.BN(reviewedThirdPartyItems.length)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await tprContract.itemIdByIndex(THIRD_PARTIES[0][0], i)
        expect(itemId).to.be.equal(itemsToAdd[i][0])

        const item = await tprContract.itemsById(THIRD_PARTIES[0][0], itemId)
        expect(item.metadata).to.be.eql(itemsToAdd[i][1])
        expect(item.contentHash).to.be.eql(
          i < 10 ? reviewedThirdPartyItems[i][2] : ''
        )
        expect(item.isApproved).to.be.eql(i < 10 ? true : initialValueForItems)
        expect(item.registered).to.be.eq.BN(1)
      }

      await tprContract.reviewThirdParties(
        [[THIRD_PARTIES[0][0], true, reviewedThirdPartyItems]],
        fromCommitteeMember
      )

      thirdParty = await tprContract.thirdParties(THIRD_PARTIES[0][0])
      expect(thirdParty.isApproved).to.be.equal(true)

      itemsCount = await tprContract.itemsCount(THIRD_PARTIES[0][0])
      expect(itemsCount).to.be.eq.BN(reviewedThirdPartyItems.length)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await tprContract.itemIdByIndex(THIRD_PARTIES[0][0], i)
        expect(itemId).to.be.equal(reviewedThirdPartyItems[i][0])

        const item = await tprContract.itemsById(THIRD_PARTIES[0][0], itemId)
        expect(item.metadata).to.be.eql(reviewedThirdPartyItems[i][1])
        expect(item.contentHash).to.be.eql(reviewedThirdPartyItems[i][2])
        expect(item.isApproved).to.be.eql(true)
        expect(item.registered).to.be.eq.BN(1)
      }
    })

    it('should reject thirdparty1 and items', async function () {
      let thirdParty = await tprContract.thirdParties(THIRD_PARTIES[0][0])
      expect(thirdParty.isApproved).to.be.equal(true)

      let itemsCount = await tprContract.itemsCount(THIRD_PARTIES[0][0])
      expect(itemsCount).to.be.eq.BN(reviewedThirdPartyItems.length)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await tprContract.itemIdByIndex(THIRD_PARTIES[0][0], i)
        expect(itemId).to.be.equal(reviewedThirdPartyItems[i][0])

        const item = await tprContract.itemsById(THIRD_PARTIES[0][0], itemId)
        expect(item.metadata).to.be.eql(reviewedThirdPartyItems[i][1])
        expect(item.contentHash).to.be.eql(reviewedThirdPartyItems[i][2])
        expect(item.isApproved).to.be.eql(true)
        expect(item.registered).to.be.eq.BN(1)

        reviewedThirdPartyItems[i][3] = false
      }

      await tprContract.reviewThirdParties(
        [[THIRD_PARTIES[0][0], false, reviewedThirdPartyItems]],
        fromCommitteeMember
      )

      thirdParty = await tprContract.thirdParties(THIRD_PARTIES[0][0])
      expect(thirdParty.isApproved).to.be.equal(false)

      itemsCount = await tprContract.itemsCount(THIRD_PARTIES[0][0])
      expect(itemsCount).to.be.eq.BN(reviewedThirdPartyItems.length)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await tprContract.itemIdByIndex(THIRD_PARTIES[0][0], i)
        expect(itemId).to.be.equal(reviewedThirdPartyItems[i][0])

        const item = await tprContract.itemsById(THIRD_PARTIES[0][0], itemId)
        expect(item.metadata).to.be.eql(reviewedThirdPartyItems[i][1])
        expect(item.contentHash).to.be.eql(reviewedThirdPartyItems[i][2])
        expect(item.isApproved).to.be.eql(false)
        expect(item.registered).to.be.eq.BN(1)
      }
    })
  })
})
