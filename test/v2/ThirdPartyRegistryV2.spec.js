import hr from 'hardhat'
import { Mana } from 'decentraland-contract-plugins'

import assertRevert from '../helpers/assertRevert'
import { balanceSnap } from '../helpers/balanceSnap'
import { THIRD_PARTY_ITEMS, ZERO_ADDRESS } from '../helpers/collectionV2'
import { sendMetaTx } from '../helpers/metaTx'
import {
  deleteOZUpgradeFile,
  getMessageHash,
  getSignature,
  ProxyAdmin,
  TransparentUpgradeableProxy,
} from '../helpers/thirdPartyRegistry'

const Committee = artifacts.require('Committee')
const ThirdPartyRegistryV2 = artifacts.require('ThirdPartyRegistryV2')
const DummyThirdPartyRegistryV2Upgrade = artifacts.require(
  'DummyThirdPartyRegistryV2Upgrade'
)
const ChainlinkOracle = artifacts.require('ChainlinkOracle')
const InvalidOracle = artifacts.require('DummyInvalidOracle')
const DummyDataFeed = artifacts.require('DummyDataFeed')

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

const dummyBytes32 = web3.utils.randomHex(32)
const zeroBytes32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000'

let THIRD_PARTIES
let thirdParty1
let thirdParty2

const getPrice = (slots) => oneEther.mul(toBN((slots / 2).toString()))

const slotsToAddOrBuy = 10
const priceOfSlotsToBuy = getPrice(slotsToAddOrBuy)

