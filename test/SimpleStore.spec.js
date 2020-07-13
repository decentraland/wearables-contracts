import { Mana, ADDRESS_INDEXES } from 'decentraland-contract-plugins'

import assertRevert from './helpers/assertRevert'
import { balanceSnap } from './helpers/balanceSnap'
import {
  createDummyCollection,
  WEARABLES,
  ZERO_ADDRESS,
} from './helpers/collection'
import { expect } from 'chai'

const Store = artifacts.require('DummySimpleStore')

describe.only('SimpleStore', function () {
  // Contract
  let manaContract
  let storeContract
  let collection1
  let collection2

  // Store
  const PRICE = web3.utils.toBN(web3.utils.toWei('100', 'ether'))
  const STORE_FEE = web3.utils.toBN(25000) // 2.5%
  const MILLION = web3.utils.toBN(1000000)

  // WEARABLES_2
  const COLLECTION2_WEARABLES = [
    { name: 'coco_mask', max: 1 },
    { name: 'turtle_mask', max: 100 },
  ]

  // Accounts
  let accounts
  let deployer
  let user
  let buyer
  let anotherBuyer
  let collection1Beneficiary
  let collection2Beneficiary
  let storeOwner
  let hacker
  let holder
  let fromUser
  let fromHacker
  let fromDeployer
  let fromStoreOwner
  let fromBuyer
  let fromAnotherBuyer

  let creationParams

  beforeEach(async function () {
    accounts = await web3.eth.getAccounts()
    deployer = accounts[ADDRESS_INDEXES.deployer]
    user = accounts[ADDRESS_INDEXES.user]
    collection1Beneficiary = accounts[ADDRESS_INDEXES.anotherUser]
    collection2Beneficiary = accounts[ADDRESS_INDEXES.updateOperator]
    hacker = accounts[ADDRESS_INDEXES.hacker]
    storeOwner = accounts[ADDRESS_INDEXES.operator]
    buyer = accounts[ADDRESS_INDEXES.buyer]
    anotherBuyer = accounts[ADDRESS_INDEXES.anotherBuyer]

    fromStoreOwner = { from: storeOwner }
    fromUser = { from: user }
    fromHacker = { from: hacker }
    fromBuyer = { from: buyer }
    fromAnotherBuyer = { from: anotherBuyer }
    fromDeployer = { from: deployer }

    creationParams = {
      ...fromDeployer,
      gas: 6e6,
      gasPrice: 21e9,
    }

    // Set up MANA Contract
    const mana = new Mana({ accounts, artifacts: global })
    await mana.deploy({ txParams: creationParams })
    manaContract = mana.getContract()

    collection1 = await createDummyCollection({
      allowed: user,
      creationParams,
    })

    collection2 = await createDummyCollection({
      allowed: user,
      wearables: COLLECTION2_WEARABLES,
      creationParams,
    })

    storeContract = await Store.new(
      manaContract.address,
      PRICE,
      STORE_FEE,
      [collection1.address, collection2.address],
      [collection1Beneficiary, collection2Beneficiary],
      fromStoreOwner
    )

    await collection1.setAllowed(storeContract.address, true)
    await collection2.setAllowed(storeContract.address, true)

    // Approve store
    await manaContract.approve(storeContract.address, -1, fromBuyer)
  })

  describe('Deploy', async function () {
    it('deploy with correct values', async function () {
      const contract = await Store.new(
        manaContract.address,
        PRICE,
        STORE_FEE,
        [collection1.address, collection2.address],
        [collection1Beneficiary, collection2Beneficiary],
        fromStoreOwner
      )

      const acceptedToken = await contract.acceptedToken()
      const contractPrice = await contract.price()
      const ownerCutPerMillion = await contract.ownerCutPerMillion()
      const beneficiary1 = await contract.collectionBeneficiaries(
        collection1.address
      )
      const beneficiary2 = await contract.collectionBeneficiaries(
        collection2.address
      )

      expect(acceptedToken).to.be.equal(manaContract.address)
      expect(contractPrice).to.be.eq.BN(PRICE)
      expect(ownerCutPerMillion).to.be.eq.BN(STORE_FEE)
      expect(beneficiary1).to.be.equal(collection1Beneficiary)
      expect(beneficiary2).to.be.equal(collection2Beneficiary)
    })
  })

  describe('buy', function () {
    it('should buy', async function () {
      let totalSupplyCollection1 = await collection1.totalSupply()
      expect(totalSupplyCollection1).to.be.eq.BN(0)

      let totalSupplyCollection2 = await collection2.totalSupply()
      expect(totalSupplyCollection2).to.be.eq.BN(0)

      const buyerBalance = await balanceSnap(manaContract, buyer, 'buyer')
      const storeBalance = await balanceSnap(
        manaContract,
        storeContract.address,
        'store'
      )
      const collection1BeneficiaryBalance = await balanceSnap(
        manaContract,
        collection1Beneficiary,
        'beneficiary1'
      )
      const collection2BeneficiaryBalance = await balanceSnap(
        manaContract,
        collection2Beneficiary,
        'beneficiary2'
      )

      let itemsBalanceOfBuyer = await collection1.balanceOf(buyer)
      expect(itemsBalanceOfBuyer).to.be.eq.BN(0)

      const fee = PRICE.mul(STORE_FEE).div(MILLION)

      const hash = await collection1.getWearableKey(WEARABLES[0].name)

      const { logs } = await storeContract.buy(
        collection1.address,
        [0],
        buyer,
        fromBuyer
      )

      totalSupplyCollection1 = await collection1.totalSupply()
      expect(totalSupplyCollection1).to.be.eq.BN(1)

      totalSupplyCollection2 = await collection2.totalSupply()
      expect(totalSupplyCollection2).to.be.eq.BN(0)

      const issued = await collection1.issued(hash)
      expect(issued).to.be.eq.BN(1)

      expect(logs.length).to.be.equal(3)

      expect(logs[0].event).to.be.equal('Burn')
      expect(logs[0].args.burner).to.be.equal(storeContract.address)
      expect(logs[0].args.value).to.be.eq.BN(fee)

      expect(logs[1].event).to.be.equal('Issue')
      expect(logs[1].args._beneficiary).to.be.equal(buyer)
      expect(logs[1].args._tokenId).to.be.eq.BN(
        totalSupplyCollection1.toNumber() - 1
      )
      expect(logs[1].args._wearableIdKey).to.be.equal(hash)
      expect(logs[1].args._wearableId).to.be.equal(WEARABLES[0].name)
      expect(logs[1].args._issuedId).to.eq.BN(1)

      expect(logs[2].event).to.be.equal('Bought')
      expect(logs[2].args._collectionAddress).to.be.equal(collection1.address)
      expect(logs[2].args._optionIds).to.be.eql([web3.utils.toBN(0)])
      expect(logs[2].args._price).to.be.eq.BN(PRICE)

      await buyerBalance.requireDecrease(PRICE)
      await storeBalance.requireConstant()
      await collection1BeneficiaryBalance.requireIncrease(PRICE.sub(fee))
      await collection2BeneficiaryBalance.requireConstant()

      itemsBalanceOfBuyer = await collection1.balanceOf(buyer)
      expect(itemsBalanceOfBuyer).to.be.eq.BN(1)

      const itemId = await collection1.tokenOfOwnerByIndex(buyer, 0)
      const uri = await collection1.tokenURI(itemId)
      const uriArr = uri.split('/')
      expect(WEARABLES[0].name).to.eq.BN(uriArr[uriArr.length - 2])
    })

    it('should buy more than 1 item', async function () {
      let totalSupplyCollection1 = await collection1.totalSupply()
      expect(totalSupplyCollection1).to.be.eq.BN(0)

      let totalSupplyCollection2 = await collection2.totalSupply()
      expect(totalSupplyCollection2).to.be.eq.BN(0)

      const buyerBalance = await balanceSnap(manaContract, buyer, 'buyer')
      const storeBalance = await balanceSnap(
        manaContract,
        storeContract.address,
        'store'
      )
      const collection1BeneficiaryBalance = await balanceSnap(
        manaContract,
        collection1Beneficiary,
        'beneficiary1'
      )
      const collection2BeneficiaryBalance = await balanceSnap(
        manaContract,
        collection2Beneficiary,
        'beneficiary2'
      )

      let itemsBalanceOfBuyer = await collection1.balanceOf(buyer)
      expect(itemsBalanceOfBuyer).to.be.eq.BN(0)

      const expectedFinalPrice = PRICE.mul(web3.utils.toBN(2))
      const fee = expectedFinalPrice.mul(STORE_FEE).div(MILLION)

      const hash0 = await collection1.getWearableKey(WEARABLES[0].name)
      const hash3 = await collection1.getWearableKey(WEARABLES[3].name)

      const { logs } = await storeContract.buy(
        collection1.address,
        [0, 3],
        buyer,
        fromBuyer
      )

      totalSupplyCollection1 = await collection1.totalSupply()
      expect(totalSupplyCollection1).to.be.eq.BN(2)

      totalSupplyCollection2 = await collection2.totalSupply()
      expect(totalSupplyCollection2).to.be.eq.BN(0)

      const issued1 = await collection1.issued(hash0)
      expect(issued1).to.be.eq.BN(1)

      const issued2 = await collection1.issued(hash3)
      expect(issued2).to.be.eq.BN(1)

      expect(logs.length).to.be.equal(4)

      expect(logs[0].event).to.be.equal('Burn')
      expect(logs[0].args.burner).to.be.equal(storeContract.address)
      expect(logs[0].args.value).to.be.eq.BN(fee)

      expect(logs[1].event).to.be.equal('Issue')
      expect(logs[1].args._beneficiary).to.be.equal(buyer)
      expect(logs[1].args._tokenId).to.be.eq.BN(
        totalSupplyCollection1.toNumber() - 2
      )
      expect(logs[1].args._wearableIdKey).to.be.equal(hash0)
      expect(logs[1].args._wearableId).to.be.equal(WEARABLES[0].name)
      expect(logs[1].args._issuedId).to.eq.BN(1)

      expect(logs[2].event).to.be.equal('Issue')
      expect(logs[2].args._beneficiary).to.be.equal(buyer)
      expect(logs[2].args._tokenId).to.be.eq.BN(
        totalSupplyCollection1.toNumber() - 1
      )
      expect(logs[2].args._wearableIdKey).to.be.equal(hash3)
      expect(logs[2].args._wearableId).to.be.equal(WEARABLES[3].name)
      expect(logs[2].args._issuedId).to.eq.BN(1)

      expect(logs[3].event).to.be.equal('Bought')
      expect(logs[3].args._collectionAddress).to.be.equal(collection1.address)
      expect(logs[3].args._optionIds).to.be.eql([
        web3.utils.toBN(0),
        web3.utils.toBN(3),
      ])
      expect(logs[3].args._price).to.be.eq.BN(expectedFinalPrice)

      await buyerBalance.requireDecrease(expectedFinalPrice)
      await storeBalance.requireConstant()
      await collection1BeneficiaryBalance.requireIncrease(
        expectedFinalPrice.sub(fee)
      )
      await collection2BeneficiaryBalance.requireConstant()

      itemsBalanceOfBuyer = await collection1.balanceOf(buyer)
      expect(itemsBalanceOfBuyer).to.be.eq.BN(2)

      let itemId = await collection1.tokenOfOwnerByIndex(buyer, 0)
      let uri = await collection1.tokenURI(itemId)
      let uriArr = uri.split('/')
      expect(WEARABLES[0].name).to.eq.BN(uriArr[uriArr.length - 2])

      itemId = await collection1.tokenOfOwnerByIndex(buyer, 1)
      uri = await collection1.tokenURI(itemId)
      uriArr = uri.split('/')
      expect(WEARABLES[3].name).to.eq.BN(uriArr[uriArr.length - 2])
    })

    it('reverts when the collection has not set a beneficiary', async function () {
      const collection = await createDummyCollection({
        allowed: user,
        creationParams,
      })

      await assertRevert(
        storeContract.buy(collection.address, [0], buyer, fromBuyer),
        'The collection does not have a beneficiary'
      )
    })

    it('reverts when buyer has not balance', async function () {
      await manaContract.approve(storeContract.address, -1, fromHacker)

      const balance = await manaContract.balanceOf(hacker)
      await manaContract.transfer(storeContract.address, balance, fromHacker)

      await assertRevert(
        storeContract.buy(collection1.address, [0], hacker, fromHacker),
        'Insufficient funds'
      )
    })

    it('reverts when buyer has not approve the store to use the accepted token on his behalf', async function () {
      await assertRevert(
        storeContract.buy(
          collection1.address,
          [0],
          anotherBuyer,
          fromAnotherBuyer
        ),
        'The contract is not authorized to use the accepted token on sender behalf'
      )
    })

    it('reverts when trying to buy an item not part of the  collection', async function () {
      const wearablesCount = await collection1.wearablesCount()
      await assertRevert(
        storeContract.buy(
          collection1.address,
          [wearablesCount.add(web3.utils.toBN(1))],
          buyer,
          fromBuyer
        ),
        'Invalid wearable'
      )
    })

    it('reverts when trying to buy an item from a not allowed collection', async function () {
      await collection1.setAllowed(storeContract.address, false, creationParams)

      await assertRevert(
        storeContract.buy(collection1.address, [0], buyer, fromBuyer),
        'Only an `allowed` address can issue tokens'
      )
    })

    it('reverts when trying to buy more than the amount of items left', async function () {
      // Only 1 item left. Trying to buy 2
      await assertRevert(
        storeContract.buy(collection2.address, [0, 0], buyer, fromBuyer),
        'Invalid issued id'
      )
    })
  })

  describe('setOwnerCutPerMillion', function () {
    it('should set fee', async function () {
      let fee = await storeContract.ownerCutPerMillion()
      expect(fee).to.be.eq.BN(STORE_FEE)

      const { logs } = await storeContract.setOwnerCutPerMillion(
        1,
        fromStoreOwner
      )

      expect(logs.length).to.be.equal(1)

      expect(logs[0].event).to.be.equal('ChangedOwnerCutPerMillion')
      expect(logs[0].args._oldOwnerCutPerMillion).to.be.eq.BN(STORE_FEE)
      expect(logs[0].args._newOwnerCutPerMillion).to.be.eq.BN(1)

      fee = await storeContract.ownerCutPerMillion()
      expect(fee).to.be.eq.BN(1)

      await storeContract.setOwnerCutPerMillion(0, fromStoreOwner)

      fee = await storeContract.ownerCutPerMillion()
      expect(fee).to.be.eq.BN(0)
    })

    it('reverts when fee is equal or higher than 1 million', async function () {
      await assertRevert(
        storeContract.setOwnerCutPerMillion(MILLION, fromStoreOwner),
        'The owner cut should be between 0 and 999,999'
      )

      await assertRevert(
        storeContract.setOwnerCutPerMillion(
          MILLION.add(web3.utils.toBN(1)),
          fromStoreOwner
        ),
        'The owner cut should be between 0 and 999,999'
      )
    })

    it('reverts when trying to set fee by hacker', async function () {
      await assertRevert(
        storeContract.setOwnerCutPerMillion(MILLION, fromHacker),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('setCollectionBeneficiary', function () {
    it('should set collection beneficiary', async function () {
      let beneficiary = await storeContract.collectionBeneficiaries(
        collection1.address
      )
      expect(beneficiary).to.be.eq.BN(collection1Beneficiary)

      const { logs } = await storeContract.setCollectionBeneficiary(
        collection1.address,
        collection2Beneficiary,
        fromStoreOwner
      )

      expect(logs.length).to.be.equal(1)

      expect(logs[0].event).to.be.equal('ChangedCollectionBeneficiary')
      expect(logs[0].args._collectionAddress).to.be.equal(collection1.address)
      expect(logs[0].args._oldBeneficiary).to.be.equal(collection1Beneficiary)
      expect(logs[0].args._newBeneficiary).to.be.equal(collection2Beneficiary)

      beneficiary = await storeContract.collectionBeneficiaries(
        collection1.address
      )
      expect(beneficiary).to.be.eq.BN(collection2Beneficiary)

      await storeContract.setCollectionBeneficiary(
        collection1.address,
        ZERO_ADDRESS,
        fromStoreOwner
      )

      beneficiary = await storeContract.collectionBeneficiaries(
        collection1.address
      )
      expect(beneficiary).to.be.eq.BN(ZERO_ADDRESS)
    })

    it('reverts when trying to set a collection beneficiary by hacker', async function () {
      await assertRevert(
        storeContract.setCollectionBeneficiary(
          collection1.address,
          collection2Beneficiary,
          fromHacker
        ),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('canMint', function () {
    it('should return if a wearable can be minted', async function () {
      let canMint = await storeContract.canMint(collection1.address, 0, 0)
      expect(canMint).to.be.equal(true)

      const optionsCount = await collection1.wearablesCount()

      for (let i = 0; i < optionsCount.toNumber(); i++) {
        canMint = await storeContract.canMint(collection1.address, i, 1)
        expect(canMint).to.be.equal(true)
      }
    })

    it('should return false for an exhausted wearable', async function () {
      this.timeout(Infinity)
      const hash = await collection2.getWearableKey(
        COLLECTION2_WEARABLES[0].name
      )

      const maxIssuance = await collection2.maxIssuance(hash)

      for (let i = 0; i < maxIssuance; i++) {
        await collection2.issueToken(
          user,
          COLLECTION2_WEARABLES[0].name,
          fromUser
        )
      }

      const canMint = await storeContract.canMint(collection2.address, 0, 1)
      expect(canMint).to.be.equal(false)
    })

    it('reverts for an invalid wearable', async function () {
      await assertRevert(
        storeContract.canMint(collection1.address, WEARABLES.length, 1),
        'Invalid wearable'
      )
    })
  })

  describe('balanceOf', function () {
    it('should return balance of wearables', async function () {
      const optionsCount = await collection1.wearablesCount()

      for (let i = 0; i < optionsCount.toNumber(); i++) {
        const balance = await storeContract.balanceOf(collection1.address, i)
        expect(balance).to.be.eq.BN(WEARABLES[i].max)
      }

      await collection1.issueToken(user, WEARABLES[0].name, fromUser)

      const hash = await collection1.getWearableKey(WEARABLES[0].name)

      const issued = await await collection1.issued(hash)
      expect(issued).to.be.eq.BN(1)

      const balance = await storeContract.balanceOf(collection1.address, 0)
      expect(balance).to.be.eq.BN(WEARABLES[0].max - 1)
    })

    it('reverts for an invalid wearable', async function () {
      await assertRevert(
        storeContract.balanceOf(collection1.address, WEARABLES.length),
        'Invalid wearable'
      )
    })
  })
})
