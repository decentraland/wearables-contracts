import { Mana, ADDRESS_INDEXES } from 'decentraland-contract-plugins'

import { balanceSnap } from '../helpers/balanceSnap'
import assertRevert from '../helpers/assertRevert'
import {
  ITEMS,
  RARITIES,
  BENEFICIARY_ADDRESS,
  OTHER_BENEFICIARY_ADDRESS,
  EMPTY_HASH,
  createDummyFactory,
  createDummyCollection,
  encodeTokenId,
  ZERO_ADDRESS,
  GRACE_PERIOD,
} from '../helpers/collectionV2'
import { increaseTime } from '../helpers/increase'

const Store = artifacts.require('DummyCollectionStore')

describe('Collection Store', function () {
  const ONE_MILLION = web3.utils.toBN(1000000)
  // Store
  const FEE = web3.utils.toBN(10000)

  // COLLECTION ITEMS 2
  const COLLECTION2_ITEMS = [
    [
      RARITIES.legendary.index,
      0,
      web3.utils.toWei('10'),
      OTHER_BENEFICIARY_ADDRESS,
      '1:coco_maso:hat:female,male',
      EMPTY_HASH,
    ],
    [
      RARITIES.unique.index.toString(),
      0,
      web3.utils.toWei('20'),
      OTHER_BENEFICIARY_ADDRESS,
      '1:banana_mask:hat:female,male',
      EMPTY_HASH,
    ],
    [
      RARITIES.common.index.toString(),
      0,
      0,
      ZERO_ADDRESS,
      '1:apple_mask:hat:female,male',
      EMPTY_HASH,
    ],
  ]

  // Contract
  let manaContract
  let storeContract
  let collection1
  let collection2

  // Accounts
  let accounts
  let deployer
  let user
  let buyer
  let anotherBuyer
  let storeOwner
  let feeOwner
  let hacker
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
    feeOwner = accounts[ADDRESS_INDEXES.anotherUser]
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

    const factory = await createDummyFactory(deployer)

    collection1 = await createDummyCollection(factory, {
      creator: deployer,
      items: ITEMS,
      shouldComplete: true,
    })

    collection2 = await createDummyCollection(factory, {
      creator: deployer,
      items: COLLECTION2_ITEMS,
      shouldComplete: true,
    })

    storeContract = await Store.new(
      manaContract.address,
      feeOwner,
      FEE,
      fromStoreOwner
    )

    await collection1.setMinters([storeContract.address], [true])
    await collection2.setMinters([storeContract.address], [true])

    await increaseTime(GRACE_PERIOD)

    // Approve store
    await manaContract.approve(storeContract.address, -1, fromBuyer)
  })

  describe('Deploy', async function () {
    it('deploy with correct values', async function () {
      const contract = await Store.new(
        manaContract.address,
        feeOwner,
        FEE,
        fromStoreOwner
      )

      const acceptedToken_ = await contract.acceptedToken()
      expect(acceptedToken_).to.be.equal(manaContract.address)

      const feeOwner_ = await contract.feeOwner()
      expect(feeOwner_).to.be.equal(feeOwner)

      const fee_ = await contract.fee()
      expect(fee_).to.be.eq.BN(FEE)
    })

    it('reverts when deploying with fee >= ONE_MILLION', async function () {
      await assertRevert(
        Store.new(manaContract.address, feeOwner, ONE_MILLION, fromStoreOwner),
        'CollectionStore#setFee: FEE_SHOULD_BE_LOWER_THAN_1000000'
      )

      await assertRevert(
        Store.new(
          manaContract.address,
          feeOwner,
          ONE_MILLION.add(web3.utils.toBN(1)),
          fromStoreOwner
        ),
        'CollectionStore#setFee: FEE_SHOULD_BE_LOWER_THAN_1000000'
      )
    })
  })

  describe('buy', function () {
    it('should buy', async function () {
      let totalSupplyCollection1 = await collection1.totalSupply()
      expect(totalSupplyCollection1).to.be.eq.BN(0)

      let totalSupplyCollection2 = await collection2.totalSupply()
      expect(totalSupplyCollection2).to.be.eq.BN(0)

      const buyerBalance = await balanceSnap(manaContract, buyer, 'buyer')
      const beneficiaryBalance = await balanceSnap(
        manaContract,
        BENEFICIARY_ADDRESS,
        'beneficiary'
      )
      const feeOwnerBalance = await balanceSnap(
        manaContract,
        feeOwner,
        'fee owner'
      )
      const storeBalance = await balanceSnap(
        manaContract,
        storeContract.address,
        'store'
      )

      let itemsBalanceOfBuyer = await collection1.balanceOf(buyer)
      expect(itemsBalanceOfBuyer).to.be.eq.BN(0)

      const price = web3.utils.toBN(ITEMS[0][2])
      const { logs } = await storeContract.buy(
        [[collection1.address, [0], [price]]],
        buyer,
        fromBuyer
      )

      totalSupplyCollection1 = await collection1.totalSupply()
      expect(totalSupplyCollection1).to.be.eq.BN(1)

      totalSupplyCollection2 = await collection2.totalSupply()
      expect(totalSupplyCollection2).to.be.eq.BN(0)

      const item0 = await collection1.items(0)
      expect(item0.totalSupply).to.be.eq.BN(1)

      expect(logs.length).to.be.equal(4)

      const feeCharged = price.mul(FEE).div(ONE_MILLION)

      expect(logs[0].event).to.be.equal('Transfer')
      expect(logs[0].args._from).to.be.equal(buyer)
      expect(logs[0].args._to.toLowerCase()).to.be.equal(
        BENEFICIARY_ADDRESS.toLowerCase()
      )
      expect(logs[0].args._value).to.be.eq.BN(price.sub(feeCharged))

      expect(logs[1].event).to.be.equal('Issue')
      expect(logs[1].args._beneficiary).to.be.equal(buyer)
      expect(logs[1].args._tokenId).to.be.eq.BN(encodeTokenId(0, 1))
      expect(logs[1].args._itemId).to.be.eq.BN(0)
      expect(logs[1].args._issuedId).to.be.eq.BN(1)

      expect(logs[2].event).to.be.equal('Transfer')
      expect(logs[2].args._from).to.be.equal(buyer)
      expect(logs[2].args._to).to.be.equal(feeOwner)
      expect(logs[2].args._value).to.be.eq.BN(feeCharged)

      expect(logs[3].event).to.be.equal('Bought')
      expect(logs[3].args._itemsToBuy).to.be.eql([
        [collection1.address, ['0'], [price.toString()]],
      ])
      expect(logs[3].args._beneficiary).to.be.equal(buyer)

      await buyerBalance.requireDecrease(price)
      await beneficiaryBalance.requireIncrease(price.sub(feeCharged))
      await feeOwnerBalance.requireIncrease(feeCharged)
      await storeBalance.requireConstant()

      itemsBalanceOfBuyer = await collection1.balanceOf(buyer)
      expect(itemsBalanceOfBuyer).to.be.eq.BN(1)

      const itemId = await collection1.tokenOfOwnerByIndex(buyer, 0)
      const uri = await collection1.tokenURI(itemId)
      const uriArr = uri.split('/')
      expect(0).to.eq.BN(uriArr[uriArr.length - 2])
    })

    it('should buy an item with price 0', async function () {
      let totalSupplyCollection1 = await collection1.totalSupply()
      expect(totalSupplyCollection1).to.be.eq.BN(0)

      let totalSupplyCollection2 = await collection2.totalSupply()
      expect(totalSupplyCollection2).to.be.eq.BN(0)

      const buyerBalance = await balanceSnap(manaContract, buyer, 'buyer')
      const beneficiaryBalance = await balanceSnap(
        manaContract,
        BENEFICIARY_ADDRESS,
        'beneficiary'
      )
      const feeOwnerBalance = await balanceSnap(
        manaContract,
        feeOwner,
        'fee owner'
      )
      const storeBalance = await balanceSnap(
        manaContract,
        storeContract.address,
        'store'
      )

      let itemsBalanceOfBuyer = await collection2.balanceOf(buyer)
      expect(itemsBalanceOfBuyer).to.be.eq.BN(0)

      const { logs } = await storeContract.buy(
        [[collection2.address, [2], [0]]],
        buyer,
        fromBuyer
      )

      totalSupplyCollection1 = await collection1.totalSupply()
      expect(totalSupplyCollection1).to.be.eq.BN(0)

      totalSupplyCollection2 = await collection2.totalSupply()
      expect(totalSupplyCollection2).to.be.eq.BN(1)

      const item2 = await collection2.items(2)
      expect(item2.totalSupply).to.be.eq.BN(1)

      expect(logs.length).to.be.equal(2)

      expect(logs[0].event).to.be.equal('Issue')
      expect(logs[0].args._beneficiary).to.be.equal(buyer)
      expect(logs[0].args._tokenId).to.be.eq.BN(encodeTokenId(2, 1))
      expect(logs[0].args._itemId).to.be.eq.BN(2)
      expect(logs[0].args._issuedId).to.be.eq.BN(1)

      expect(logs[1].event).to.be.equal('Bought')
      expect(logs[1].args._itemsToBuy).to.be.eql([
        [collection2.address, ['2'], ['0']],
      ])
      expect(logs[1].args._beneficiary).to.be.equal(buyer)

      await buyerBalance.requireConstant()
      await beneficiaryBalance.requireConstant()
      await feeOwnerBalance.requireConstant()
      await storeBalance.requireConstant()

      itemsBalanceOfBuyer = await collection2.balanceOf(buyer)
      expect(itemsBalanceOfBuyer).to.be.eq.BN(1)

      const itemId = await collection2.tokenOfOwnerByIndex(buyer, 0)
      const uri = await collection2.tokenURI(itemId)
      const uriArr = uri.split('/')
      expect(2).to.eq.BN(uriArr[uriArr.length - 2])
    })

    it('should buy more than 1 item from different collections', async function () {
      let totalSupplyCollection1 = await collection1.totalSupply()
      expect(totalSupplyCollection1).to.be.eq.BN(0)

      let totalSupplyCollection2 = await collection2.totalSupply()
      expect(totalSupplyCollection2).to.be.eq.BN(0)

      const buyerBalance = await balanceSnap(manaContract, buyer, 'buyer')
      const beneficiaryBalance = await balanceSnap(
        manaContract,
        BENEFICIARY_ADDRESS,
        'beneficiary collection 1'
      )
      const otherBeneficiaryBalance = await balanceSnap(
        manaContract,
        OTHER_BENEFICIARY_ADDRESS,
        'beneficiary collection 2'
      )
      const feeOwnerBalance = await balanceSnap(
        manaContract,
        feeOwner,
        'fee owner'
      )
      const storeBalance = await balanceSnap(
        manaContract,
        storeContract.address,
        'store'
      )

      let itemsCollection1BalanceOfBuyer = await collection1.balanceOf(buyer)
      expect(itemsCollection1BalanceOfBuyer).to.be.eq.BN(0)

      let itemsCollection2BalanceOfBuyer = await collection2.balanceOf(buyer)
      expect(itemsCollection2BalanceOfBuyer).to.be.eq.BN(0)

      const price10 = web3.utils.toBN(ITEMS[0][2])
      const price12 = web3.utils.toBN(ITEMS[2][2])
      const price20 = web3.utils.toBN(COLLECTION2_ITEMS[0][2])

      const finalPrice = price10.add(price10).add(price12).add(price20)

      const { logs } = await storeContract.buy(
        [
          [collection1.address, [0, 0, 2], [price10, price10, price12]],
          [collection2.address, [0], [price20]],
        ],
        buyer,
        fromBuyer
      )

      totalSupplyCollection1 = await collection1.totalSupply()
      expect(totalSupplyCollection1).to.be.eq.BN(3)

      totalSupplyCollection2 = await collection2.totalSupply()
      expect(totalSupplyCollection2).to.be.eq.BN(1)

      const item10 = await collection1.items(0)
      expect(item10.totalSupply).to.be.eq.BN(2)

      const item12 = await collection1.items(2)
      expect(item12.totalSupply).to.be.eq.BN(1)

      const item20 = await collection2.items(0)
      expect(item20.totalSupply).to.be.eq.BN(1)

      expect(logs.length).to.be.equal(10)

      const price10Fee = price10.mul(FEE).div(ONE_MILLION)
      let feeCharged = price10Fee
      expect(logs[0].event).to.be.equal('Transfer')
      expect(logs[0].args._from).to.be.equal(buyer)
      expect(logs[0].args._to.toLowerCase()).to.be.equal(
        BENEFICIARY_ADDRESS.toLowerCase()
      )
      expect(logs[0].args._value).to.be.eq.BN(price10.sub(price10Fee))

      expect(logs[1].event).to.be.equal('Issue')
      expect(logs[1].args._beneficiary).to.be.equal(buyer)
      expect(logs[1].args._tokenId).to.be.eq.BN(encodeTokenId(0, 1))
      expect(logs[1].args._itemId).to.be.eq.BN(0)
      expect(logs[1].args._issuedId).to.be.eq.BN(1)

      feeCharged = feeCharged.add(price10Fee)
      expect(logs[2].event).to.be.equal('Transfer')
      expect(logs[2].args._from).to.be.equal(buyer)
      expect(logs[2].args._to.toLowerCase()).to.be.equal(
        BENEFICIARY_ADDRESS.toLowerCase()
      )
      expect(logs[2].args._value).to.be.eq.BN(price10.sub(price10Fee))

      expect(logs[3].event).to.be.equal('Issue')
      expect(logs[3].args._beneficiary).to.be.equal(buyer)
      expect(logs[3].args._tokenId).to.be.eq.BN(encodeTokenId(0, 2))
      expect(logs[3].args._itemId).to.be.eq.BN(0)
      expect(logs[3].args._issuedId).to.be.eq.BN(2)

      const price12Fee = price12.mul(FEE).div(ONE_MILLION)
      feeCharged = feeCharged.add(price12Fee)
      expect(logs[4].event).to.be.equal('Transfer')
      expect(logs[4].args._from).to.be.equal(buyer)
      expect(logs[4].args._to.toLowerCase()).to.be.equal(
        BENEFICIARY_ADDRESS.toLowerCase()
      )
      expect(logs[4].args._value).to.be.eq.BN(price12.sub(price12Fee))

      expect(logs[5].event).to.be.equal('Issue')
      expect(logs[5].args._beneficiary).to.be.equal(buyer)
      expect(logs[5].args._tokenId).to.be.eq.BN(encodeTokenId(2, 1))
      expect(logs[5].args._itemId).to.be.eq.BN(2)
      expect(logs[5].args._issuedId).to.be.eq.BN(1)

      const price20Fee = price20.mul(FEE).div(ONE_MILLION)
      feeCharged = feeCharged.add(price20Fee)
      expect(logs[6].event).to.be.equal('Transfer')
      expect(logs[6].args._from).to.be.equal(buyer)
      expect(logs[6].args._to.toLowerCase()).to.be.equal(
        OTHER_BENEFICIARY_ADDRESS.toLowerCase()
      )
      expect(logs[6].args._value).to.be.eq.BN(price20.sub(price20Fee))

      expect(logs[7].event).to.be.equal('Issue')
      expect(logs[7].args._beneficiary).to.be.equal(buyer)
      expect(logs[7].args._tokenId).to.be.eq.BN(encodeTokenId(0, 1))
      expect(logs[7].args._itemId).to.be.eq.BN(0)
      expect(logs[7].args._issuedId).to.be.eq.BN(1)

      expect(logs[8].event).to.be.equal('Transfer')
      expect(logs[8].args._from).to.be.equal(buyer)
      expect(logs[8].args._to).to.be.equal(feeOwner)
      expect(logs[8].args._value).to.be.eq.BN(feeCharged)

      expect(logs[9].event).to.be.equal('Bought')
      expect(logs[9].args._itemsToBuy).to.be.eql([
        [
          collection1.address,
          ['0', '0', '2'],
          [price10.toString(), price10.toString(), price12.toString()],
        ],
        [collection2.address, ['0'], [price20.toString()]],
      ])
      expect(logs[9].args._beneficiary).to.be.equal(buyer)

      await buyerBalance.requireDecrease(finalPrice)
      await beneficiaryBalance.requireIncrease(
        price10
          .add(price10)
          .add(price12)
          .sub(price10Fee.add(price10Fee).add(price12Fee))
      )
      await otherBeneficiaryBalance.requireIncrease(price20.sub(price20Fee))
      await feeOwnerBalance.requireIncrease(feeCharged)
      await storeBalance.requireConstant()

      itemsCollection1BalanceOfBuyer = await collection1.balanceOf(buyer)
      expect(itemsCollection1BalanceOfBuyer).to.be.eq.BN(3)

      itemsCollection2BalanceOfBuyer = await collection2.balanceOf(buyer)
      expect(itemsCollection2BalanceOfBuyer).to.be.eq.BN(1)

      let itemId = await collection1.tokenOfOwnerByIndex(buyer, 0)
      let uri = await collection1.tokenURI(itemId)
      let uriArr = uri.split('/')
      expect(0).to.eq.BN(uriArr[uriArr.length - 2])

      itemId = await collection1.tokenOfOwnerByIndex(buyer, 1)
      uri = await collection1.tokenURI(itemId)
      uriArr = uri.split('/')
      expect(0).to.eq.BN(uriArr[uriArr.length - 2])

      itemId = await collection1.tokenOfOwnerByIndex(buyer, 2)
      uri = await collection1.tokenURI(itemId)
      uriArr = uri.split('/')
      expect(2).to.eq.BN(uriArr[uriArr.length - 2])

      itemId = await collection2.tokenOfOwnerByIndex(buyer, 0)
      uri = await collection1.tokenURI(itemId)
      uriArr = uri.split('/')
      expect(0).to.eq.BN(uriArr[uriArr.length - 2])
    })

    it('should buy entire outfit :: gas checker', async function () {
      const { receipt } = await storeContract.buy(
        [
          [
            collection1.address,
            ITEMS.map((_, index) => index),
            ITEMS.map((i) => i[2]), // price
          ],
        ],
        buyer,
        fromBuyer
      )
    })

    it('reverts when buyer has not balance', async function () {
      await manaContract.approve(storeContract.address, -1, fromHacker)

      const balance = await manaContract.balanceOf(hacker)
      await manaContract.transfer(storeContract.address, balance, fromHacker)

      await assertRevert(
        storeContract.buy(
          [
            [
              collection1.address,
              [0], // id
              [ITEMS[0][2]], // price
            ],
          ],
          buyer,
          fromHacker
        )
      )
    })

    it('reverts when buyer has not approve the store to use the accepted token on his behalf', async function () {
      await assertRevert(
        storeContract.buy(
          [
            [
              collection1.address,
              [0], // id
              [ITEMS[0][2]], // price
            ],
          ],
          buyer,
          fromAnotherBuyer
        )
      )
    })

    it('reverts when trying to buy an item not part of the collection', async function () {
      const itemsCount = await collection1.itemsCount()
      await assertRevert(
        storeContract.buy(
          [
            [
              collection1.address,
              [itemsCount], // id
              [ITEMS[0][2]], // price
            ],
          ],
          buyer,
          fromBuyer
        ),
        'invalid opcode'
      )
    })

    it('reverts when trying to buy an item from a not allowed collection', async function () {
      await collection1.setMinters(
        [storeContract.address],
        [false],
        creationParams
      )

      await assertRevert(
        storeContract.buy(
          [
            [
              collection1.address,
              [0], // id
              [ITEMS[0][2]], // price
            ],
          ],
          buyer,
          fromBuyer
        ),
        'BCV2#_issueToken: CALLER_CAN_NOT_MINT'
      )
    })

    it('reverts when trying to buy more than the amount of items left', async function () {
      // Only 1 item left. Trying to buy 2
      await assertRevert(
        storeContract.buy(
          [
            [
              collection2.address,
              [1, 1], // id
              [COLLECTION2_ITEMS[1][2], COLLECTION2_ITEMS[1][2]], // price
            ],
          ],
          buyer,
          fromBuyer
        ),
        'BCV2#_issueToken: ITEM_EXHAUSTED'
      )

      // Buy item left
      await storeContract.buy(
        [
          [
            collection2.address,
            [1], // id
            [COLLECTION2_ITEMS[1][2]], // price
          ],
        ],
        buyer,
        fromBuyer
      )

      // Try again
      await assertRevert(
        storeContract.buy(
          [
            [
              collection2.address,
              [1], // id
              [COLLECTION2_ITEMS[1][2]], // price
            ],
          ],
          buyer,
          fromBuyer
        ),
        'BCV2#_issueToken: ITEM_EXHAUSTED'
      )
    })

    it('reverts when item price mismatch', async function () {
      await assertRevert(
        storeContract.buy(
          [
            [
              collection1.address,
              [0, 0], // id
              [
                ITEMS[0][2],
                web3.utils.toBN(ITEMS[0][2]).add(web3.utils.toBN(1)),
              ], // price
            ],
          ],
          buyer,
          fromBuyer
        ),
        'CollectionStore#buy: ITEM_PRICE_MISMATCH'
      )
    })

    it('reverts when item id and price length mismatch', async function () {
      await assertRevert(
        storeContract.buy(
          [
            [
              collection1.address,
              [0, 0], // id
              [ITEMS[0][2]], // price
            ],
          ],
          buyer,
          fromBuyer
        ),
        'CollectionStore#buy: LENGTH_MISMATCH'
      )

      await assertRevert(
        storeContract.buy(
          [
            [
              collection1.address,
              [0], // id
              [ITEMS[0][2], ITEMS[0][2]], // price
            ],
          ],
          buyer,
          fromBuyer
        ),
        'CollectionStore#buy: LENGTH_MISMATCH'
      )
    })

    it('reverts when trying to buy an item from an invalid collection', async function () {
      await assertRevert(
        storeContract.buy(
          [
            [
              storeContract.address,
              [0], // id
              [ITEMS[0][2]], // price
            ],
          ],
          buyer,
          fromBuyer
        )
      )
    })
  })

  describe('setFee', function () {
    it('should set fee', async function () {
      const newFee = web3.utils.toBN(10)
      let currentFee = await storeContract.fee()
      expect(currentFee).to.be.eq.BN(FEE)

      let res = await storeContract.setFee(newFee, fromStoreOwner)
      let logs = res.logs

      expect(logs.length).to.be.equal(1)

      expect(logs[0].event).to.be.equal('SetFee')
      expect(logs[0].args._oldFee).to.be.eq.BN(FEE)
      expect(logs[0].args._newFee).to.be.eq.BN(newFee)

      currentFee = await storeContract.fee()
      expect(currentFee).to.be.eq.BN(newFee)

      const price = web3.utils.toBN(ITEMS[0][2])
      res = await storeContract.buy(
        [[collection1.address, [0], [price]]],
        buyer,
        fromBuyer
      )
      logs = res.logs

      const item0 = await collection1.items(0)
      expect(item0.totalSupply).to.be.eq.BN(1)

      expect(logs.length).to.be.equal(4)

      const feeCharged = price.mul(newFee).div(ONE_MILLION)

      expect(logs[0].event).to.be.equal('Transfer')
      expect(logs[0].args._from).to.be.equal(buyer)
      expect(logs[0].args._to.toLowerCase()).to.be.equal(
        BENEFICIARY_ADDRESS.toLowerCase()
      )
      expect(logs[0].args._value).to.be.eq.BN(price.sub(feeCharged))

      expect(logs[1].event).to.be.equal('Issue')
      expect(logs[1].args._beneficiary).to.be.equal(buyer)
      expect(logs[1].args._tokenId).to.be.eq.BN(encodeTokenId(0, 1))
      expect(logs[1].args._itemId).to.be.eq.BN(0)
      expect(logs[1].args._issuedId).to.be.eq.BN(1)

      expect(logs[2].event).to.be.equal('Transfer')
      expect(logs[2].args._from).to.be.equal(buyer)
      expect(logs[2].args._to).to.be.equal(feeOwner)
      expect(logs[2].args._value).to.be.eq.BN(feeCharged)

      expect(logs[3].event).to.be.equal('Bought')
      expect(logs[3].args._itemsToBuy).to.be.eql([
        [collection1.address, ['0'], [price.toString()]],
      ])
      expect(logs[3].args._beneficiary).to.be.equal(buyer)
    })

    it('should set fee = 0', async function () {
      let currentFee = await storeContract.fee()
      expect(currentFee).to.be.eq.BN(FEE)

      await storeContract.setFee(0, fromStoreOwner)

      currentFee = await storeContract.fee()
      expect(currentFee).to.be.eq.BN(0)

      const price = web3.utils.toBN(ITEMS[0][2])
      const { logs } = await storeContract.buy(
        [[collection1.address, [0], [price]]],
        buyer,
        fromBuyer
      )

      const item0 = await collection1.items(0)
      expect(item0.totalSupply).to.be.eq.BN(1)

      expect(logs.length).to.be.equal(3)

      expect(logs[0].event).to.be.equal('Transfer')
      expect(logs[0].args._from).to.be.equal(buyer)
      expect(logs[0].args._to.toLowerCase()).to.be.equal(
        BENEFICIARY_ADDRESS.toLowerCase()
      )
      expect(logs[0].args._value).to.be.eq.BN(price)

      expect(logs[1].event).to.be.equal('Issue')
      expect(logs[1].args._beneficiary).to.be.equal(buyer)
      expect(logs[1].args._tokenId).to.be.eq.BN(encodeTokenId(0, 1))
      expect(logs[1].args._itemId).to.be.eq.BN(0)
      expect(logs[1].args._issuedId).to.be.eq.BN(1)

      expect(logs[2].event).to.be.equal('Bought')
      expect(logs[2].args._itemsToBuy).to.be.eql([
        [collection1.address, ['0'], [price.toString()]],
      ])
      expect(logs[2].args._beneficiary).to.be.equal(buyer)
    })

    it('reverts when set the fee >= ONE_MILLION', async function () {
      await assertRevert(
        storeContract.setFee(ONE_MILLION, fromStoreOwner),
        'CollectionStore#setFee: FEE_SHOULD_BE_LOWER_THAN_1000000'
      )

      await assertRevert(
        storeContract.setFee(
          ONE_MILLION.add(web3.utils.toBN(1)),
          fromStoreOwner
        ),
        'CollectionStore#setFee: FEE_SHOULD_BE_LOWER_THAN_1000000'
      )
    })

    it('reverts when tryng to set the same fee', async function () {
      await assertRevert(
        storeContract.setFee(FEE, fromStoreOwner),
        'CollectionStore#setFee: SAME_FEE'
      )
    })

    it('reverts when trying to set the fee by hacker', async function () {
      await assertRevert(
        storeContract.setFee(10, fromHacker),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('setFeeOwner', function () {
    it('should set fee owner', async function () {
      let currentFeeOwner = await storeContract.feeOwner()
      expect(currentFeeOwner).to.be.equal(feeOwner)

      let res = await storeContract.setFeeOwner(user, fromStoreOwner)
      let logs = res.logs

      expect(logs.length).to.be.equal(1)

      expect(logs[0].event).to.be.equal('SetFeeOwner')
      expect(logs[0].args._oldFeeOwner).to.be.equal(feeOwner)
      expect(logs[0].args._newFeeOwner).to.be.equal(user)

      currentFeeOwner = await storeContract.feeOwner()
      expect(currentFeeOwner).to.be.equal(user)

      const price = web3.utils.toBN(ITEMS[0][2])
      res = await storeContract.buy(
        [[collection1.address, [0], [price]]],
        buyer,
        fromBuyer
      )
      logs = res.logs

      const item0 = await collection1.items(0)
      expect(item0.totalSupply).to.be.eq.BN(1)

      expect(logs.length).to.be.equal(4)

      const feeCharged = price.mul(FEE).div(ONE_MILLION)

      expect(logs[0].event).to.be.equal('Transfer')
      expect(logs[0].args._from).to.be.equal(buyer)
      expect(logs[0].args._to.toLowerCase()).to.be.equal(
        BENEFICIARY_ADDRESS.toLowerCase()
      )
      expect(logs[0].args._value).to.be.eq.BN(price.sub(feeCharged))

      expect(logs[1].event).to.be.equal('Issue')
      expect(logs[1].args._beneficiary).to.be.equal(buyer)
      expect(logs[1].args._tokenId).to.be.eq.BN(encodeTokenId(0, 1))
      expect(logs[1].args._itemId).to.be.eq.BN(0)
      expect(logs[1].args._issuedId).to.be.eq.BN(1)

      expect(logs[2].event).to.be.equal('Transfer')
      expect(logs[2].args._from).to.be.equal(buyer)
      expect(logs[2].args._to).to.be.equal(user)
      expect(logs[2].args._value).to.be.eq.BN(feeCharged)

      expect(logs[3].event).to.be.equal('Bought')
      expect(logs[3].args._itemsToBuy).to.be.eql([
        [collection1.address, ['0'], [price.toString()]],
      ])
      expect(logs[3].args._beneficiary).to.be.equal(buyer)
    })

    it('reverts when set the ZERO_ADDRESS as the fee owner', async function () {
      await assertRevert(
        storeContract.setFeeOwner(ZERO_ADDRESS, fromStoreOwner),
        'CollectionStore#setFeeOwner: INVALID_ADDRESS'
      )
    })

    it('reverts when tryng to set the same fee owner', async function () {
      await assertRevert(
        storeContract.setFeeOwner(feeOwner, fromStoreOwner),
        'CollectionStore#setFeeOwner: SAME_FEE_OWNER'
      )
    })

    it('reverts when trying to set the fee owner by hacker', async function () {
      await assertRevert(
        storeContract.setFeeOwner(user, fromHacker),
        'Ownable: caller is not the owner'
      )
    })
  })
})