describe('ThirdPartyRegistryV2', function () {
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
  let thirdPartyAggregator
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
  let fromThirdPartyAggregator

  // Contracts
  let committeeContract
  let manaContract
  let proxyAdminContract
  let transparentUpgradeableProxyContract
  // As per the transparent proxy pattern, this var will store the logic/implementation
  let thirdPartyRegistryImplementationContract
  // While this variable will store the TransparentUpgradeableProxy contract
  // which will be used as it it were a normal ThirdPartyRegistryV2 contract
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
    deleteOZUpgradeFile()

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
    thirdPartyAggregator = accounts[9]
    fromUser = { from: user }
    fromManager = { from: manager }
    fromHacker = { from: hacker }
    fromRelayer = { from: relayer }
    fromDeployer = { from: deployer }
    fromOwner = { from: owner }
    fromAnotherManager = { from: anotherManager }
    fromCommitteeMember = { from: committeeMember }
    fromThirdPartyAggregator = { from: thirdPartyAggregator }

    await createMANA()

    committeeContract = await Committee.new(
      owner,
      [committeeMember],
      fromDeployer
    )

    const dataFeedDecimals = 8
    const dataFeedAnswer = 2 * 10 ** dataFeedDecimals // 200000000

    dataFeedContract = await DummyDataFeed.new(
      dataFeedDecimals,
      dataFeedAnswer,
      0
    )

    chainlinkOracleContract = await ChainlinkOracle.new(
      dataFeedContract.address,
      18,
      0
    )

    // Start - Deploy TPR contract and required proxy contracts

    const ThirdPartyRegistryV2Factory = await ethers.getContractFactory(
      'ThirdPartyRegistryV2'
    )
    const ProxyAdminFactory = await ethers.getContractFactory(
      ProxyAdmin.abi,
      ProxyAdmin.bytecode
    )
    const TransparentUpgradeableProxyFactory = await ethers.getContractFactory(
      TransparentUpgradeableProxy.abi,
      TransparentUpgradeableProxy.bytecode
    )

    thirdPartyRegistryImplementationContract =
      await ThirdPartyRegistryV2Factory.deploy()
    proxyAdminContract = await ProxyAdminFactory.deploy()

    // Encode TPR initialize function data, which is used by the Proxy to
    // call the initialize function.
    const tprFactoryInterface = ThirdPartyRegistryV2Factory.interface
    const fragment = tprFactoryInterface.getFunction('initialize')
    const encodedFunctionData = tprFactoryInterface.encodeFunctionData(
      fragment,
      [
        owner,
        thirdPartyAggregator,
        collector,
        committeeContract.address,
        manaContract.address,
        chainlinkOracleContract.address,
        oneEther.toString(),
      ]
    )

    transparentUpgradeableProxyContract =
      await TransparentUpgradeableProxyFactory.deploy(
        thirdPartyRegistryImplementationContract.address,
        proxyAdminContract.address,
        encodedFunctionData
      )

    // The proxy will be the one receiving calls intended to the TPR implementation
    thirdPartyRegistryContract = await ThirdPartyRegistryV2.at(
      transparentUpgradeableProxyContract.address
    )

    // End - Deploy TPR contract and required proxy contracts

    thirdParty1 = [
      'urn:decentraland:matic:ext-thirdparty1',
      'tp:1:third party 1: the third party 1 desc',
      'https://api.thirdparty1.com/v1/',
      [manager],
      [],
      0,
    ]

    thirdParty2 = [
      'urn:decentraland:matic:ext-thirdparty2',
      'tp:1:third party 2: the third party 2 desc',
      'https://api.thirdparty2.com/v1/',
      [manager, anotherManager],
      [],
      0,
    ]

    THIRD_PARTIES = [thirdParty1, thirdParty2]
  })

  describe('proxy', () => {
    it('should upgrade the contract', async () => {
      // Check that there are no third parties
      expect(await thirdPartyRegistryContract.thirdPartiesCount()).to.be.eq.BN(
        0
      )

      // Add a third party
      await thirdPartyRegistryContract.addThirdParties(
        [thirdParty1],
        fromThirdPartyAggregator
      )

      // Check that the third party was added
      expect(await thirdPartyRegistryContract.thirdPartiesCount()).to.be.eq.BN(
        1
      )
      expect(await thirdPartyRegistryContract.thirdPartyIds(0)).to.be.eql(
        thirdParty1[0]
      )
      expect(
        (await thirdPartyRegistryContract.thirdParties(thirdParty1[0]))
          .registered
      ).to.be.eq.BN(1)

      // Deploy upgraded implementation
      const upgradedImplementation =
        await DummyThirdPartyRegistryV2Upgrade.new()

      const proxyAdmin = new web3.eth.Contract(
        ProxyAdmin.abi,
        proxyAdminContract.address
      )

      // Upgrade to new implementation
      await proxyAdmin.methods
        .upgrade(
          transparentUpgradeableProxyContract.address,
          upgradedImplementation.address
        )
        .send(fromDeployer)

      // Check the implementation has been updated in the proxy
      expect(
        await proxyAdmin.methods
          .getProxyImplementation(transparentUpgradeableProxyContract.address)
          .call()
      ).to.be.equal(upgradedImplementation.address)

      // Check that the third party is still in the upgraded contract
      expect(await thirdPartyRegistryContract.thirdPartiesCount()).to.be.eq.BN(
        1
      )
      expect(await thirdPartyRegistryContract.thirdPartyIds(0)).to.be.eql(
        thirdParty1[0]
      )
      expect(
        (await thirdPartyRegistryContract.thirdParties(thirdParty1[0]))
          .registered
      ).to.be.eq.BN(1)

      // Make sure that the contract has been upgraded by calling the updated function
      await assertRevert(
        thirdPartyRegistryContract.addThirdParties(
          [thirdParty1],
          fromThirdPartyAggregator
        ),
        'TPR#addThirdParties: REVERTED_UPGRADED_FUNCTION'
      )
    })

    it('should deploy and upgrade the contract :: hardhat-upgrades', async () => {
      const ThirdPartyRegistryV2Factory = await ethers.getContractFactory(
        'ThirdPartyRegistryV2'
      )

      const proxy = await upgrades.deployProxy(ThirdPartyRegistryV2Factory, [
        owner,
        thirdPartyAggregator,
        collector,
        committeeContract.address,
        manaContract.address,
        chainlinkOracleContract.address,
        oneEther.toString(),
      ])

      thirdPartyRegistryContract = await ThirdPartyRegistryV2.at(proxy.address)

      // Check that there are no third parties
      expect(await thirdPartyRegistryContract.thirdPartiesCount()).to.be.eq.BN(
        0
      )

      // Add a third party
      await thirdPartyRegistryContract.addThirdParties(
        [thirdParty1],
        fromThirdPartyAggregator
      )

      // Check that the third party was added
      expect(await thirdPartyRegistryContract.thirdPartiesCount()).to.be.eq.BN(
        1
      )
      expect(await thirdPartyRegistryContract.thirdPartyIds(0)).to.be.eql(
        thirdParty1[0]
      )
      expect(
        (await thirdPartyRegistryContract.thirdParties(thirdParty1[0]))
          .registered
      ).to.be.eq.BN(1)

      // Upgrade the contract with hardhat plugin
      const DummyThirdPartyRegistryV2Upgrade = await ethers.getContractFactory(
        'DummyThirdPartyRegistryV2Upgrade'
      )

      await upgrades.upgradeProxy(
        thirdPartyRegistryContract.address,
        DummyThirdPartyRegistryV2Upgrade
      )

      // Check that the third party is still in the upgraded contract
      expect(await thirdPartyRegistryContract.thirdPartiesCount()).to.be.eq.BN(
        1
      )
      expect(await thirdPartyRegistryContract.thirdPartyIds(0)).to.be.eql(
        thirdParty1[0]
      )
      expect(
        (await thirdPartyRegistryContract.thirdParties(thirdParty1[0]))
          .registered
      ).to.be.eq.BN(1)

      // Make sure that the contract has been upgraded by calling the updated function
      await assertRevert(
        thirdPartyRegistryContract.addThirdParties(
          [thirdParty1],
          fromThirdPartyAggregator
        ),
        'TPR#addThirdParties: REVERTED_UPGRADED_FUNCTION'
      )
    })

    it('should call owner ProxyAdmin functions when the caller is the owner', async function () {
      const anotherUser = hacker
      const fromAnotherUser = fromHacker

      const proxyAdmin = new web3.eth.Contract(
        ProxyAdmin.abi,
        proxyAdminContract.address
      )

      // Set user as the owner
      await proxyAdmin.methods.transferOwnership(user).send(fromDeployer)

      // Deploy upgraded implementation
      const upgradedImplementation =
        await DummyThirdPartyRegistryV2Upgrade.new()

      // Can call upgrade as user which is the new admin
      await proxyAdmin.methods
        .upgrade(
          transparentUpgradeableProxyContract.address,
          upgradedImplementation.address
        )
        .send(fromUser)

      expect(
        await proxyAdmin.methods
          .getProxyImplementation(transparentUpgradeableProxyContract.address)
          .call(fromUser)
      ).to.be.equal(upgradedImplementation.address)

      // Calling getProxyAdmin before changing the admin as it will revert afterwards
      // because, as it is not the admin anymore of the transparent proxy, the call will just go to the fallback and
      // try to call changeAdmin in the implementation (which does not exist).
      expect(
        await proxyAdmin.methods
          .getProxyAdmin(transparentUpgradeableProxyContract.address)
          .call(fromUser)
      ).to.be.equal(proxyAdminContract.address)

      // Can call changeProxyAdmin as user
      await proxyAdmin.methods
        .changeProxyAdmin(
          transparentUpgradeableProxyContract.address,
          anotherUser
        )
        .send(fromUser)

      // As said previously, as the ProxyAdmin is no longer the admin of the transparent proxy,
      // the getProxyAdmin will just fallback to the implementation unless the new admin calls it.
      await assertRevert(
        proxyAdmin.methods
          .getProxyAdmin(transparentUpgradeableProxyContract.address)
          .call(fromAnotherUser),
        "Transaction reverted: function selector was not recognized and there's no fallback function"
      )
    })

    it('should call admin TransparentUpgradeableProxy functions when the caller is the admin', async function () {
      const anotherUser = hacker
      const fromAnotherUser = fromHacker

      const proxyAdmin = new web3.eth.Contract(
        ProxyAdmin.abi,
        proxyAdminContract.address
      )

      const transparentProxy = new web3.eth.Contract(
        TransparentUpgradeableProxy.abi,
        transparentUpgradeableProxyContract.address
      )

      // Change the proxy admin to user to make calls as user
      // The deployer is the owner of the ProxyAdmin so only it can call this function.
      await proxyAdmin.methods
        .changeProxyAdmin(transparentUpgradeableProxyContract.address, user)
        .send(fromDeployer)

      // Can call admin
      expect(await transparentProxy.methods.admin().call(fromUser)).to.be.equal(
        user
      )

      // Can call implementation
      expect(
        await transparentProxy.methods.implementation().call(fromUser)
      ).to.be.equal(thirdPartyRegistryImplementationContract.address)

      // Can call changeAdmin
      await transparentProxy.methods.changeAdmin(anotherUser).send(fromUser)

      expect(
        await transparentProxy.methods.admin().call(fromAnotherUser)
      ).to.be.equal(anotherUser)

      // Deploy upgraded implementation
      const upgradedImplementation =
        await DummyThirdPartyRegistryV2Upgrade.new()

      // Can call upgradeTo
      await transparentProxy.methods
        .upgradeTo(upgradedImplementation.address)
        .send(fromAnotherUser)

      expect(
        await transparentProxy.methods.implementation().call(fromAnotherUser)
      ).to.be.equal(upgradedImplementation.address)
    })

    it('reverts if the upgrader is not the proxy admin (deployer)', async () => {
      // Deploy upgraded implementation
      let upgradedImplementation = await DummyThirdPartyRegistryV2Upgrade.new()

      const proxyAdmin = new web3.eth.Contract(
        ProxyAdmin.abi,
        proxyAdminContract.address
      )

      // Try to upgrade to new implementation without being the proxy owner
      await assertRevert(
        proxyAdmin.methods
          .upgrade(
            transparentUpgradeableProxyContract.address,
            upgradedImplementation.address
          )
          .send(fromUser),
        'Ownable: caller is not the owner'
      )

      // Transfering ownership of the proxy should fail when the caller is not the current owner
      await assertRevert(
        proxyAdmin.methods.transferOwnership(user).send(fromUser),
        'Ownable: caller is not the owner'
      )

      // Change proxy admin to user
      await proxyAdmin.methods.transferOwnership(user).send(fromDeployer)

      // Now user can upgrade the implementation
      await proxyAdmin.methods
        .upgrade(
          transparentUpgradeableProxyContract.address,
          upgradedImplementation.address
        )
        .send(fromUser)

      // Check the implementation has been updated in the proxy
      expect(
        await proxyAdmin.methods
          .getProxyImplementation(transparentUpgradeableProxyContract.address)
          .call()
      ).to.be.equal(upgradedImplementation.address)
    })

    it('reverts if the upgrader is not the proxy admin (deployer) :: hardhat-upgrades', async () => {
      const ThirdPartyRegistryV2Factory = await ethers.getContractFactory(
        'ThirdPartyRegistryV2'
      )

      const proxy = await upgrades.deployProxy(ThirdPartyRegistryV2Factory, [
        owner,
        thirdPartyAggregator,
        collector,
        committeeContract.address,
        manaContract.address,
        chainlinkOracleContract.address,
        oneEther.toString(),
      ])

      thirdPartyRegistryContract = await ThirdPartyRegistryV2.at(proxy.address)

      // Transfer ownership from deployer to user
      await upgrades.admin.transferProxyAdminOwnership(user)

      // Try to upgrade the contract as deployer
      const DummyThirdPartyRegistryV2Upgrade = await ethers.getContractFactory(
        'DummyThirdPartyRegistryV2Upgrade'
      )
      const upgradePromise = upgrades.upgradeProxy(
        thirdPartyRegistryContract.address,
        DummyThirdPartyRegistryV2Upgrade
      )

      // Should fail because deployer is no longer owner
      await assertRevert(upgradePromise, 'Ownable: caller is not the owner')
    })

    it('reverts when calling owner ProxyAdmin functions as not owner', async function () {
      const randomAddress = web3.utils.randomHex(20)

      const proxyAdmin = new web3.eth.Contract(
        ProxyAdmin.abi,
        proxyAdminContract.address
      )

      // changeProxyAdmin fails
      await assertRevert(
        proxyAdmin.methods
          .changeProxyAdmin(
            transparentUpgradeableProxyContract.address,
            randomAddress
          )
          .send(fromUser),
        'Ownable: caller is not the owner'
      )

      // upgrade fails
      await assertRevert(
        proxyAdmin.methods
          .upgrade(transparentUpgradeableProxyContract.address, randomAddress)
          .send(fromUser),
        'Ownable: caller is not the owner'
      )

      const randomBytes = randomAddress

      // upgradeAndCall fails
      await assertRevert(
        proxyAdmin.methods
          .upgradeAndCall(
            transparentUpgradeableProxyContract.address,
            randomAddress,
            randomBytes
          )
          .send(fromUser),
        'Ownable: caller is not the owner'
      )
    })

    it('reverts when calling only admin TransparentUpgradeableProxy functions as not admin', async function () {
      const randomAddress = web3.utils.randomHex(20)

      const transparentProxy = new web3.eth.Contract(
        TransparentUpgradeableProxy.abi,
        transparentUpgradeableProxyContract.address
      )

      // These functions have the following modifier, so if the caller is not the admin,
      // they will fallback to the implementation. As the implementation does not have these
      // methods, it will revert with function selector not recognized.
      //
      // modifier ifAdmin() {
      //     if (msg.sender == _getAdmin()) {
      //         _;
      //     } else {
      //         _fallback();
      //     }
      // }
      //
      // As the admin is the ProxyAdmin contract any other caller will falback into
      // unexisting selectors.

      // admin fails
      await assertRevert(
        transparentProxy.methods.admin().call(fromUser),
        "Transaction reverted: function selector was not recognized and there's no fallback function"
      )

      // implementation fails
      await assertRevert(
        transparentProxy.methods.implementation().call(fromUser),
        "Transaction reverted: function selector was not recognized and there's no fallback function"
      )

      // changeAdmin fails
      await assertRevert(
        transparentProxy.methods.changeAdmin(randomAddress).send(fromUser),
        "Transaction reverted: function selector was not recognized and there's no fallback function"
      )

      // upgradeTo fails
      await assertRevert(
        transparentProxy.methods.upgradeTo(randomAddress).send(fromUser),
        "Transaction reverted: function selector was not recognized and there's no fallback function"
      )

      const randomBytes = randomAddress

      // upgradeToAndCall fails
      await assertRevert(
        transparentProxy.methods
          .upgradeToAndCall(randomAddress, randomBytes)
          .send(fromUser),
        "Transaction reverted: function selector was not recognized and there's no fallback function"
      )
    })
  })

  describe('initialize', function () {
    it('should be initialized with correct values', async function () {
      const contractOwner = await thirdPartyRegistryContract.owner()
      expect(contractOwner).to.be.equal(owner)

      const thirdPartyAggregatorContract =
        await thirdPartyRegistryContract.thirdPartyAggregator()
      expect(thirdPartyAggregatorContract).to.be.equal(thirdPartyAggregator)

      const feesCollector = await thirdPartyRegistryContract.feesCollector()
      expect(feesCollector).to.be.equal(collector)

      const committee = await thirdPartyRegistryContract.committee()
      expect(committee).to.be.equal(committeeContract.address)

      const mana = await thirdPartyRegistryContract.acceptedToken()
      expect(mana).to.be.equal(manaContract.address)

      const thirdPartiesCount =
        await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(0)

      const initialThirdPartyValue =
        await thirdPartyRegistryContract.initialThirdPartyValue()
      expect(initialThirdPartyValue).to.be.equal(initialValueForThirdParties)

      const initialItemValue =
        await thirdPartyRegistryContract.initialItemValue()
      expect(initialItemValue).to.be.equal(initialValueForItems)

      const oracle = await thirdPartyRegistryContract.oracle()
      expect(oracle).to.be.equal(chainlinkOracleContract.address)

      const itemSlotPrice = await thirdPartyRegistryContract.itemSlotPrice()
      expect(itemSlotPrice).to.be.eq.BN(oneEther)
    })
  })

  describe('setThirdPartyAggregator', async function () {
    it('should set thirdPartyAggregator', async function () {
      let thirdPartyAggregatorContract =
        await thirdPartyRegistryContract.thirdPartyAggregator()
      expect(thirdPartyAggregatorContract).to.be.equal(thirdPartyAggregator)

      let res = await thirdPartyRegistryContract.setThirdPartyAggregator(
        user,
        fromOwner
      )

      let logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('ThirdPartyAggregatorSet')
      expect(logs[0].args._oldThirdPartyAggregator).to.be.equal(
        thirdPartyAggregator
      )
      expect(logs[0].args._newThirdPartyAggregator).to.be.equal(user)

      thirdPartyAggregatorContract =
        await thirdPartyRegistryContract.thirdPartyAggregator()
      expect(thirdPartyAggregatorContract).to.be.equal(user)

      res = await thirdPartyRegistryContract.setThirdPartyAggregator(
        thirdPartyAggregator,
        fromOwner
      )

      logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('ThirdPartyAggregatorSet')
      expect(logs[0].args._oldThirdPartyAggregator).to.be.equal(user)
      expect(logs[0].args._newThirdPartyAggregator).to.be.equal(
        thirdPartyAggregator
      )

      thirdPartyAggregatorContract =
        await thirdPartyRegistryContract.thirdPartyAggregator()
      expect(thirdPartyAggregatorContract).to.be.equal(thirdPartyAggregator)
    })

    it('reverts when trying to set the ZERO_ADDRESS as the thirdPartyAggregator', async function () {
      await assertRevert(
        thirdPartyRegistryContract.setThirdPartyAggregator(
          ZERO_ADDRESS,
          fromOwner
        ),
        'TPR#setThirdPartyAggregator: INVALID_THIRD_PARTY_AGGREGATOR'
      )
    })

    it('reverts when trying to set a thirdPartyAggregator by hacker', async function () {
      await assertRevert(
        thirdPartyRegistryContract.setThirdPartyAggregator(user, fromHacker),
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

      const thirdParty1Slots = 10
      const thirdParty2Slots = 20

      thirdParty1[5] = thirdParty1Slots
      thirdParty2[5] = thirdParty2Slots

      const { logs } = await thirdPartyRegistryContract.addThirdParties(
        [thirdParty1, thirdParty2],
        fromThirdPartyAggregator
      )

      expect(logs.length).to.be.equal(2)

      expect(logs[0].event).to.be.equal('ThirdPartyAdded')
      expect(logs[0].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[0].args._metadata).to.be.eql(thirdParty1[1])
      expect(logs[0].args._resolver).to.be.eql(thirdParty1[2])
      expect(logs[0].args._isApproved).to.be.eql(initialValueForThirdParties)
      expect(logs[0].args._managers).to.be.eql(thirdParty1[3])
      expect(logs[0].args._itemSlots).to.be.eq.BN(thirdParty1Slots)
      expect(logs[0].args._sender).to.be.eql(thirdPartyAggregator)

      expect(logs[1].event).to.be.equal('ThirdPartyAdded')
      expect(logs[1].args._thirdPartyId).to.be.eql(thirdParty2[0])
      expect(logs[1].args._metadata).to.be.eql(thirdParty2[1])
      expect(logs[1].args._resolver).to.be.eql(thirdParty2[2])
      expect(logs[1].args._isApproved).to.be.eql(initialValueForThirdParties)
      expect(logs[1].args._managers).to.be.eql(thirdParty2[3])
      expect(logs[1].args._itemSlots).to.be.eq.BN(thirdParty2Slots)
      expect(logs[1].args._sender).to.be.eql(thirdPartyAggregator)

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
      expect(thirdParty.maxItems).to.be.eq.BN(thirdParty1Slots)
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
      expect(thirdParty.maxItems).to.be.eq.BN(thirdParty2Slots)
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

      const thirdParty1Slots = 10
      const thirdParty2Slots = 20

      thirdParty1[5] = thirdParty1Slots
      thirdParty2[5] = thirdParty2Slots

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
                {
                  internalType: 'uint256',
                  name: 'slots',
                  type: 'uint256',
                },
              ],
              internalType: 'struct ThirdPartyRegistryV2.ThirdPartyParam[]',
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
        thirdPartyAggregator,
        relayer,
        null,
        domain,
        version
      )

      expect(logs.length).to.be.equal(3)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(thirdPartyAggregator)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      expect(logs[1].event).to.be.equal('ThirdPartyAdded')
      expect(logs[1].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[1].args._metadata).to.be.eql(thirdParty1[1])
      expect(logs[1].args._resolver).to.be.eql(thirdParty1[2])
      expect(logs[1].args._isApproved).to.be.eql(initialValueForThirdParties)
      expect(logs[1].args._managers).to.be.eql(thirdParty1[3])
      expect(logs[1].args._itemSlots).to.be.eq.BN(thirdParty1Slots)
      expect(logs[1].args._sender).to.be.eql(thirdPartyAggregator)

      expect(logs[2].event).to.be.equal('ThirdPartyAdded')
      expect(logs[2].args._thirdPartyId).to.be.eql(thirdParty2[0])
      expect(logs[2].args._metadata).to.be.eql(thirdParty2[1])
      expect(logs[2].args._resolver).to.be.eql(thirdParty2[2])
      expect(logs[2].args._isApproved).to.be.eql(initialValueForThirdParties)
      expect(logs[2].args._managers).to.be.eql(thirdParty2[3])
      expect(logs[2].args._itemSlots).to.be.eq.BN(thirdParty2Slots)
      expect(logs[2].args._sender).to.be.eql(thirdPartyAggregator)

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
      expect(thirdParty.maxItems).to.be.eq.BN(thirdParty1Slots)
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
      expect(thirdParty.maxItems).to.be.eq.BN(thirdParty2Slots)
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
        0,
      ]

      await assertRevert(
        thirdPartyRegistryContract.addThirdParties(
          [thirdPartyToBeAdded],
          fromThirdPartyAggregator
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
        0,
      ]

      await assertRevert(
        thirdPartyRegistryContract.addThirdParties(
          [thirdPartyToBeAdded],
          fromThirdPartyAggregator
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
        0,
      ]

      await assertRevert(
        thirdPartyRegistryContract.addThirdParties(
          [thirdPartyToBeAdded],
          fromThirdPartyAggregator
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
        0,
      ]

      await assertRevert(
        thirdPartyRegistryContract.addThirdParties(
          [thirdPartyToBeAdded],
          fromThirdPartyAggregator
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
        0,
      ]

      const thirdPartyToBeAdded2 = [
        'urn:decentraland:matic:ext-thirdparty1',
        'tp:1:third party 2: the third party 2 desc',
        'https://api.thirdparty2.com/v1/',
        [manager],
        [],
        0,
      ]

      await thirdPartyRegistryContract.addThirdParties(
        [thirdPartyToBeAdded1],
        fromThirdPartyAggregator
      )

      await assertRevert(
        thirdPartyRegistryContract.addThirdParties(
          [thirdPartyToBeAdded2],
          fromThirdPartyAggregator
        ),
        'TPR#addThirdParties: THIRD_PARTY_ALREADY_ADDED'
      )
    })

    it('reverts when trying to add a third party by hacker', async function () {
      await assertRevert(
        thirdPartyRegistryContract.addThirdParties([thirdParty1], fromHacker),
        'TPR#onlyThirdPartyAggregator: SENDER_IS_NOT_THE_PARTY_AGGREGATOR'
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
                {
                  internalType: 'uint256',
                  name: 'slots',
                  type: 'uint256',
                },
              ],
              internalType: 'struct ThirdPartyRegistryV2.ThirdPartyParam[]',
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
        fromThirdPartyAggregator
      )

      updatedThirdParty1 = [
        thirdParty1[0],
        'tp:1:updated third party 1: the third party 1 updated desc',
        'https://api.thirdparty1.com/v2/',
        [anotherManager],
        [true],
        0,
      ]

      updatedThirdParty2 = [
        thirdParty2[0],
        'tp:1:updated third party 2: the third party 2 desc updated',
        'https://api.thirdparty2.com/v2/',
        [],
        [],
        0,
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
      expect(logs[0].args._itemSlots).to.be.eq.BN(updatedThirdParty1[5])
      expect(logs[0].args._sender).to.be.eql(manager)

      expect(logs[1].event).to.be.equal('ThirdPartyUpdated')
      expect(logs[1].args._thirdPartyId).to.be.eql(updatedThirdParty2[0])
      expect(logs[1].args._metadata).to.be.eql(updatedThirdParty2[1])
      expect(logs[1].args._resolver).to.be.eql(updatedThirdParty2[2])
      expect(logs[1].args._managers).to.be.eql(updatedThirdParty2[3])
      expect(logs[1].args._managerValues).to.be.eql(updatedThirdParty2[4])
      expect(logs[1].args._itemSlots).to.be.eq.BN(updatedThirdParty2[5])
      expect(logs[1].args._sender).to.be.eql(manager)

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
        fromThirdPartyAggregator
      )

      expect(logs.length).to.be.equal(2)

      expect(logs[0].event).to.be.equal('ThirdPartyUpdated')
      expect(logs[0].args._thirdPartyId).to.be.eql(updatedThirdParty1[0])
      expect(logs[0].args._metadata).to.be.eql(updatedThirdParty1[1])
      expect(logs[0].args._resolver).to.be.eql(updatedThirdParty1[2])
      expect(logs[0].args._managers).to.be.eql(updatedThirdParty1[3])
      expect(logs[0].args._managerValues).to.be.eql(updatedThirdParty1[4])
      expect(logs[0].args._itemSlots).to.be.eq.BN(updatedThirdParty1[5])
      expect(logs[0].args._sender).to.be.eql(thirdPartyAggregator)

      expect(logs[1].event).to.be.equal('ThirdPartyUpdated')
      expect(logs[1].args._thirdPartyId).to.be.eql(updatedThirdParty2[0])
      expect(logs[1].args._metadata).to.be.eql(updatedThirdParty2[1])
      expect(logs[1].args._resolver).to.be.eql(updatedThirdParty2[2])
      expect(logs[1].args._managers).to.be.eql(updatedThirdParty2[3])
      expect(logs[1].args._managerValues).to.be.eql(updatedThirdParty2[4])
      expect(logs[1].args._itemSlots).to.be.eq.BN(updatedThirdParty2[5])
      expect(logs[1].args._sender).to.be.eql(thirdPartyAggregator)

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
                {
                  internalType: 'uint256',
                  name: 'slots',
                  type: 'uint256',
                },
              ],
              internalType: 'struct ThirdPartyRegistryV2.ThirdPartyParam[]',
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
      expect(logs[1].args._itemSlots).to.be.eq.BN(updatedThirdParty1[5])
      expect(logs[1].args._sender).to.be.eql(manager)

      expect(logs[2].event).to.be.equal('ThirdPartyUpdated')
      expect(logs[2].args._thirdPartyId).to.be.eql(updatedThirdParty2[0])
      expect(logs[2].args._metadata).to.be.eql(updatedThirdParty2[1])
      expect(logs[2].args._resolver).to.be.eql(updatedThirdParty2[2])
      expect(logs[2].args._managers).to.be.eql(updatedThirdParty2[3])
      expect(logs[2].args._managerValues).to.be.eql(updatedThirdParty2[4])
      expect(logs[2].args._itemSlots).to.be.eq.BN(updatedThirdParty2[5])
      expect(logs[2].args._sender).to.be.eql(manager)

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
        0,
      ]

      let thirdPartiesCount =
        await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      const { logs } = await thirdPartyRegistryContract.updateThirdParties(
        [updatedThirdParty1],
        fromThirdPartyAggregator
      )

      expect(logs.length).to.be.equal(1)

      expect(logs[0].event).to.be.equal('ThirdPartyUpdated')
      expect(logs[0].args._thirdPartyId).to.be.eql(updatedThirdParty1[0])
      expect(logs[0].args._metadata).to.be.eql(updatedThirdParty1[1])
      expect(logs[0].args._resolver).to.be.eql(thirdParty1[2])
      expect(logs[0].args._managers).to.be.eql(updatedThirdParty1[3])
      expect(logs[0].args._managerValues).to.be.eql(updatedThirdParty1[4])
      expect(logs[0].args._itemSlots).to.be.eq.BN(updatedThirdParty1[5])
      expect(logs[0].args._sender).to.be.eql(thirdPartyAggregator)

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
        0,
      ]

      let thirdPartiesCount =
        await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      const { logs } = await thirdPartyRegistryContract.updateThirdParties(
        [updatedThirdParty1],
        fromThirdPartyAggregator
      )

      expect(logs.length).to.be.equal(1)

      expect(logs[0].event).to.be.equal('ThirdPartyUpdated')
      expect(logs[0].args._thirdPartyId).to.be.eql(updatedThirdParty1[0])
      expect(logs[0].args._metadata).to.be.eql(thirdParty1[1])
      expect(logs[0].args._resolver).to.be.eql(updatedThirdParty1[2])
      expect(logs[0].args._managers).to.be.eql(updatedThirdParty1[3])
      expect(logs[0].args._managerValues).to.be.eql(updatedThirdParty1[4])
      expect(logs[0].args._itemSlots).to.be.eq.BN(updatedThirdParty1[5])
      expect(logs[0].args._sender).to.be.eql(thirdPartyAggregator)

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
      updatedThirdParty1 = [thirdParty1[0], '', '', [anotherManager], [true], 0]

      let thirdPartiesCount =
        await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      const { logs } = await thirdPartyRegistryContract.updateThirdParties(
        [updatedThirdParty1],
        fromThirdPartyAggregator
      )

      expect(logs.length).to.be.equal(1)

      expect(logs[0].event).to.be.equal('ThirdPartyUpdated')
      expect(logs[0].args._thirdPartyId).to.be.eql(updatedThirdParty1[0])
      expect(logs[0].args._metadata).to.be.eql(thirdParty1[1])
      expect(logs[0].args._resolver).to.be.eql(thirdParty1[2])
      expect(logs[0].args._managers).to.be.eql(updatedThirdParty1[3])
      expect(logs[0].args._managerValues).to.be.eql(updatedThirdParty1[4])
      expect(logs[0].args._itemSlots).to.be.eq.BN(updatedThirdParty1[5])
      expect(logs[0].args._sender).to.be.eql(thirdPartyAggregator)

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
      updatedThirdParty1 = [thirdParty1[0], '', '', [manager], [false], 0]

      let thirdPartiesCount =
        await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      const { logs } = await thirdPartyRegistryContract.updateThirdParties(
        [updatedThirdParty1],
        fromThirdPartyAggregator
      )

      expect(logs.length).to.be.equal(1)

      expect(logs[0].event).to.be.equal('ThirdPartyUpdated')
      expect(logs[0].args._thirdPartyId).to.be.eql(updatedThirdParty1[0])
      expect(logs[0].args._metadata).to.be.eql(thirdParty1[1])
      expect(logs[0].args._resolver).to.be.eql(thirdParty1[2])
      expect(logs[0].args._managers).to.be.eql(updatedThirdParty1[3])
      expect(logs[0].args._managerValues).to.be.eql(updatedThirdParty1[4])
      expect(logs[0].args._itemSlots).to.be.eq.BN(updatedThirdParty1[5])
      expect(logs[0].args._sender).to.be.eql(thirdPartyAggregator)

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

    it('should increase maxItems when slots is > 0 and caller is the aggregator', async function () {
      updatedThirdParty1[5] = slotsToAddOrBuy

      let response = await thirdPartyRegistryContract.updateThirdParties(
        [updatedThirdParty1],
        fromThirdPartyAggregator
      )

      let logs = response.logs

      expect(logs.length).to.be.equal(1)

      expect(logs[0].event).to.be.equal('ThirdPartyUpdated')
      expect(logs[0].args._thirdPartyId).to.be.eql(updatedThirdParty1[0])
      expect(logs[0].args._metadata).to.be.eql(updatedThirdParty1[1])
      expect(logs[0].args._resolver).to.be.eql(updatedThirdParty1[2])
      expect(logs[0].args._managers).to.be.eql(updatedThirdParty1[3])
      expect(logs[0].args._managerValues).to.be.eql(updatedThirdParty1[4])
      expect(logs[0].args._itemSlots).to.be.eq.BN(slotsToAddOrBuy)
      expect(logs[0].args._sender).to.be.eql(thirdPartyAggregator)

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(updatedThirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(updatedThirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

      response = await thirdPartyRegistryContract.updateThirdParties(
        [updatedThirdParty1],
        fromThirdPartyAggregator
      )

      logs = response.logs

      expect(logs.length).to.be.equal(1)

      expect(logs[0].event).to.be.equal('ThirdPartyUpdated')
      expect(logs[0].args._thirdPartyId).to.be.eql(updatedThirdParty1[0])
      expect(logs[0].args._metadata).to.be.eql(updatedThirdParty1[1])
      expect(logs[0].args._resolver).to.be.eql(updatedThirdParty1[2])
      expect(logs[0].args._managers).to.be.eql(updatedThirdParty1[3])
      expect(logs[0].args._managerValues).to.be.eql(updatedThirdParty1[4])
      expect(logs[0].args._itemSlots).to.be.eq.BN(slotsToAddOrBuy)
      expect(logs[0].args._sender).to.be.eql(thirdPartyAggregator)

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])

      expect(thirdParty.metadata).to.be.eql(updatedThirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(updatedThirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy * 2)
      expect(thirdParty.registered).to.be.eq.BN(1)
    })

    it('reverts when trying to update third parties without id', async function () {
      const thirdPartyToBeUpdated = [
        '',
        'tp:1:third party 1: the third party 1 desc',
        'https://api.thirdparty1.com/v1/',
        [manager],
        [true],
        0,
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
        0,
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
        0,
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
        'TPR#updateThirdParties: SENDER_IS_NOT_MANAGER_OR_THIRD_PARTY_AGGREGATOR'
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
                {
                  internalType: 'uint256',
                  name: 'slots',
                  type: 'uint256',
                },
              ],
              internalType: 'struct ThirdPartyRegistryV2.ThirdPartyParam[]',
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

    it('reverts when updating slots and not being an aggregator', async function () {
      updatedThirdParty1[5] = 10

      await assertRevert(
        thirdPartyRegistryContract.updateThirdParties(
          [updatedThirdParty1],
          fromManager
        ),
        'TPR#updateThirdParties: SENDER_IS_NOT_THIRD_PARTY_AGGREGATOR'
      )
    })
  })

  describe('buyItemSlots', function () {
    beforeEach(async () => {
      await thirdPartyRegistryContract.addThirdParties(
        [thirdParty1, thirdParty2],
        fromThirdPartyAggregator
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
      expect(logs[0].args._sender).to.be.eql(user)

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
      expect(logs[0].args._sender).to.be.eql(user)

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
      expect(logs[1].args._sender).to.be.eql(user)

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
      expect(logs[1].args._sender).to.be.eql(user)

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

      const ThirdPartyRegistryV2Factory = await ethers.getContractFactory(
        'ThirdPartyRegistryV2'
      )

      const proxy = await upgrades.deployProxy(ThirdPartyRegistryV2Factory, [
        owner,
        thirdPartyAggregator,
        collector,
        committeeContract.address,
        manaContract.address,
        oracleContract.address,
        oneEther.toString(),
      ])

      thirdPartyRegistryContract = await ThirdPartyRegistryV2.at(proxy.address)

      await thirdPartyRegistryContract.addThirdParties(
        [thirdParty1],
        fromThirdPartyAggregator
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

  describe('reviewThirdParties', function () {
    beforeEach(async () => {
      await thirdPartyRegistryContract.addThirdParties(
        [thirdParty1, thirdParty2],
        fromThirdPartyAggregator
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

      // Third Party 2
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(1)
      expect(thirdPartyId).to.be.eql(thirdParty2[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty2[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty2[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty2[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

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
      expect(logs[0].args._sender).to.be.eql(committeeMember)

      expect(logs[1].event).to.be.equal('ThirdPartyReviewed')
      expect(logs[1].args._thirdPartyId).to.be.eql(thirdParty2[0])
      expect(logs[1].args._value).to.be.eql(false)
      expect(logs[1].args._sender).to.be.eql(committeeMember)

      // Third Party 1
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(false)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

      // Third Party 2
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(1)
      expect(thirdPartyId).to.be.eql(thirdParty2[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty2[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty2[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty2[2])
      expect(thirdParty.isApproved).to.be.eql(false)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)
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

      // Third Party 2
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(1)
      expect(thirdPartyId).to.be.eql(thirdParty2[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty2[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty2[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty2[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

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
                  internalType: 'struct ThirdPartyRegistryV2.ItemReviewParam[]',
                  name: 'items',
                  type: 'tuple[]',
                },
              ],
              internalType:
                'struct ThirdPartyRegistryV2.ThirdPartyReviewParam[]',
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
      expect(logs[1].args._sender).to.be.eql(committeeMember)

      expect(logs[2].event).to.be.equal('ThirdPartyReviewed')
      expect(logs[2].args._thirdPartyId).to.be.eql(thirdParty2[0])
      expect(logs[2].args._value).to.be.eql(false)
      expect(logs[2].args._sender).to.be.eql(committeeMember)

      // Third Party 1
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(false)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)

      // Third Party 2
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(1)
      expect(thirdPartyId).to.be.eql(thirdParty2[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty2[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty2[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty2[2])
      expect(thirdParty.isApproved).to.be.eql(false)
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)
      expect(thirdParty.registered).to.be.eq.BN(1)
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
        'TPR#onlyCommittee: SENDER_IS_NOT_A_COMMITTEE_MEMBER'
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
        'TPR#onlyCommittee: SENDER_IS_NOT_A_COMMITTEE_MEMBER'
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

  describe('reviewThirdPartyWithRoot', function () {
    beforeEach(async function () {
      await thirdPartyRegistryContract.addThirdParties(
        [thirdParty1],
        fromThirdPartyAggregator
      )
    })

    it('should review a third party :: no slots consumption', async function () {
      const { logs } =
        await thirdPartyRegistryContract.reviewThirdPartyWithRoot(
          thirdParty1[0],
          dummyBytes32,
          [],
          fromCommitteeMember
        )

      expect(logs.length).to.be.equal(1)

      expect(logs[0].event).to.be.equal('ThirdPartyReviewedWithRoot')
      expect(logs[0].args._thirdPartyId).to.be.equal(thirdParty1[0])
      expect(logs[0].args._root).to.be.equal(dummyBytes32)
      expect(logs[0].args._isApproved).to.be.equal(true)
      expect(logs[0].args._sender).to.be.equal(committeeMember)

      const thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.root).to.be.equal(dummyBytes32)
      expect(thirdParty.isApproved).to.be.equal(true)
    })

    it('should review a third party :: with slots consumption :: one signature', async function () {
      const qty = 10

      await thirdPartyRegistryContract.updateThirdParties(
        [[thirdParty1[0], '', '', [], [], qty]],
        fromThirdPartyAggregator
      )

      let tp = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])

      expect(tp.root).to.be.equal(zeroBytes32)
      expect(tp.isApproved).to.be.equal(true)
      expect(tp.consumedSlots).to.be.eq.BN(0)

      const sig = await getSignature(
        thirdPartyRegistryContract,
        thirdParty1[0],
        qty,
        dummyBytes32,
        manager,
        domain,
        version
      )

      const { logs } =
        await thirdPartyRegistryContract.reviewThirdPartyWithRoot(
          thirdParty1[0],
          dummyBytes32,
          [[qty, dummyBytes32, sig.r, sig.s, sig.v]],
          fromCommitteeMember
        )

      tp = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])

      expect(tp.root).to.be.equal(dummyBytes32)
      expect(tp.isApproved).to.be.equal(true)
      expect(tp.consumedSlots).to.be.eq.BN(qty)

      expect(logs.length).to.be.equal(2)

      expect(logs[0].event).to.be.equal('ItemSlotsConsumed')
      expect(logs[0].args._thirdPartyId).to.be.equal(thirdParty1[0])
      expect(logs[0].args._qty).to.be.eq.BN(qty)
      expect(logs[0].args._signer).to.be.equal(manager)
      expect(logs[0].args._sender).to.be.equal(committeeMember)
      expect(logs[0].args._messageHash).to.be.equal(
        await getMessageHash(
          domain,
          version,
          thirdParty1[0],
          qty,
          dummyBytes32,
          thirdPartyRegistryContract
        )
      )

      expect(logs[1].event).to.be.equal('ThirdPartyReviewedWithRoot')
      expect(logs[1].args._thirdPartyId).to.be.equal(thirdParty1[0])
      expect(logs[1].args._root).to.be.eq.BN(dummyBytes32)
      expect(logs[1].args._isApproved).to.be.equal(true)
      expect(logs[1].args._sender).to.be.equal(committeeMember)
    })

    it('should review a third party :: with slots consumption :: multiple signatures', async function () {
      const qty1 = 10
      const qty2 = 20
      const qty3 = 30

      const total = qty1 + qty2 + qty3

      await thirdPartyRegistryContract.updateThirdParties(
        [[thirdParty1[0], '', '', [], [], total]],
        fromThirdPartyAggregator
      )

      let tp = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])

      expect(tp.root).to.be.equal(zeroBytes32)
      expect(tp.isApproved).to.be.equal(true)
      expect(tp.consumedSlots).to.be.eq.BN(0)

      const _getSignature = (qty) =>
        getSignature(
          thirdPartyRegistryContract,
          thirdParty1[0],
          qty,
          dummyBytes32,
          manager,
          domain,
          version
        )

      const sig1 = await _getSignature(qty1)
      const sig2 = await _getSignature(qty2)
      const sig3 = await _getSignature(qty3)

      const { logs } =
        await thirdPartyRegistryContract.reviewThirdPartyWithRoot(
          thirdParty1[0],
          dummyBytes32,
          [
            [qty1, dummyBytes32, sig1.r, sig1.s, sig1.v],
            [qty2, dummyBytes32, sig2.r, sig2.s, sig2.v],
            [qty3, dummyBytes32, sig3.r, sig3.s, sig3.v],
          ],
          fromCommitteeMember
        )

      tp = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])

      expect(tp.root).to.be.equal(dummyBytes32)
      expect(tp.isApproved).to.be.equal(true)
      expect(tp.consumedSlots).to.be.eq.BN(total)

      expect(logs.length).to.be.equal(4)

      const assertConsumeLog = async (log, qty) => {
        expect(log.event).to.be.equal('ItemSlotsConsumed')
        expect(log.args._thirdPartyId).to.be.equal(thirdParty1[0])
        expect(log.args._qty).to.be.eq.BN(qty)
        expect(log.args._signer).to.be.equal(manager)
        expect(log.args._sender).to.be.equal(committeeMember)
        expect(log.args._messageHash).to.be.equal(
          await getMessageHash(
            domain,
            version,
            thirdParty1[0],
            qty,
            dummyBytes32,
            thirdPartyRegistryContract
          )
        )
      }

      await assertConsumeLog(logs[0], qty1)
      await assertConsumeLog(logs[1], qty2)
      await assertConsumeLog(logs[2], qty3)

      expect(logs[3].event).to.be.equal('ThirdPartyReviewedWithRoot')
      expect(logs[3].args._thirdPartyId).to.be.equal(thirdParty1[0])
      expect(logs[3].args._root).to.be.eq.BN(dummyBytes32)
      expect(logs[3].args._isApproved).to.be.equal(true)
      expect(logs[3].args._sender).to.be.equal(committeeMember)
    })

    it('should review a third party :: with slots consumption :: multiple signatures :: Relayed EIP721', async function () {
      const qty1 = 10
      const qty2 = 20
      const qty3 = 30

      const total = qty1 + qty2 + qty3

      await thirdPartyRegistryContract.updateThirdParties(
        [[thirdParty1[0], '', '', [], [], total]],
        fromThirdPartyAggregator
      )

      let tp = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])

      expect(tp.root).to.be.equal(zeroBytes32)
      expect(tp.isApproved).to.be.equal(true)
      expect(tp.consumedSlots).to.be.eq.BN(0)

      const _getSignature = (qty) =>
        getSignature(
          thirdPartyRegistryContract,
          thirdParty1[0],
          qty,
          dummyBytes32,
          manager,
          domain,
          version
        )

      const sig1 = await _getSignature(qty1)
      const sig2 = await _getSignature(qty2)
      const sig3 = await _getSignature(qty3)

      const functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'string',
              name: '_thirdPartyId',
              type: 'string',
            },
            {
              internalType: 'bytes32',
              name: '_root',
              type: 'bytes32',
            },
            {
              components: [
                {
                  internalType: 'uint256',
                  name: 'qty',
                  type: 'uint256',
                },
                {
                  internalType: 'bytes32',
                  name: 'salt',
                  type: 'bytes32',
                },
                {
                  internalType: 'bytes32',
                  name: 'sigR',
                  type: 'bytes32',
                },
                {
                  internalType: 'bytes32',
                  name: 'sigS',
                  type: 'bytes32',
                },
                {
                  internalType: 'uint8',
                  name: 'sigV',
                  type: 'uint8',
                },
              ],
              internalType: 'struct ThirdPartyRegistryV2.ConsumeSlotsParam[]',
              name: '_consumeSlotsParams',
              type: 'tuple[]',
            },
          ],
          name: 'reviewThirdPartyWithRoot',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [
          thirdParty1[0],
          dummyBytes32,
          [
            [qty1, dummyBytes32, sig1.r, sig1.s, sig1.v],
            [qty2, dummyBytes32, sig2.r, sig2.s, sig2.v],
            [qty3, dummyBytes32, sig3.r, sig3.s, sig3.v],
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

      tp = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])

      expect(tp.root).to.be.equal(dummyBytes32)
      expect(tp.isApproved).to.be.equal(true)
      expect(tp.consumedSlots).to.be.eq.BN(total)

      expect(logs.length).to.be.equal(5)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(committeeMember)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      const assertConsumeLog = async (log, qty) => {
        expect(log.event).to.be.equal('ItemSlotsConsumed')
        expect(log.args._thirdPartyId).to.be.equal(thirdParty1[0])
        expect(log.args._qty).to.be.eq.BN(qty)
        expect(log.args._signer).to.be.equal(manager)
        expect(log.args._sender).to.be.equal(committeeMember)
        expect(log.args._messageHash).to.be.equal(
          await getMessageHash(
            domain,
            version,
            thirdParty1[0],
            qty,
            dummyBytes32,
            thirdPartyRegistryContract
          )
        )
      }

      await assertConsumeLog(logs[1], qty1)
      await assertConsumeLog(logs[2], qty2)
      await assertConsumeLog(logs[3], qty3)

      expect(logs[4].event).to.be.equal('ThirdPartyReviewedWithRoot')
      expect(logs[4].args._thirdPartyId).to.be.equal(thirdParty1[0])
      expect(logs[4].args._root).to.be.eq.BN(dummyBytes32)
      expect(logs[4].args._isApproved).to.be.equal(true)
      expect(logs[4].args._sender).to.be.equal(committeeMember)
    })

    it('reverts when root is invalid', async function () {
      await assertRevert(
        thirdPartyRegistryContract.reviewThirdPartyWithRoot(
          thirdParty1[0],
          zeroBytes32,
          [],
          fromCommitteeMember
        ),
        'TPR#reviewThirdPartyWithRoot: INVALID_ROOT'
      )
    })

    it('reverts when sender is not from commitee', async function () {
      await assertRevert(
        thirdPartyRegistryContract.reviewThirdPartyWithRoot(
          thirdParty1[0],
          dummyBytes32,
          [],
          fromUser
        ),
        'TPR#onlyCommittee: SENDER_IS_NOT_A_COMMITTEE_MEMBER'
      )
    })

    it('reverts when third party is not registered', async function () {
      await assertRevert(
        thirdPartyRegistryContract.reviewThirdPartyWithRoot(
          thirdParty2[0],
          dummyBytes32,
          [],
          fromCommitteeMember
        ),
        'TPR#_checkThirdParty: INVALID_THIRD_PARTY'
      )
    })
  })

  describe('consumeSlots', function () {
    beforeEach(async function () {
      await thirdPartyRegistryContract.addThirdParties(
        [thirdParty1],
        fromThirdPartyAggregator
      )
    })

    it('should do nothing if no consume slots params are provided', async function () {
      let tp = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])

      const consumedSlots = tp.consumeSlots

      const { logs } = await thirdPartyRegistryContract.consumeSlots(
        thirdParty1[0],
        [],
        fromCommitteeMember
      )

      tp = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])

      expect(logs.length).to.be.equal(0)
      expect(tp.consumeSlots).to.be.eq.BN(consumedSlots)
    })

    it('should update the third party and log events for each consume slots params', async function () {
      const qty1 = 10
      const qty2 = 20
      const qty3 = 30

      const total = qty1 + qty2 + qty3

      await thirdPartyRegistryContract.updateThirdParties(
        [[thirdParty1[0], '', '', [], [], total]],
        fromThirdPartyAggregator
      )

      let tp = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])
      expect(tp.consumedSlots).to.be.eq.BN(0)

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(0)

      const _getSignature = (qty) =>
        getSignature(
          thirdPartyRegistryContract,
          thirdParty1[0],
          qty,
          dummyBytes32,
          manager,
          domain,
          version
        )

      const sig1 = await _getSignature(qty1)
      const sig2 = await _getSignature(qty2)
      const sig3 = await _getSignature(qty3)

      const { logs } = await thirdPartyRegistryContract.consumeSlots(
        thirdParty1[0],
        [
          [qty1, dummyBytes32, sig1.r, sig1.s, sig1.v],
          [qty2, dummyBytes32, sig2.r, sig2.s, sig2.v],
          [qty3, dummyBytes32, sig3.r, sig3.s, sig3.v],
        ],
        fromCommitteeMember
      )

      expect(logs.length).to.be.equal(3)

      const assertLogs = async (log, qty) => {
        expect(log.event).to.be.equal('ItemSlotsConsumed')
        expect(log.args._thirdPartyId).to.be.equal(thirdParty1[0])
        expect(log.args._qty).to.be.eq.BN(qty)
        expect(log.args._signer).to.be.equal(manager)
        expect(log.args._sender).to.be.equal(committeeMember)
        expect(log.args._messageHash).to.be.equal(
          await getMessageHash(
            domain,
            version,
            thirdParty1[0],
            qty,
            dummyBytes32,
            thirdPartyRegistryContract
          )
        )
      }

      await assertLogs(logs[0], qty1)
      await assertLogs(logs[1], qty2)
      await assertLogs(logs[2], qty3)

      tp = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])
      expect(tp.consumedSlots).to.be.eq.BN(total)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty1[0])
      expect(itemsCount).to.be.eq.BN(total)
    })

    it('should update the third party and log events for each consume slots params :: Relayed EIP721', async function () {
      const qty1 = 10
      const qty2 = 20
      const qty3 = 30

      const total = qty1 + qty2 + qty3

      await thirdPartyRegistryContract.updateThirdParties(
        [[thirdParty1[0], '', '', [], [], total]],
        fromThirdPartyAggregator
      )

      let tp = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])
      expect(tp.consumedSlots).to.be.eq.BN(0)

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(0)

      const _getSignature = (qty) =>
        getSignature(
          thirdPartyRegistryContract,
          thirdParty1[0],
          qty,
          dummyBytes32,
          manager,
          domain,
          version
        )

      const sig1 = await _getSignature(qty1)
      const sig2 = await _getSignature(qty2)
      const sig3 = await _getSignature(qty3)

      const functionSignature = web3.eth.abi.encodeFunctionCall(
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
                  internalType: 'uint256',
                  name: 'qty',
                  type: 'uint256',
                },
                {
                  internalType: 'bytes32',
                  name: 'salt',
                  type: 'bytes32',
                },
                {
                  internalType: 'bytes32',
                  name: 'sigR',
                  type: 'bytes32',
                },
                {
                  internalType: 'bytes32',
                  name: 'sigS',
                  type: 'bytes32',
                },
                {
                  internalType: 'uint8',
                  name: 'sigV',
                  type: 'uint8',
                },
              ],
              internalType: 'struct ThirdPartyRegistryV2.ConsumeSlotsParam[]',
              name: '_consumeSlotsParams',
              type: 'tuple[]',
            },
          ],
          name: 'consumeSlots',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [
          thirdParty1[0],
          [
            [qty1, dummyBytes32, sig1.r, sig1.s, sig1.v],
            [qty2, dummyBytes32, sig2.r, sig2.s, sig2.v],
            [qty3, dummyBytes32, sig3.r, sig3.s, sig3.v],
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

      expect(logs.length).to.be.equal(4)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(committeeMember)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      const assertLogs = async (log, qty) => {
        expect(log.event).to.be.equal('ItemSlotsConsumed')
        expect(log.args._thirdPartyId).to.be.equal(thirdParty1[0])
        expect(log.args._qty).to.be.eq.BN(qty)
        expect(log.args._signer).to.be.equal(manager)
        expect(log.args._sender).to.be.equal(committeeMember)
        expect(log.args._messageHash).to.be.equal(
          await getMessageHash(
            domain,
            version,
            thirdParty1[0],
            qty,
            dummyBytes32,
            thirdPartyRegistryContract
          )
        )
      }

      await assertLogs(logs[1], qty1)
      await assertLogs(logs[2], qty2)
      await assertLogs(logs[3], qty3)

      tp = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])
      expect(tp.consumedSlots).to.be.eq.BN(total)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty1[0])
      expect(itemsCount).to.be.eq.BN(total)
    })

    it('reverts when the only consume slots param qty is 0', async function () {
      await assertRevert(
        thirdPartyRegistryContract.consumeSlots(
          thirdParty1[0],
          [[0, dummyBytes32, dummyBytes32, dummyBytes32, 0]],
          fromCommitteeMember
        ),
        'TPR#_consumeSlots: INVALID_QTY'
      )
    })

    it('reverts when the third party is not registered', async function () {
      await assertRevert(
        thirdPartyRegistryContract.consumeSlots(
          thirdParty2[0],
          [],
          fromCommitteeMember
        ),
        'TPR#_checkThirdParty: INVALID_THIRD_PARTY'
      )
    })

    it('reverts when the third party has no slots available', async function () {
      await assertRevert(
        thirdPartyRegistryContract.consumeSlots(
          thirdParty1[0],
          [[10, dummyBytes32, dummyBytes32, dummyBytes32, 0]],
          fromCommitteeMember
        ),
        'TPR#_consumeSlots: NO_ITEM_SLOTS_AVAILABLE'
      )
    })

    it('reverts when the caller is not a committee member', async function () {
      await assertRevert(
        thirdPartyRegistryContract.consumeSlots(thirdParty1[0], [], fromUser),
        'TPR#onlyCommittee: SENDER_IS_NOT_A_COMMITTEE_MEMBER'
      )
    })

    it('reverts when the message was already processed', async function () {
      await thirdPartyRegistryContract.updateThirdParties(
        [[thirdParty1[0], '', '', [], [], slotsToAddOrBuy * 2]],
        fromThirdPartyAggregator
      )

      const { r, s, v } = await getSignature(
        thirdPartyRegistryContract,
        thirdParty1[0],
        slotsToAddOrBuy,
        dummyBytes32,
        manager,
        domain,
        version
      )

      thirdPartyRegistryContract.consumeSlots(
        thirdParty1[0],
        [[slotsToAddOrBuy, dummyBytes32, r, s, v]],
        fromCommitteeMember
      )

      await assertRevert(
        thirdPartyRegistryContract.consumeSlots(
          thirdParty1[0],
          [[slotsToAddOrBuy, dummyBytes32, r, s, v]],
          fromCommitteeMember
        ),
        'TPR#_consumeSlots: MESSAGE_ALREADY_PROCESSED'
      )
    })

    it('reverts when the signer is not a manager', async function () {
      await thirdPartyRegistryContract.updateThirdParties(
        [[thirdParty1[0], '', '', [], [], slotsToAddOrBuy]],
        fromThirdPartyAggregator
      )

      const { r, s, v } = await getSignature(
        thirdPartyRegistryContract,
        thirdParty1[0],
        slotsToAddOrBuy,
        dummyBytes32,
        user,
        domain,
        version
      )

      await assertRevert(
        thirdPartyRegistryContract.consumeSlots(
          thirdParty1[0],
          [[slotsToAddOrBuy, dummyBytes32, r, s, v]],
          fromCommitteeMember
        ),
        'TPR#_consumeSlots: INVALID_SIGNER'
      )
    })
  })

  describe('setRules', function () {
    it('should update rules mapping of a third party', async function () {
      const rule1 = 'a'
      const rule2 = 'b'
      const rule3 = 'c'

      await thirdPartyRegistryContract.addThirdParties(
        [thirdParty1],
        fromThirdPartyAggregator
      )

      const getRuleValue = (rule) =>
        thirdPartyRegistryContract.getRuleValue(thirdParty1[0], rule)

      let rule1Val = await getRuleValue(rule1)
      let rule2Val = await getRuleValue(rule2)
      let rule3Val = await getRuleValue(rule3)

      expect(rule1Val).to.be.equal(false)
      expect(rule2Val).to.be.equal(false)
      expect(rule3Val).to.be.equal(false)

      let response = await thirdPartyRegistryContract.setRules(
        thirdParty1[0],
        [rule1, rule2, rule3],
        [true, true, true],
        fromCommitteeMember
      )

      let logs = response.logs

      expect(logs.length).to.be.equal(3)

      const assertLog = (log, rule, value) => {
        expect(log.event).to.be.equal('ThirdPartyRuleAdded')
        expect(log.args._thirdPartyId).to.be.equal(thirdParty1[0])
        expect(log.args._rule).to.be.equal(rule)
        expect(log.args._value).to.be.equal(value)
        expect(log.args._sender).to.be.equal(committeeMember)
      }

      assertLog(logs[0], rule1, true)
      assertLog(logs[1], rule2, true)
      assertLog(logs[2], rule3, true)

      rule1Val = await getRuleValue(rule1)
      rule2Val = await getRuleValue(rule2)
      rule3Val = await getRuleValue(rule3)

      expect(rule1Val).to.be.equal(true)
      expect(rule2Val).to.be.equal(true)
      expect(rule3Val).to.be.equal(true)

      response = await thirdPartyRegistryContract.setRules(
        thirdParty1[0],
        [rule1, rule2, rule3],
        [false, true, false],
        fromCommitteeMember
      )

      logs = response.logs

      assertLog(logs[0], rule1, false)
      assertLog(logs[1], rule2, true)
      assertLog(logs[2], rule3, false)

      rule1Val = await getRuleValue(rule1)
      rule2Val = await getRuleValue(rule2)
      rule3Val = await getRuleValue(rule3)

      expect(rule1Val).to.be.equal(false)
      expect(rule2Val).to.be.equal(true)
      expect(rule3Val).to.be.equal(false)
    })

    it('should update rules mapping of a third party :: Relayed EIP721', async function () {
      const rule1 = 'a'
      const rule2 = 'b'
      const rule3 = 'c'

      await thirdPartyRegistryContract.addThirdParties(
        [thirdParty1],
        fromThirdPartyAggregator
      )

      const getRuleValue = (rule) =>
        thirdPartyRegistryContract.getRuleValue(thirdParty1[0], rule)

      let rule1Val = await getRuleValue(rule1)
      let rule2Val = await getRuleValue(rule2)
      let rule3Val = await getRuleValue(rule3)

      expect(rule1Val).to.be.equal(false)
      expect(rule2Val).to.be.equal(false)
      expect(rule3Val).to.be.equal(false)

      let functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'string',
              name: '_thirdPartyId',
              type: 'string',
            },
            {
              internalType: 'string[]',
              name: '_rules',
              type: 'string[]',
            },
            {
              internalType: 'bool[]',
              name: '_values',
              type: 'bool[]',
            },
          ],
          name: 'setRules',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [thirdParty1[0], [rule1, rule2, rule3], [true, true, true]]
      )

      let response = await sendMetaTx(
        thirdPartyRegistryContract,
        functionSignature,
        committeeMember,
        relayer,
        null,
        domain,
        version
      )

      let logs = response.logs

      expect(logs.length).to.be.equal(4)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(committeeMember)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      const assertLog = (log, rule, value) => {
        expect(log.event).to.be.equal('ThirdPartyRuleAdded')
        expect(log.args._thirdPartyId).to.be.equal(thirdParty1[0])
        expect(log.args._rule).to.be.equal(rule)
        expect(log.args._value).to.be.equal(value)
        expect(log.args._sender).to.be.equal(committeeMember)
      }

      assertLog(logs[1], rule1, true)
      assertLog(logs[2], rule2, true)
      assertLog(logs[3], rule3, true)

      rule1Val = await getRuleValue(rule1)
      rule2Val = await getRuleValue(rule2)
      rule3Val = await getRuleValue(rule3)

      expect(rule1Val).to.be.equal(true)
      expect(rule2Val).to.be.equal(true)
      expect(rule3Val).to.be.equal(true)

      functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'string',
              name: '_thirdPartyId',
              type: 'string',
            },
            {
              internalType: 'string[]',
              name: '_rules',
              type: 'string[]',
            },
            {
              internalType: 'bool[]',
              name: '_values',
              type: 'bool[]',
            },
          ],
          name: 'setRules',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [thirdParty1[0], [rule1, rule2, rule3], [false, true, false]]
      )

      response = await sendMetaTx(
        thirdPartyRegistryContract,
        functionSignature,
        committeeMember,
        relayer,
        null,
        domain,
        version
      )

      logs = response.logs

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(committeeMember)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      assertLog(logs[1], rule1, false)
      assertLog(logs[2], rule2, true)
      assertLog(logs[3], rule3, false)

      rule1Val = await getRuleValue(rule1)
      rule2Val = await getRuleValue(rule2)
      rule3Val = await getRuleValue(rule3)

      expect(rule1Val).to.be.equal(false)
      expect(rule2Val).to.be.equal(true)
      expect(rule3Val).to.be.equal(false)
    })

    it('reverts if rules length is different from values length', async function () {
      await assertRevert(
        thirdPartyRegistryContract.setRules(
          thirdParty1[0],
          ['a', 'b', 'c'],
          [],
          fromCommitteeMember
        ),
        'TPR#setRules: LENGTH_MISMATCH'
      )

      await assertRevert(
        thirdPartyRegistryContract.setRules(
          thirdParty1[0],
          [],
          [true, false, true],
          fromCommitteeMember
        ),
        'TPR#setRules: LENGTH_MISMATCH'
      )
    })

    it('reverts if the third party is not registered', async function () {
      assertRevert(
        thirdPartyRegistryContract.setRules(
          thirdParty1[0],
          ['a', 'b', 'c'],
          [true, false, true],
          fromCommitteeMember
        ),
        'TPR#_checkThirdParty: INVALID_THIRD_PARTY'
      )
    })

    it('reverts when the sender is not a committee member', async function () {
      assertRevert(
        thirdPartyRegistryContract.setRules(
          thirdParty1[0],
          ['a', 'b', 'c'],
          [true, false, true],
          fromUser
        ),
        'TPR#onlyCommittee: SENDER_IS_NOT_A_COMMITTEE_MEMBER'
      )
    })
  })

  describe('end2end', function () {
    let tprContract

    it('should deploy the TPR contract', async function () {
      const ThirdPartyRegistryV2Factory = await ethers.getContractFactory(
        'ThirdPartyRegistryV2'
      )

      const proxy = await upgrades.deployProxy(ThirdPartyRegistryV2Factory, [
        owner,
        thirdPartyAggregator,
        collector,
        committeeContract.address,
        manaContract.address,
        chainlinkOracleContract.address,
        oneEther.toString(),
      ])

      tprContract = await ThirdPartyRegistryV2.at(proxy.address)

      await mana.setInitialBalances()
    })

    it('should add two third parties (thirdparty1 & thirdparty2)', async function () {
      let thirdPartiesCount = await tprContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(0)

      await tprContract.addThirdParties(THIRD_PARTIES, fromThirdPartyAggregator)

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
          fromThirdPartyAggregator
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
            0,
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

    it('should update thirdparty1 resolver', async function () {
      let thirdParty = await tprContract.thirdParties(THIRD_PARTIES[0][0])
      expect(thirdParty.resolver).to.be.eql(THIRD_PARTIES[0][2])

      const newResolver = 'https://new.api.thirdparty/v1'
      await tprContract.updateThirdParties(
        [[THIRD_PARTIES[0][0], THIRD_PARTIES[0][1], newResolver, [], [], 0]],
        fromAnotherManager
      )

      thirdParty = await tprContract.thirdParties(THIRD_PARTIES[0][0])
      expect(thirdParty.resolver).to.be.eql(newResolver)
    })

    it('aprove thirdparty1', async function () {
      let thirdParty = await tprContract.thirdParties(THIRD_PARTIES[0][0])
      expect(thirdParty.isApproved).to.be.equal(false)

      await tprContract.reviewThirdParties(
        [[THIRD_PARTIES[0][0], true, []]],
        fromCommitteeMember
      )

      thirdParty = await tprContract.thirdParties(THIRD_PARTIES[0][0])
      expect(thirdParty.isApproved).to.be.equal(true)
    })

    it('should buy 10 item slots more for thirdparty1', async function () {
      let thirdParty = await tprContract.thirdParties(THIRD_PARTIES[0][0])
      expect(thirdParty.maxItems).to.be.eq.BN(slotsToAddOrBuy)

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
    })

    it('reverts when trying to approve by not a committee member', async function () {
      await assertRevert(
        tprContract.reviewThirdParties(
          [[THIRD_PARTIES[0][0], true, []]],
          fromManager
        ),
        'TPR#onlyCommittee: SENDER_IS_NOT_A_COMMITTEE_MEMBER'
      )

      await assertRevert(
        tprContract.reviewThirdParties(
          [[THIRD_PARTIES[0][0], true, []]],
          fromHacker
        ),
        'TPR#onlyCommittee: SENDER_IS_NOT_A_COMMITTEE_MEMBER'
      )

      await assertRevert(
        tprContract.reviewThirdParties(
          [[THIRD_PARTIES[0][0], true, []]],
          fromUser
        ),
        'TPR#onlyCommittee: SENDER_IS_NOT_A_COMMITTEE_MEMBER'
      )
    })

    it('should aprove thirdparty1', async function () {
      let thirdParty = await tprContract.thirdParties(THIRD_PARTIES[0][0])
      expect(thirdParty.isApproved).to.be.equal(true)

      await tprContract.reviewThirdParties(
        [[THIRD_PARTIES[0][0], true, []]],
        fromCommitteeMember
      )

      thirdParty = await tprContract.thirdParties(THIRD_PARTIES[0][0])
      expect(thirdParty.isApproved).to.be.equal(true)
    })

    it('should reject thirdparty1', async function () {
      let thirdParty = await tprContract.thirdParties(THIRD_PARTIES[0][0])
      expect(thirdParty.isApproved).to.be.equal(true)

      await tprContract.reviewThirdParties(
        [[THIRD_PARTIES[0][0], false, []]],
        fromCommitteeMember
      )

      thirdParty = await tprContract.thirdParties(THIRD_PARTIES[0][0])
      expect(thirdParty.isApproved).to.be.equal(false)
    })
  })
})
