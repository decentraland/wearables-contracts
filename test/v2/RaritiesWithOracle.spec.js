import assertRevert from '../helpers/assertRevert'
import {
  RARITIES,
  getInitialRarities,
  DEFAULT_RARITY_PRICE,
  SECONDARY_RARITY_PRICE,
} from '../helpers/collectionV2'
import { sendMetaTx } from '../helpers/metaTx'

const RaritiesWithOracle = artifacts.require('RaritiesWithOracle')
const ChainlinkOracle = artifacts.require('ChainlinkOracle')
const InvalidOracle = artifacts.require('DummyInvalidOracle')
const AggregatorV3Interface = artifacts.require('DummyAggregatorV3Interface')

const { BN, toBN } = web3.utils
const expect = require('chai').use(require('bn-chai')(BN)).expect
const domain = 'Decentraland Rarities'
const version = '1'

const conversionRate = 2

const getPriceAfterRate = (price) =>
  toBN(price).div(toBN(conversionRate.toString()))

const defaultRarityPriceAfterRate = getPriceAfterRate(DEFAULT_RARITY_PRICE)
const secondaryRarityPriceAfterRate = getPriceAfterRate(SECONDARY_RARITY_PRICE)

describe('RaritiesWithOracle', function () {
  this.timeout(100000)

  // Accounts
  let accounts
  let deployer
  let user
  let hacker
  let relayer
  let creator
  let fromUser
  let fromHacker
  let fromDeployer
  let fromRelayer

  // Contracts
  let aggregatorV3interfaceContract
  let chainlinkOracleContract
  let raritiesContract

  beforeEach(async function () {
    // Create Listing environment
    accounts = await web3.eth.getAccounts()
    deployer = accounts[0]
    user = accounts[1]
    hacker = accounts[3]
    relayer = accounts[4]
    fromUser = { from: user }
    fromHacker = { from: hacker }
    fromRelayer = { from: relayer }
    fromDeployer = { from: deployer }

    aggregatorV3interfaceContract = await AggregatorV3Interface.new(
      8,
      conversionRate * 10 ** 8,
      fromDeployer
    )

    chainlinkOracleContract = await ChainlinkOracle.new(
      aggregatorV3interfaceContract.address,
      18,
      fromDeployer
    )

    raritiesContract = await RaritiesWithOracle.new(
      deployer,
      getInitialRarities(),
      chainlinkOracleContract.address,
      fromDeployer
    )
  })

  describe('initialize', function () {
    it('should be initialized with correct values', async function () {
      const contract = await RaritiesWithOracle.new(
        deployer,
        getInitialRarities(),
        chainlinkOracleContract.address
      )

      const owner = await contract.owner()
      expect(owner).to.be.equal(deployer)

      const raritiesCount = await contract.raritiesCount()
      expect(raritiesCount).to.be.eq.BN(7)

      for (let i = 0; i < raritiesCount.toNumber(); i++) {
        const rarity = await contract.rarities(i)
        expect(rarity.name).to.be.equal(RARITIES[rarity.name].name)
        expect(rarity.maxSupply).to.be.eq.BN(RARITIES[rarity.name].value)
        expect(rarity.price).to.be.eq.BN(DEFAULT_RARITY_PRICE)
      }

      const oracle = await contract.oracle()
      expect(oracle).to.be.equal(chainlinkOracleContract.address)
    })
  })

  describe('setOracle', function () {
    it('should update the oracle with the provided one', async function () {
      const newOracle = user
      const response = await raritiesContract.setOracle(newOracle, fromDeployer)

      // Check events
      const { logs } = response

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('OracleSet')
      expect(logs[0].args._oldOracle).to.be.equal(
        chainlinkOracleContract.address
      )
      expect(logs[0].args._newOracle).to.be.equal(user)

      // Check new oracle
      const oracle = await raritiesContract.oracle()
      expect(oracle).to.be.equal(newOracle)
    })

    it('should revert when the sender is not owner', async function () {
      await assertRevert(
        raritiesContract.setOracle(user, fromHacker),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('getRarityByName', function () {
    it('should get rarity', async function () {
      const raritiesCount = await raritiesContract.raritiesCount()
      expect(raritiesCount).to.be.eq.BN(7)

      for (const rarityName in RARITIES) {
        const rarity = await raritiesContract.getRarityByName(
          RARITIES[rarityName].name
        )

        expect(rarity.name).to.be.equal(RARITIES[rarityName].name)
        expect(rarity.maxSupply).to.be.eq.BN(RARITIES[rarityName].value)
        expect(rarity.price).to.be.eq.BN(defaultRarityPriceAfterRate)
      }
    })

    it('should get rarity by using special characters', async function () {
      const newRarity = ['newrarity-V2', '4', DEFAULT_RARITY_PRICE]

      await raritiesContract.addRarities([newRarity], fromDeployer)
      const inputs = [
        newRarity[0],
        'NEWRARITY-V2',
        'NewRarity-V2',
        'newrarity-v2',
      ]
      for (const input of inputs) {
        const rarity = await raritiesContract.getRarityByName(input)

        expect(rarity.name).to.be.equal(newRarity[0])
        expect(rarity.maxSupply).to.be.eq.BN(newRarity[1])
        expect(rarity.price).to.be.eq.BN(defaultRarityPriceAfterRate)
      }
    })

    it('reverts when trying to get rarity by an invalid name', async function () {
      await assertRevert(
        raritiesContract.getRarityByName('invalid'),
        'Rarities#getRarityByName: INVALID_RARITY'
      )
    })

    it('reverts when the orale performs a state mutation on getRate', async function () {
      chainlinkOracleContract = await InvalidOracle.new()

      raritiesContract = await RaritiesWithOracle.new(
        deployer,
        getInitialRarities(),
        chainlinkOracleContract.address,
        fromDeployer
      )

      await assertRevert(
        raritiesContract.getRarityByName(RARITIES.common.name),
        'Rarities#_getRateFromOracle: INVALID_RATE_FROM_ORACLE'
      )
    })
  })

  describe('addRarity', function () {
    const newRarity1 = ['newrarity1', '2', DEFAULT_RARITY_PRICE]
    const newRarity2 = ['newrarity2', '4', SECONDARY_RARITY_PRICE]

    it('should add a rarity', async function () {
      let raritiesCount = await raritiesContract.raritiesCount()
      expect(raritiesCount).to.be.eq.BN(7)

      const { logs } = await raritiesContract.addRarities(
        [newRarity1],
        fromDeployer
      )

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('AddRarity')
      expect(logs[0].args._rarity).to.be.eql(newRarity1)

      raritiesCount = await raritiesContract.raritiesCount()
      expect(raritiesCount).to.be.eq.BN(8)

      const rarity = await raritiesContract.getRarityByName(newRarity1[0])
      expect(rarity.name).to.be.equal(newRarity1[0])
      expect(rarity.maxSupply).to.be.eq.BN(newRarity1[1])
      expect(rarity.price).to.be.eq.BN(defaultRarityPriceAfterRate)
    })

    it('should add rarities', async function () {
      let raritiesCount = await raritiesContract.raritiesCount()
      expect(raritiesCount).to.be.eq.BN(7)

      const { logs } = await raritiesContract.addRarities(
        [newRarity1, newRarity2],
        fromDeployer
      )

      expect(logs.length).to.be.equal(2)
      expect(logs[0].event).to.be.equal('AddRarity')
      expect(logs[0].args._rarity).to.be.eql(newRarity1)

      expect(logs[1].event).to.be.equal('AddRarity')
      expect(logs[1].args._rarity).to.be.eql(newRarity2)

      raritiesCount = await raritiesContract.raritiesCount()
      expect(raritiesCount).to.be.eq.BN(9)

      let rarity = await raritiesContract.getRarityByName(newRarity1[0])
      expect(rarity.name).to.be.equal(newRarity1[0])
      expect(rarity.maxSupply).to.be.eq.BN(newRarity1[1])
      expect(rarity.price).to.be.eq.BN(defaultRarityPriceAfterRate)

      rarity = await raritiesContract.getRarityByName(newRarity2[0])
      expect(rarity.name).to.be.equal(newRarity2[0])
      expect(rarity.maxSupply).to.be.eq.BN(newRarity2[1])
      expect(rarity.price).to.be.eq.BN(secondaryRarityPriceAfterRate)
    })

    it('should add rarities :: Relayed EIP721', async function () {
      let raritiesCount = await raritiesContract.raritiesCount()
      expect(raritiesCount).to.be.eq.BN(7)

      const functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              components: [
                {
                  internalType: 'string',
                  name: 'name',
                  type: 'string',
                },
                {
                  internalType: 'uint256',
                  name: 'maxSupply',
                  type: 'uint256',
                },
                {
                  internalType: 'uint256',
                  name: 'price',
                  type: 'uint256',
                },
              ],
              internalType: 'struct Rarities.Rarity[]',
              name: '_rarities',
              type: 'tuple[]',
            },
          ],
          name: 'addRarities',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [[newRarity1, newRarity2]]
      )

      const { logs } = await sendMetaTx(
        raritiesContract,
        functionSignature,
        deployer,
        relayer,
        null,
        domain,
        version
      )

      expect(logs.length).to.be.equal(3)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(deployer)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      expect(logs[1].event).to.be.equal('AddRarity')
      expect(logs[1].args._rarity).to.be.eql(newRarity1)

      expect(logs[2].event).to.be.equal('AddRarity')
      expect(logs[2].args._rarity).to.be.eql(newRarity2)

      raritiesCount = await raritiesContract.raritiesCount()
      expect(raritiesCount).to.be.eq.BN(9)

      let rarity = await raritiesContract.getRarityByName(newRarity1[0])
      expect(rarity.name).to.be.equal(newRarity1[0])
      expect(rarity.maxSupply).to.be.eq.BN(newRarity1[1])
      expect(rarity.price).to.be.eq.BN(defaultRarityPriceAfterRate)

      rarity = await raritiesContract.getRarityByName(newRarity2[0])
      expect(rarity.name).to.be.equal(newRarity2[0])
      expect(rarity.maxSupply).to.be.eq.BN(newRarity2[1])
      expect(rarity.price).to.be.eq.BN(secondaryRarityPriceAfterRate)
    })

    it('should accept a rarity with a mix of characters in the name', async function () {
      const newRarity = ['newRarity-v2', '2', DEFAULT_RARITY_PRICE]

      let raritiesCount = await raritiesContract.raritiesCount()
      expect(raritiesCount).to.be.eq.BN(7)

      const { logs } = await raritiesContract.addRarities(
        [newRarity],
        fromDeployer
      )

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('AddRarity')
      expect(logs[0].args._rarity).to.be.eql(newRarity)

      raritiesCount = await raritiesContract.raritiesCount()
      expect(raritiesCount).to.be.eq.BN(8)

      const rarity = await raritiesContract.getRarityByName(newRarity[0])
      expect(rarity.name).to.be.equal(newRarity[0])
      expect(rarity.maxSupply).to.be.eq.BN(newRarity[1])
      expect(rarity.price).to.be.eq.BN(defaultRarityPriceAfterRate)
    })

    it('reverts when trying to add an already added rarity', async function () {
      await raritiesContract.addRarities([newRarity1], fromDeployer)

      await assertRevert(
        raritiesContract.addRarities([newRarity1], fromDeployer),
        'Rarities#_addRarity: RARITY_ALREADY_ADDED'
      )
    })

    it('reverts when trying to add a rarity with name greater than 32', async function () {
      const rarity = ['thetexthasmore32charactersforname', '10', '10']

      await assertRevert(
        raritiesContract.addRarities([rarity], fromDeployer),
        'Rarities#_addRarity: INVALID_LENGTH'
      )
    })

    it('reverts when trying to add a rarity with empty name', async function () {
      const rarity = ['', '10', '10']

      await assertRevert(
        raritiesContract.addRarities([rarity], fromDeployer),
        'Rarities#_addRarity: INVALID_LENGTH'
      )
    })

    it('reverts when trying to add a rarity by hacker', async function () {
      const rarity = ['rarityname', '10', '10']

      await assertRevert(
        raritiesContract.addRarities([rarity], fromHacker),
        'Ownable: caller is not the owner'
      )

      const functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              components: [
                {
                  internalType: 'string',
                  name: 'name',
                  type: 'string',
                },
                {
                  internalType: 'uint256',
                  name: 'maxSupply',
                  type: 'uint256',
                },
                {
                  internalType: 'uint256',
                  name: 'price',
                  type: 'uint256',
                },
              ],
              internalType: 'struct Rarities.Rarity[]',
              name: '_rarities',
              type: 'tuple[]',
            },
          ],
          name: 'addRarities',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [[newRarity1, newRarity2]]
      )

      await assertRevert(
        sendMetaTx(
          raritiesContract,
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

  describe('updatePrice', function () {
    const newRarity1 = ['newrarity1', '2', DEFAULT_RARITY_PRICE]
    const newRarity2 = ['newrarity-V2', '4', DEFAULT_RARITY_PRICE]

    const newPrice1 = SECONDARY_RARITY_PRICE
    const newPrice2 = '0'

    beforeEach(async () => {
      await raritiesContract.addRarities([newRarity1, newRarity2], fromDeployer)
    })

    it("should update a rarity's price", async function () {
      let rarity = await raritiesContract.getRarityByName(newRarity1[0])
      expect(rarity.name).to.be.equal(newRarity1[0])
      expect(rarity.maxSupply).to.be.eq.BN(newRarity1[1])
      expect(rarity.price).to.be.eq.BN(defaultRarityPriceAfterRate)

      const { logs } = await raritiesContract.updatePrices(
        [newRarity1[0]],
        [newPrice1]
      )

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('UpdatePrice')
      expect(logs[0].args._name).to.be.equal(newRarity1[0])
      expect(logs[0].args._price).to.be.eq.BN(newPrice1)

      rarity = await raritiesContract.getRarityByName(newRarity1[0])
      expect(rarity.name).to.be.equal(newRarity1[0])
      expect(rarity.maxSupply).to.be.eq.BN(newRarity1[1])
      expect(rarity.price).to.be.eq.BN(secondaryRarityPriceAfterRate)
    })

    it("should update rarities' prices", async function () {
      let rarity = await raritiesContract.getRarityByName(newRarity1[0])
      expect(rarity.name).to.be.equal(newRarity1[0])
      expect(rarity.maxSupply).to.be.eq.BN(newRarity1[1])
      expect(rarity.price).to.be.eq.BN(defaultRarityPriceAfterRate)

      rarity = await raritiesContract.getRarityByName(newRarity2[0])
      expect(rarity.name).to.be.equal(newRarity2[0])
      expect(rarity.maxSupply).to.be.eq.BN(newRarity2[1])
      expect(rarity.price).to.be.eq.BN(defaultRarityPriceAfterRate)

      const { logs } = await raritiesContract.updatePrices(
        [newRarity1[0], newRarity2[0]],
        [newPrice1, newPrice2]
      )

      expect(logs.length).to.be.equal(2)
      expect(logs[0].event).to.be.equal('UpdatePrice')
      expect(logs[0].args._name).to.be.equal(newRarity1[0])
      expect(logs[0].args._price).to.eq.BN(newPrice1)

      expect(logs[1].event).to.be.equal('UpdatePrice')
      expect(logs[1].args._name).to.be.equal(newRarity2[0])
      expect(logs[1].args._price).to.eq.BN(newPrice2)

      rarity = await raritiesContract.getRarityByName(newRarity1[0])
      expect(rarity.name).to.be.equal(newRarity1[0])
      expect(rarity.maxSupply).to.be.eq.BN(newRarity1[1])
      expect(rarity.price).to.be.eq.BN(secondaryRarityPriceAfterRate)

      rarity = await raritiesContract.getRarityByName(newRarity2[0])
      expect(rarity.name).to.be.equal(newRarity2[0])
      expect(rarity.maxSupply).to.be.eq.BN(newRarity2[1])
      expect(rarity.price).to.be.eq.BN(0)
    })

    it("should update rarities' prices :: Relayed EIP721", async function () {
      let rarity = await raritiesContract.getRarityByName(newRarity1[0])
      expect(rarity.name).to.be.equal(newRarity1[0])
      expect(rarity.maxSupply).to.be.eq.BN(newRarity1[1])
      expect(rarity.price).to.be.eq.BN(defaultRarityPriceAfterRate)

      rarity = await raritiesContract.getRarityByName(newRarity2[0])
      expect(rarity.name).to.be.equal(newRarity2[0])
      expect(rarity.maxSupply).to.be.eq.BN(newRarity2[1])
      expect(rarity.price).to.be.eq.BN(defaultRarityPriceAfterRate)

      const functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'string[]',
              name: '_names',
              type: 'string[]',
            },
            {
              internalType: 'uint256[]',
              name: '_prices',
              type: 'uint256[]',
            },
          ],
          name: 'updatePrices',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [
          [newRarity1[0], newRarity2[0]],
          [newPrice1, newPrice2],
        ]
      )

      const { logs } = await sendMetaTx(
        raritiesContract,
        functionSignature,
        deployer,
        relayer,
        null,
        domain,
        version
      )

      expect(logs.length).to.be.equal(3)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(deployer)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      expect(logs[1].event).to.be.equal('UpdatePrice')
      expect(logs[1].args._name).to.be.equal(newRarity1[0])
      expect(logs[1].args._price).to.be.eq.BN(newPrice1)

      expect(logs[2].event).to.be.equal('UpdatePrice')
      expect(logs[2].args._name).to.be.equal(newRarity2[0])
      expect(logs[2].args._price).to.be.eq.BN(newPrice2)

      rarity = await raritiesContract.getRarityByName(newRarity1[0])
      expect(rarity.name).to.be.equal(newRarity1[0])
      expect(rarity.maxSupply).to.be.eq.BN(newRarity1[1])
      expect(rarity.price).to.be.eq.BN(secondaryRarityPriceAfterRate)

      rarity = await raritiesContract.getRarityByName(newRarity2[0])
      expect(rarity.name).to.be.equal(newRarity2[0])
      expect(rarity.maxSupply).to.be.eq.BN(newRarity2[1])
      expect(rarity.price).to.be.eq.BN(0)
    })

    it("reverts when params' length mismatch", async function () {
      await assertRevert(
        raritiesContract.updatePrices([newRarity1[0]], [newPrice1, newPrice2]),
        'Rarities#updatePrices: LENGTH_MISMATCH'
      )

      await assertRevert(
        raritiesContract.updatePrices(
          [newRarity1[0], newRarity2[0]],
          [newPrice1]
        ),
        'Rarities#updatePrices: LENGTH_MISMATCH'
      )
    })

    it("reverts when trying to update an invalid rarity's price", async function () {
      await assertRevert(
        raritiesContract.updatePrices(
          ['invalid', newRarity2[0]],
          [newPrice1, newPrice2],
          fromDeployer
        ),
        'Rarities#updatePrices: INVALID_RARITY'
      )
    })

    it("reverts when trying to update a rarity's price by hacker", async function () {
      await assertRevert(
        raritiesContract.updatePrices([newRarity1[0]], [newPrice1], fromHacker),
        'Ownable: caller is not the owner'
      )

      const functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'string[]',
              name: '_names',
              type: 'string[]',
            },
            {
              internalType: 'uint256[]',
              name: '_prices',
              type: 'uint256[]',
            },
          ],
          name: 'updatePrices',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [
          [newRarity1[0], newRarity2[0]],
          [newPrice1, newPrice2],
        ]
      )

      await assertRevert(
        sendMetaTx(
          raritiesContract,
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
