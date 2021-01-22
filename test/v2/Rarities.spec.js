import assertRevert from '../helpers/assertRevert'
import { RARITIES } from '../helpers/collectionV2'
import {
  sendMetaTx,
  getDomainSeparator,
  getSignature,
  DEFAULT_DOMAIN,
  DEFAULT_VERSION,
} from '../helpers/metaTx'
const Rarities = artifacts.require('Rarities')

const BN = web3.utils.BN
const expect = require('chai').use(require('bn-chai')(BN)).expect

describe.only('Rarities', function () {
  this.timeout(100000)

  let creationParams

  // Accounts
  let accounts
  let deployer
  let user
  let hacker
  let relayer
  let creator
  let operator
  let approvedForAll
  let fromUser
  let fromHacker
  let fromDeployer
  let fromCreator
  let fromRelayer

  // Contracts
  let raritiesContract

  beforeEach(async function () {
    // Create Listing environment
    accounts = await web3.eth.getAccounts()
    deployer = accounts[0]
    user = accounts[1]
    creator = accounts[2]
    hacker = accounts[3]
    relayer = accounts[4]
    fromUser = { from: user }
    fromHacker = { from: hacker }
    fromRelayer = { from: relayer }

    fromDeployer = { from: deployer }

    creationParams = {
      ...fromDeployer,
      gasPrice: 21e9,
    }

    raritiesContract = await Rarities.new(creator, 0)
  })

  describe('initialize', function () {
    it('should be initialized with correct values', async function () {
      const price = 10
      const contract = await Rarities.new(creator, price)

      const raritiesCount = await contract.raritiesCount()
      expect(raritiesCount).to.be.eq.BN(7)

      for (let i = 0; i < raritiesCount.toNumber(); i++) {
        const rarity = await contract.rarities(i)
        console.log(rarity)
        expect(rarity.name).to.be.equal(RARITIES[rarity.name].name)
        expect(rarity.maxSupply).to.be.eq.BN(RARITIES[rarity.name].value)
        expect(rarity.price).to.be.eq.BN(price)
      }
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
        expect(rarity.price).to.be.eq.BN(0)
      }
    })

    it('reverts when trying to get rarity by an invalid name', async function () {
      await assertRevert(
        raritiesContract.getRarityByName('invalid'),
        'Rarities#getRarityByName: INVALID_RARITY'
      )
    })
  })

  describe('addRarity', function () {
    it.skip('reverts when rarity is invalid', async function () {
      const values = Object.values(RARITIES)
      await assertRevert(collectionContract.getRarityValue(values.length))

      await assertRevert(collectionContract.getRarityName(values.length))
    })
  })
})
