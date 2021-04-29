import hr from 'hardhat'
import { Mana, ADDRESS_INDEXES } from 'decentraland-contract-plugins'

import assertRevert from '../helpers/assertRevert'
import { balanceSnap } from '../helpers/balanceSnap'
import { createDummyCollection, WEARABLES } from '../helpers/collection'

const BN = web3.utils.BN
const expect = require('chai').use(require('bn-chai')(BN)).expect

const Store = artifacts.require('DummyBurningStore')

describe('BurningStore', function () {
  // Contract
  let manaContract
  let storeContract
  let collection1
  let collection2

  // Store
  const PRICE_COLLECTION_1 = web3.utils.toBN(web3.utils.toWei('100', 'ether'))
  const PRICE_COLLECTION_2 = web3.utils.toBN(web3.utils.toWei('10', 'ether'))
  const AVAILABILITY_COLLECTION_1 = web3.utils.toBN(10)
  const AVAILABILITY_COLLECTION_2 = web3.utils.toBN(1)

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
    const mana = new Mana({ accounts, artifacts: hr.artifacts })
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
      [collection1.address, collection2.address],
      [
        [0, 1, 2, 3, 4, 5, 6, 7],
        [0, 1],
      ],
      [
        [
          AVAILABILITY_COLLECTION_1,
          AVAILABILITY_COLLECTION_1,
          AVAILABILITY_COLLECTION_1,
          AVAILABILITY_COLLECTION_1,
          AVAILABILITY_COLLECTION_1,
          AVAILABILITY_COLLECTION_1,
          AVAILABILITY_COLLECTION_1,
          AVAILABILITY_COLLECTION_1,
        ],
        [AVAILABILITY_COLLECTION_2, AVAILABILITY_COLLECTION_2],
      ],
      [
        [
          PRICE_COLLECTION_1,
          PRICE_COLLECTION_1,
          PRICE_COLLECTION_1,
          PRICE_COLLECTION_1,
          PRICE_COLLECTION_1,
          PRICE_COLLECTION_1,
          PRICE_COLLECTION_1,
          PRICE_COLLECTION_1,
        ],
        [PRICE_COLLECTION_2, PRICE_COLLECTION_2],
      ],
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
        [collection1.address, collection2.address],
        [
          [0, 1, 2, 3, 4, 5, 6, 7],
          [0, 1],
        ],
        [
          [
            AVAILABILITY_COLLECTION_1,
            AVAILABILITY_COLLECTION_1,
            AVAILABILITY_COLLECTION_1,
            AVAILABILITY_COLLECTION_1,
            AVAILABILITY_COLLECTION_1,
            AVAILABILITY_COLLECTION_1,
            AVAILABILITY_COLLECTION_1,
            AVAILABILITY_COLLECTION_1,
          ],
          [AVAILABILITY_COLLECTION_2, AVAILABILITY_COLLECTION_2],
        ],
        [
          [
            PRICE_COLLECTION_1,
            PRICE_COLLECTION_1,
            PRICE_COLLECTION_1,
            PRICE_COLLECTION_1,
            PRICE_COLLECTION_1,
            PRICE_COLLECTION_1,
            PRICE_COLLECTION_1,
            PRICE_COLLECTION_1,
          ],
          [PRICE_COLLECTION_2, PRICE_COLLECTION_2],
        ],
        fromStoreOwner
      )

      const acceptedToken = await contract.acceptedToken()
      expect(acceptedToken).to.be.equal(manaContract.address)

      for (let i = 0; i < WEARABLES.length; i++) {
        const collectionData = await contract.collectionData(
          collection1.address,
          i
        )

        expect(collectionData.availableQty).to.be.eq.BN(
          AVAILABILITY_COLLECTION_1
        )
        expect(collectionData.price).to.be.eq.BN(PRICE_COLLECTION_1)
      }

      for (let i = 0; i < COLLECTION2_WEARABLES.length; i++) {
        const collectionData = await contract.collectionData(
          collection2.address,
          i
        )
        expect(collectionData.availableQty).to.be.eq.BN(
          AVAILABILITY_COLLECTION_2
        )
        expect(collectionData.price).to.be.eq.BN(PRICE_COLLECTION_2)
      }
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

      let itemsBalanceOfBuyer = await collection1.balanceOf(buyer)
      expect(itemsBalanceOfBuyer).to.be.eq.BN(0)

      const hash = await collection1.getWearableKey(WEARABLES[0].name)

      let itemData = await storeContract.collectionData(collection1.address, 0)
      expect(itemData.availableQty).to.be.eq.BN(AVAILABILITY_COLLECTION_1)

      const { logs } = await storeContract.buy(
        collection1.address,
        [0],
        buyer,
        fromBuyer
      )

      itemData = await storeContract.collectionData(collection1.address, 0)
      expect(itemData.availableQty).to.be.eq.BN(
        AVAILABILITY_COLLECTION_1.sub(web3.utils.toBN(1))
      )

      const finalPrice = PRICE_COLLECTION_1

      totalSupplyCollection1 = await collection1.totalSupply()
      expect(totalSupplyCollection1).to.be.eq.BN(1)

      totalSupplyCollection2 = await collection2.totalSupply()
      expect(totalSupplyCollection2).to.be.eq.BN(0)

      const issued = await collection1.issued(hash)
      expect(issued).to.be.eq.BN(1)

      expect(logs.length).to.be.equal(3)

      expect(logs[0].event).to.be.equal('Burn')
      expect(logs[0].args.burner).to.be.equal(storeContract.address)
      expect(logs[0].args.value).to.be.eq.BN(finalPrice)

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
      expect(logs[2].args._price).to.be.eq.BN(finalPrice)

      await buyerBalance.requireDecrease(finalPrice)
      await storeBalance.requireConstant()

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

      let itemsBalanceOfBuyer = await collection1.balanceOf(buyer)
      expect(itemsBalanceOfBuyer).to.be.eq.BN(0)

      const hash0 = await collection1.getWearableKey(WEARABLES[0].name)
      const hash3 = await collection1.getWearableKey(WEARABLES[3].name)

      let item0Data = await storeContract.collectionData(collection1.address, 0)
      expect(item0Data.availableQty).to.be.eq.BN(AVAILABILITY_COLLECTION_1)

      let item3Data = await storeContract.collectionData(collection1.address, 3)
      expect(item3Data.availableQty).to.be.eq.BN(AVAILABILITY_COLLECTION_1)

      const { logs } = await storeContract.buy(
        collection1.address,
        [0, 3],
        buyer,
        fromBuyer
      )

      item0Data = await storeContract.collectionData(collection1.address, 0)
      expect(item0Data.availableQty).to.be.eq.BN(
        AVAILABILITY_COLLECTION_1.sub(web3.utils.toBN(1))
      )

      item3Data = await storeContract.collectionData(collection1.address, 3)
      expect(item3Data.availableQty).to.be.eq.BN(
        AVAILABILITY_COLLECTION_1.sub(web3.utils.toBN(1))
      )

      const finalPrice = PRICE_COLLECTION_1.mul(web3.utils.toBN(2))

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
      expect(logs[0].args.value).to.be.eq.BN(finalPrice)

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
      expect(logs[3].args._price).to.be.eq.BN(finalPrice)

      await buyerBalance.requireDecrease(finalPrice)
      await storeBalance.requireConstant()

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

    it('should buy entire outfit :: gas checker', async function () {
      let totalSupplyCollection1 = await collection1.totalSupply()
      expect(totalSupplyCollection1).to.be.eq.BN(0)

      const buyerBalance = await balanceSnap(manaContract, buyer, 'buyer')
      const storeBalance = await balanceSnap(
        manaContract,
        storeContract.address,
        'store'
      )

      let itemsBalanceOfBuyer = await collection1.balanceOf(buyer)
      expect(itemsBalanceOfBuyer).to.be.eq.BN(0)

      let item0Data = await storeContract.collectionData(collection1.address, 0)
      expect(item0Data.availableQty).to.be.eq.BN(AVAILABILITY_COLLECTION_1)

      let item3Data = await storeContract.collectionData(collection1.address, 3)
      expect(item3Data.availableQty).to.be.eq.BN(AVAILABILITY_COLLECTION_1)

      const receipt = await storeContract.buy(
        collection1.address,
        WEARABLES.map((_, i) => i),
        buyer,
        fromBuyer
      )

      for (let i = 0; i < WEARABLES.length; i++) {
        const itemData = await storeContract.collectionData(
          collection1.address,
          i
        )
        expect(itemData.availableQty).to.be.eq.BN(
          AVAILABILITY_COLLECTION_1.sub(web3.utils.toBN(1))
        )
      }

      const finalPrice = PRICE_COLLECTION_1.mul(
        web3.utils.toBN(WEARABLES.length)
      )

      totalSupplyCollection1 = await collection1.totalSupply()
      expect(totalSupplyCollection1).to.be.eq.BN(WEARABLES.length)

      const logs = receipt.logs

      expect(logs[logs.length - 1].event).to.be.equal('Bought')
      expect(logs[logs.length - 1].args._collectionAddress).to.be.equal(
        collection1.address
      )
      expect(logs[logs.length - 1].args._optionIds).to.be.eql(
        WEARABLES.map((_, i) => web3.utils.toBN(i))
      )
      expect(logs[logs.length - 1].args._price).to.be.eq.BN(finalPrice)

      await buyerBalance.requireDecrease(finalPrice)
      await storeBalance.requireConstant()

      itemsBalanceOfBuyer = await collection1.balanceOf(buyer)
      expect(itemsBalanceOfBuyer).to.be.eq.BN(WEARABLES.length)
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

    it('reverts when trying to buy an item not part of the collection', async function () {
      const wearablesCount = await collection1.wearablesCount()
      await assertRevert(
        storeContract.buy(
          collection1.address,
          [wearablesCount.add(web3.utils.toBN(1))],
          buyer,
          fromBuyer
        ),
        'Sold out item'
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
        'Sold out item'
      )

      // Buy item left
      await storeContract.buy(collection2.address, [0], buyer, fromBuyer)

      // Try again
      await assertRevert(
        storeContract.buy(collection2.address, [0], buyer, fromBuyer),
        'Sold out item'
      )
    })
  })

  describe('setCollectionData', function () {
    it('should set collection data', async function () {
      const collection3 = await createDummyCollection({
        allowed: user,
        wearables: COLLECTION2_WEARABLES,
        creationParams,
      })

      let item1 = await storeContract.collectionData(collection3.address, 1)
      expect(item1.availableQty).to.be.eq.BN(0)
      expect(item1.price).to.be.eq.BN(0)

      let item3 = await storeContract.collectionData(collection3.address, 3)
      expect(item3.availableQty).to.be.eq.BN(0)
      expect(item3.price).to.be.eq.BN(0)

      let item2 = await storeContract.collectionData(collection3.address, 2)
      expect(item2.availableQty).to.be.eq.BN(0)
      expect(item2.price).to.be.eq.BN(0)

      const { logs } = await storeContract.setCollectionData(
        collection3.address,
        [1, 3, 2],
        [100, 1, 2],
        [100, 100, 1000],
        fromStoreOwner
      )

      expect(logs.length).to.be.equal(1)

      expect(logs[0].event).to.be.equal('SetCollectionData')
      expect(logs[0].args._collectionAddress).to.be.equal(collection3.address)
      expect(logs[0].args._optionIds).to.be.eql([
        web3.utils.toBN(1),
        web3.utils.toBN(3),
        web3.utils.toBN(2),
      ])
      expect(logs[0].args._availableQtys).to.be.eql([
        web3.utils.toBN(100),
        web3.utils.toBN(1),
        web3.utils.toBN(2),
      ])
      expect(logs[0].args._prices).to.be.eql([
        web3.utils.toBN(100),
        web3.utils.toBN(100),
        web3.utils.toBN(1000),
      ])

      item1 = await storeContract.collectionData(collection3.address, 1)
      expect(item1.availableQty).to.be.eq.BN(web3.utils.toBN(100))
      expect(item1.price).to.be.eq.BN(web3.utils.toBN(100))

      item3 = await storeContract.collectionData(collection3.address, 3)
      expect(item3.availableQty).to.be.eq.BN(web3.utils.toBN(1))
      expect(item3.price).to.be.eq.BN(web3.utils.toBN(100))

      item2 = await storeContract.collectionData(collection3.address, 2)
      expect(item2.availableQty).to.be.eq.BN(web3.utils.toBN(2))
      expect(item2.price).to.be.eq.BN(web3.utils.toBN(1000))
    })

    it('should update collection data', async function () {
      let item1 = await storeContract.collectionData(collection1.address, 1)
      expect(item1.availableQty).to.be.eq.BN(AVAILABILITY_COLLECTION_1)
      expect(item1.price).to.be.eq.BN(PRICE_COLLECTION_1)

      const newAvailability = AVAILABILITY_COLLECTION_1.add(web3.utils.toBN(1))
      const newPrice = PRICE_COLLECTION_1.add(web3.utils.toBN(1))

      await storeContract.setCollectionData(
        collection1.address,
        [1],
        [newAvailability],
        [newPrice],
        fromStoreOwner
      )

      item1 = await storeContract.collectionData(collection1.address, 1)
      expect(item1.availableQty).to.be.eq.BN(newAvailability)
      expect(item1.price).to.be.eq.BN(newPrice)
    })

    it('reverts when trying to set a collection beneficiary by hacker', async function () {
      await assertRevert(
        storeContract.setCollectionData(
          collection1.address,
          [1, 3, 2],
          [100, 1, 2],
          [100, 100, 1000],
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
        await storeContract.buy(collection2.address, [0], buyer, fromBuyer)
      }

      const canMint = await storeContract.canMint(collection2.address, 0, 1)
      expect(canMint).to.be.equal(false)
    })

    it('should return false for an invalid wearable', async function () {
      const canMint = await storeContract.canMint(
        collection1.address,
        WEARABLES.length,
        1
      )

      expect(canMint).to.be.equal(false)
    })
  })

  describe('balanceOf', function () {
    it('should return balance of wearables', async function () {
      const optionsCount = await collection1.wearablesCount()

      for (let i = 0; i < optionsCount.toNumber(); i++) {
        const balance = await storeContract.balanceOf(collection1.address, i)
        expect(balance).to.be.eq.BN(AVAILABILITY_COLLECTION_1)
      }

      await storeContract.buy(collection1.address, [0], buyer, fromBuyer)

      const hash = await collection1.getWearableKey(WEARABLES[0].name)

      const issued = await await collection1.issued(hash)
      expect(issued).to.be.eq.BN(1)

      const balance = await storeContract.balanceOf(collection1.address, 0)
      expect(balance).to.be.eq.BN(AVAILABILITY_COLLECTION_1 - 1)
    })

    it('should return 0 for an exhausted wearable', async function () {
      this.timeout(Infinity)
      const hash = await collection2.getWearableKey(
        COLLECTION2_WEARABLES[0].name
      )

      const maxIssuance = await collection2.maxIssuance(hash)

      for (let i = 0; i < maxIssuance; i++) {
        await storeContract.buy(collection2.address, [0], buyer, fromBuyer)
      }

      const balance = await storeContract.balanceOf(collection2.address, 0)
      expect(balance).to.be.eq.BN(0)
    })

    it('should return 0 for an invalid wearable', async function () {
      const balance = await storeContract.balanceOf(
        collection1.address,
        WEARABLES.length
      )

      expect(balance).to.be.eq.BN(0)
    })
  })

  describe('itemByOptionId', function () {
    it('should return item string id by option id', async function () {
      const optionsCount = await collection1.wearablesCount()

      for (let i = 0; i < optionsCount.toNumber(); i++) {
        const item = await storeContract.itemByOptionId(collection1.address, i)
        expect(item).to.be.equal(WEARABLES[i].name)
      }
    })

    it('reverts when trying to get an item string id by an invalid option id', async function () {
      await assertRevert(
        storeContract.itemByOptionId(collection1.address, WEARABLES.length)
      )
    })
  })
})
