import assertRevert from '../helpers/assertRevert'
import { TIERS, getInitialTiers } from '../helpers/collectionV2'
import { sendMetaTx } from '../helpers/metaTx'
const Tiers = artifacts.require('Tiers')

const BN = web3.utils.BN
const expect = require('chai').use(require('bn-chai')(BN)).expect
const domain = 'Decentraland Tiers'
const version = '1'

describe.only('Tiers', function () {
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
  let tiersContract

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

    tiersContract = await Tiers.new(deployer, getInitialTiers())
  })

  describe('initialize', function () {
    it('should be initialized with correct values', async function () {
      const contract = await Tiers.new(deployer, getInitialTiers())

      const owner = await contract.owner()
      expect(owner).to.be.equal(deployer)

      const tiersCount = await contract.tiersCount()
      expect(tiersCount).to.be.eq.BN(4)

      for (let i = 0; i < tiersCount.toNumber(); i++) {
        const tier = await contract.tiers(i)
        expect(tier.value).to.be.eq.BN(TIERS[i].value)
        expect(tier.price).to.be.eq.BN(TIERS[i].price)
      }
    })
  })

  describe('addTier', function () {
    const newTier1 = ['2', '1']
    const newTier2 = ['4', '2']

    it('should add a tier', async function () {
      let tiersCount = await tiersContract.tiersCount()
      expect(tiersCount).to.be.eq.BN(4)

      const { logs } = await tiersContract.addTiers([newTier1], fromDeployer)

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('TierAdded')
      expect(logs[0].args._tier).to.be.eql(newTier1)

      tiersCount = await tiersContract.tiersCount()
      expect(tiersCount).to.be.eq.BN(5)

      const tier = await tiersContract.tiers(4)
      expect(tier.value).to.be.eq.BN(newTier1[0])
      expect(tier.price).to.be.eq.BN(newTier1[1])
    })

    it('should add tiers', async function () {
      let tiersCount = await tiersContract.tiersCount()
      expect(tiersCount).to.be.eq.BN(4)

      const { logs } = await tiersContract.addTiers(
        [newTier1, newTier2],
        fromDeployer
      )

      expect(logs.length).to.be.equal(2)
      expect(logs[0].event).to.be.equal('TierAdded')
      expect(logs[0].args._tier).to.be.eql(newTier1)

      expect(logs[1].event).to.be.equal('TierAdded')
      expect(logs[1].args._tier).to.be.eql(newTier2)

      tiersCount = await tiersContract.tiersCount()
      expect(tiersCount).to.be.eq.BN(6)

      let tier = await tiersContract.tiers(4)
      expect(tier.value).to.be.eq.BN(newTier1[0])
      expect(tier.price).to.be.eq.BN(newTier1[1])

      tier = await tiersContract.tiers(5)
      expect(tier.value).to.be.eq.BN(newTier2[0])
      expect(tier.price).to.be.eq.BN(newTier2[1])
    })

    it('should add tiers :: Relayed EIP721', async function () {
      let tiersCount = await tiersContract.tiersCount()
      expect(tiersCount).to.be.eq.BN(4)

      const functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              components: [
                {
                  internalType: 'uint256',
                  name: 'value',
                  type: 'uint256',
                },
                {
                  internalType: 'uint256',
                  name: 'price',
                  type: 'uint256',
                },
              ],
              internalType: 'struct Tiers.Tier[]',
              name: '_tiers',
              type: 'tuple[]',
            },
          ],
          name: 'addTiers',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [[newTier1, newTier2]]
      )

      const { logs } = await sendMetaTx(
        tiersContract,
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

      expect(logs[1].event).to.be.equal('TierAdded')
      expect(logs[1].args._tier).to.be.eql(newTier1)

      expect(logs[2].event).to.be.equal('TierAdded')
      expect(logs[2].args._tier).to.be.eql(newTier2)

      tiersCount = await tiersContract.tiersCount()
      expect(tiersCount).to.be.eq.BN(6)

      let tier = await tiersContract.tiers(4)
      expect(tier.value).to.be.eq.BN(newTier1[0])
      expect(tier.price).to.be.eq.BN(newTier1[1])

      tier = await tiersContract.tiers(5)
      expect(tier.value).to.be.eq.BN(newTier2[0])
      expect(tier.price).to.be.eq.BN(newTier2[1])
    })

    it('should accepts a tier with price 0', async function () {
      const tier = ['10', '0']

      tiersContract.addTiers([tier], fromDeployer)
    })

    it('reverts when trying to add a tier with value 0', async function () {
      const tier = ['0', '10']

      await assertRevert(
        tiersContract.addTiers([tier], fromDeployer),
        'Tiers#_addTier: INVALID_AMOUNT'
      )
    })

    it('reverts when trying to add a tier by hacker', async function () {
      const tier = ['10', '10']

      await assertRevert(
        tiersContract.addTiers([tier], fromHacker),
        'Ownable: caller is not the owner'
      )

      const functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              components: [
                {
                  internalType: 'uint256',
                  name: 'value',
                  type: 'uint256',
                },
                {
                  internalType: 'uint256',
                  name: 'price',
                  type: 'uint256',
                },
              ],
              internalType: 'struct Tiers.Tier[]',
              name: '_tiers',
              type: 'tuple[]',
            },
          ],
          name: 'addTiers',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [[newTier1, newTier2]]
      )

      await assertRevert(
        sendMetaTx(
          tiersContract,
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
    const newTier1 = ['2', '1']
    const newTier2 = ['4', '2']

    const newPrice1 = '10'
    const newPrice2 = '0'

    beforeEach(async () => {
      await tiersContract.addTiers([newTier1, newTier2], fromDeployer)
    })

    it("should update a tier's price", async function () {
      let tier = await tiersContract.tiers(4)
      expect(tier.value).to.be.eq.BN(newTier1[0])
      expect(tier.price).to.be.eq.BN(newTier1[1])

      const { logs } = await tiersContract.updatePrices([4], [newPrice1])

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('TierPriceUpdated')
      expect(logs[0].args._tierIndex).to.be.eq.BN(4)
      expect(logs[0].args._price).to.be.eq.BN(newPrice1)

      tier = await tiersContract.tiers(4)
      expect(tier.value).to.be.eq.BN(newTier1[0])
      expect(tier.price).to.be.eq.BN(newPrice1)
    })

    it("should update tiers' prices", async function () {
      let tier = await tiersContract.tiers(4)
      expect(tier.value).to.be.eq.BN(newTier1[0])
      expect(tier.price).to.be.eq.BN(newTier1[1])

      tier = await tiersContract.tiers(5)
      expect(tier.value).to.be.eq.BN(newTier2[0])
      expect(tier.price).to.be.eq.BN(newTier2[1])

      const { logs } = await tiersContract.updatePrices(
        [4, 5],
        [newPrice1, newPrice2]
      )

      expect(logs.length).to.be.equal(2)
      expect(logs[0].event).to.be.equal('TierPriceUpdated')
      expect(logs[0].args._tierIndex).to.be.eq.BN(4)
      expect(logs[0].args._price).to.eq.BN(newPrice1)

      expect(logs[1].event).to.be.equal('TierPriceUpdated')
      expect(logs[1].args._tierIndex).to.be.eq.BN(5)
      expect(logs[1].args._price).to.eq.BN(newPrice2)

      tier = await tiersContract.tiers(4)
      expect(tier.value).to.be.eq.BN(newTier1[0])
      expect(tier.price).to.be.eq.BN(newPrice1)

      tier = await tiersContract.tiers(5)
      expect(tier.value).to.be.eq.BN(newTier2[0])
      expect(tier.price).to.be.eq.BN(newPrice2)
    })

    it("should update tiers' prices :: Relayed EIP721", async function () {
      let tier = await tiersContract.tiers(4)
      expect(tier.value).to.be.eq.BN(newTier1[0])
      expect(tier.price).to.be.eq.BN(newTier1[1])

      tier = await tiersContract.tiers(5)
      expect(tier.value).to.be.eq.BN(newTier2[0])
      expect(tier.price).to.be.eq.BN(newTier2[1])

      const functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'uint256[]',
              name: '_tierIndexs',
              type: 'uint256[]',
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
          [4, 5],
          [newPrice1, newPrice2],
        ]
      )

      const { logs } = await sendMetaTx(
        tiersContract,
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

      expect(logs[1].event).to.be.equal('TierPriceUpdated')
      expect(logs[1].args._tierIndex).to.be.eq.BN(4)
      expect(logs[1].args._price).to.be.eq.BN(newPrice1)

      expect(logs[2].event).to.be.equal('TierPriceUpdated')
      expect(logs[2].args._tierIndex).to.be.eq.BN(5)
      expect(logs[2].args._price).to.be.eq.BN(newPrice2)

      tier = await tiersContract.tiers(4)
      expect(tier.value).to.be.eq.BN(newTier1[0])
      expect(tier.price).to.be.eq.BN(newPrice1)

      tier = await tiersContract.tiers(5)
      expect(tier.value).to.be.eq.BN(newTier2[0])
      expect(tier.price).to.be.eq.BN(newPrice2)
    })

    it("reverts when params' length mismatch", async function () {
      await assertRevert(
        tiersContract.updatePrices([newTier1[0]], [newPrice1, newPrice2]),
        'Tiers#updatePrices: LENGTH_MISMATCH'
      )

      await assertRevert(
        tiersContract.updatePrices([newTier1[0], newTier2[0]], [newPrice1]),
        'Tiers#updatePrices: LENGTH_MISMATCH'
      )
    })

    it("reverts when trying to update an invalid tier's price", async function () {
      await assertRevert(
        tiersContract.updatePrices(
          [10, 5],
          [newPrice1, newPrice2],
          fromDeployer
        ),
        'invalid opcode'
      )
    })

    it("reverts when trying to update a tier's price by hacker", async function () {
      await assertRevert(
        tiersContract.updatePrices([4], [newPrice1], fromHacker),
        'Ownable: caller is not the owner'
      )

      const functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'uint256[]',
              name: '_tierIndexs',
              type: 'uint256[]',
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
          [4, 5],
          [newPrice1, newPrice2],
        ]
      )

      await assertRevert(
        sendMetaTx(
          tiersContract,
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
