import hr from 'hardhat'
import { Mana } from 'decentraland-contract-plugins'

import assertRevert from '../helpers/assertRevert'
import { TIERS, getInitialTiers } from '../helpers/collectionV2'
import { sendMetaTx } from '../helpers/metaTx'

const Tiers = artifacts.require('Tiers')
const Committee = artifacts.require('Committee')
const ThirdPartyRegistry = artifacts.require('ThirdPartyRegistry')

const BN = web3.utils.BN
const expect = require('chai').use(require('bn-chai')(BN)).expect
const domain = 'Decentraland Third Party Registry'
const version = '1'
let thirdParty1
let thirdParty2

describe.only('ThirdPartyRegistry', function () {
  this.timeout(100000)

  // Accounts
  let accounts
  let deployer
  let user
  let manager
  let anotherManager
  let committeeMember
  let feesCollector
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

  // Contracts
  let tiersContract
  let committeeContract
  let manaContract
  let thirdPartyRegistryContract

  async function createMANA() {
    if (!manaContract) {
      const mana = new Mana({ accounts, artifacts: hr.artifacts })
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
    feesCollector = accounts[6]
    owner = accounts[7]
    anotherManager = accounts[8]
    fromUser = { from: user }
    fromManager = { from: manager }
    fromHacker = { from: hacker }
    fromRelayer = { from: relayer }
    fromDeployer = { from: deployer }
    fromOwner = { from: owner }
    fromAnotherManager = { from: anotherManager }
    fromCommitteeMember = { from: committeeMember }

    await createMANA()

    committeeContract = await Committee.new(
      owner,
      [committeeMember],
      fromDeployer
    )

    tiersContract = await Tiers.new(deployer, getInitialTiers())

    thirdPartyRegistryContract = await ThirdPartyRegistry.new(
      owner,
      feesCollector,
      committeeContract.address,
      manaContract.address,
      tiersContract.address,
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
      'tp:2:third party 2: the third party 2 desc',
      'https://api.thirdparty2.com/v1/',
      [anotherManager],
      [],
    ]
  })

  describe('initialize', function () {
    it('should be initialized with correct values', async function () {
      const contract = await ThirdPartyRegistry.new(
        owner,
        feesCollector,
        committeeContract.address,
        manaContract.address,
        tiersContract.address,
        fromDeployer
      )

      const contractOwner = await contract.owner()
      expect(contractOwner).to.be.equal(owner)

      const feesCollectorContract = await contract.feesCollector()
      expect(feesCollectorContract).to.be.equal(feesCollector)

      const committee = await contract.committee()
      expect(committee).to.be.equal(committeeContract.address)

      const mana = await contract.acceptedToken()
      expect(mana).to.be.equal(manaContract.address)

      const itemTiers = await contract.itemTiers()
      expect(itemTiers).to.be.equal(tiersContract.address)

      const thirdPartiesCount = await contract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(0)

      const initialThirdPartyValue = await contract.initialThirdPartyValue()
      expect(initialThirdPartyValue).to.be.equal(true)

      const initialItemValue = await contract.initialItemValue()
      expect(initialItemValue).to.be.equal(false)
    })
  })

  describe('addThirdParties', function () {
    it('should add third parties', async function () {
      let thirdPartiesCount =
        await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(0)

      const { logs } = await thirdPartyRegistryContract.addThirdParties(
        [thirdParty1, thirdParty2],
        fromCommitteeMember
      )

      expect(logs.length).to.be.equal(2)
      // expect(logs[0].event).to.be.equal('TierAdded')
      // expect(logs[0].args._tier).to.be.eql(newTier1)

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)
    })

    it('should add tiers :: Relayed EIP721', async function () {
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

      // expect(logs[1].event).to.be.equal('TierAdded')
      // expect(logs[1].args._tier).to.be.eql(newTier1)

      // expect(logs[2].event).to.be.equal('TierAdded')
      // expect(logs[2].args._tier).to.be.eql(newTier2)

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)
    })

    it('reverts when trying to add a third party by hacker', async function () {
      await assertRevert(
        thirdPartyRegistryContract.addThirdParties([thirdParty1], fromHacker),
        'TPR#onlyCommittee: CALLER_IS_NOT_A_COMMITTEE_MEMBER'
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
})
