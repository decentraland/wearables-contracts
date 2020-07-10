import { Mana, ADDRESS_INDEXES } from 'decentraland-contract-plugins'

import assertRevert from './helpers/assertRevert'
import { balanceSnap } from './helpers/balanceSnap'
import { createDummyCollection, WEARABLES } from './helpers/collection'

const Store = artifacts.require('DummySimpleStore')

describe.only('SimpleStore', function () {
  // Contract
  let erc721Contract
  let manaContract
  let storeContract
  let collection1
  let collection2

  // Store
  const price = web3.utils.toBN(web3.utils.toWei('100', 'ether'))
  const fees = web3.utils.toBN(25000) // 2.5%
  const million = web3.utils.toBN(1000000)

  // Accounts
  let accounts
  let deployer
  let user
  let buyer
  let anotherBuyer
  let collection1Beneficiary
  let collection2Beneficiary
  let storeOwner
  let fundsRecipient
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
      wearables: [
        { name: 'coco_mask', max: 10 },
        { name: 'turtle_mask', max: 100 },
      ],
      creationParams,
    })

    storeContract = await Store.new(
      manaContract.address,
      price,
      fees,
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
        price,
        fees,
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
      expect(contractPrice).to.be.eq.BN(price)
      expect(ownerCutPerMillion).to.be.eq.BN(fees)
      expect(beneficiary1).to.be.equal(collection1Beneficiary)
      expect(beneficiary2).to.be.equal(collection2Beneficiary)
    })
  })

  describe.only('buy', function () {
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

      expect(logs.length).to.be.equal(3)

      expect(logs[0].event).to.be.equal('Burn')
      expect(logs[0].args.burner).to.be.equal(storeContract.address)
      // expect(logs[1].args.value).to.be.eq.BN()

      expect(logs[1].event).to.be.equal('Issue')
      expect(logs[1].args._beneficiary).to.be.equal(buyer)
      expect(logs[1].args._tokenId).to.be.eq.BN(
        totalSupplyCollection1.toNumber() - 1
      )
      // expect(logs[1].args._wearableIdKey).to.be.equal(hash)
      // expect(logs[1].args._wearableId).to.be.equal(WEARABLES[3].name)
      // expect(logs[1].args._issuedId).to.eq.BN(issued)
      // expect(issued).to.be.eq.BN(1)

      expect(logs[2].event).to.be.equal('Bought')
      expect(logs[2].args._collectionAddress).to.be.equal(collection1.address)
      //expect(logs[2].args._wearableId).to.be.eq.BN(donation)
      expect(logs[2].args._price).to.be.eq.BN(price)

      await buyerBalance.requireDecrease(price)
      await storeBalance.requireConstant()
      await collection1BeneficiaryBalance.requireIncrease(
        price.sub(price.mul(fees).div(million))
      )
      await collection2BeneficiaryBalance.requireConstant()
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
  })

  describe('donateForNFT', function () {
    it('should donate for one NFT', async function () {
      const hash = await erc721Contract.getWearableKey(WEARABLES[3].name)

      let issued = await erc721Contract.issued(hash)
      let balanceOfUser = await erc721Contract.balanceOf(user)
      expect(issued).to.be.eq.BN(0)
      expect(balanceOfUser).to.be.eq.BN(0)

      let totalSupply = await erc721Contract.totalSupply()
      expect(totalSupply).to.be.eq.BN(0)

      let recipientBalance = await web3.eth.getBalance(fundsRecipient)
      expect(recipientBalance).to.be.eq.BN(0)

      let balanceOfContract = await web3.eth.getBalance(
        donationContract.address
      )
      expect(balanceOfUser).to.be.eq.BN(0)

      let amount = await donationContract.donations()
      expect(amount).to.be.eq.BN(0)

      const { logs } = await donationContract.donateForNFT(WEARABLES[3].name, {
        ...fromUser,
        value: price,
      })

      totalSupply = await erc721Contract.totalSupply()
      expect(totalSupply).to.be.eq.BN(1)

      issued = await erc721Contract.issued(hash)
      expect(logs.length).to.be.equal(2)
      expect(logs[0].event).to.be.equal('Issue')
      expect(logs[0].args._beneficiary).to.be.equal(user)
      expect(logs[0].args._tokenId).to.be.eq.BN(totalSupply.toNumber() - 1)
      expect(logs[0].args._wearableIdKey).to.be.equal(hash)
      expect(logs[0].args._wearableId).to.be.equal(WEARABLES[3].name)
      expect(logs[0].args._issuedId).to.eq.BN(issued)
      expect(issued).to.be.eq.BN(1)

      expect(logs[1].event).to.be.equal('DonatedForNFT')
      expect(logs[1].args._caller).to.be.equal(user)
      expect(logs[1].args._value).to.be.eq.BN(price)
      expect(logs[logs.length - 1].args._wearable).to.be.eq.BN(
        WEARABLES[3].name
      )
      expect(logs[1].args._issued).to.be.eq.BN(1)

      recipientBalance = await web3.eth.getBalance(fundsRecipient)
      expect(recipientBalance).to.be.eq.BN(price)

      balanceOfUser = await erc721Contract.balanceOf(user)
      expect(balanceOfUser).to.be.eq.BN(1)

      balanceOfContract = await web3.eth.getBalance(donationContract.address)
      expect(balanceOfContract).to.be.eq.BN(0)

      amount = await donationContract.donations()
      expect(amount).to.be.eq.BN(price)
    })

    it('should donate for multiple NFT', async function () {
      const hash = await erc721Contract.getWearableKey(WEARABLES[0].name)

      let issued = await erc721Contract.issued(hash)
      let balanceOfUser = await erc721Contract.balanceOf(user)
      expect(issued).to.be.eq.BN(0)
      expect(balanceOfUser).to.be.eq.BN(0)

      let totalSupply = await erc721Contract.totalSupply()
      expect(totalSupply).to.be.eq.BN(0)

      let recipientBalance = await web3.eth.getBalance(fundsRecipient)
      expect(recipientBalance).to.be.eq.BN(0)

      let balanceOfContract = await web3.eth.getBalance(
        donationContract.address
      )
      expect(balanceOfUser).to.be.eq.BN(0)

      let amount = await donationContract.donations()
      expect(amount).to.be.eq.BN(0)

      const amountOfNFTs = 19
      const finalPrice = price.mul(web3.utils.toBN(amountOfNFTs))
      const { logs } = await donationContract.donateForNFT(WEARABLES[0].name, {
        ...fromUser,
        value: finalPrice,
      })

      totalSupply = await erc721Contract.totalSupply()
      expect(totalSupply).to.be.eq.BN(amountOfNFTs)

      issued = await erc721Contract.issued(hash)
      expect(logs.length).to.be.equal(amountOfNFTs + 1)
      expect(issued).to.be.eq.BN(amountOfNFTs)

      expect(logs[logs.length - 1].event).to.be.equal('DonatedForNFT')
      expect(logs[logs.length - 1].args._caller).to.be.equal(user)
      expect(logs[logs.length - 1].args._value).to.be.eq.BN(finalPrice)
      expect(logs[logs.length - 1].args._wearable).to.be.eq.BN(
        WEARABLES[0].name
      )
      expect(logs[logs.length - 1].args._issued).to.be.eq.BN(amountOfNFTs)

      recipientBalance = await web3.eth.getBalance(fundsRecipient)
      expect(recipientBalance).to.be.eq.BN(finalPrice)

      balanceOfUser = await erc721Contract.balanceOf(user)
      expect(balanceOfUser).to.be.eq.BN(amountOfNFTs)

      balanceOfContract = await web3.eth.getBalance(donationContract.address)
      expect(balanceOfContract).to.be.eq.BN(0)

      amount = await donationContract.donations()
      expect(amount).to.be.eq.BN(finalPrice)
    })

    it('should issue the maximum set when donating too much', async function () {
      const hash = await erc721Contract.getWearableKey(WEARABLES[0].name)

      let issued = await erc721Contract.issued(hash)
      let balanceOfUser = await erc721Contract.balanceOf(user)
      expect(issued).to.be.eq.BN(0)
      expect(balanceOfUser).to.be.eq.BN(0)

      let totalSupply = await erc721Contract.totalSupply()
      expect(totalSupply).to.be.eq.BN(0)

      let recipientBalance = await web3.eth.getBalance(fundsRecipient)
      expect(recipientBalance).to.be.eq.BN(0)

      let balanceOfContract = await web3.eth.getBalance(
        donationContract.address
      )
      expect(balanceOfUser).to.be.eq.BN(0)

      let amount = await donationContract.donations()
      expect(amount).to.be.eq.BN(0)

      const amountOfNFTs = maxNFTsPerCall + 110
      const finalPrice = price.mul(web3.utils.toBN(amountOfNFTs))
      const { logs } = await donationContract.donateForNFT(WEARABLES[0].name, {
        ...fromUser,
        value: finalPrice,
      })

      totalSupply = await erc721Contract.totalSupply()
      expect(totalSupply).to.be.eq.BN(maxNFTsPerCall)

      issued = await erc721Contract.issued(hash)
      expect(logs.length).to.be.equal(maxNFTsPerCall + 1)
      expect(issued).to.be.eq.BN(maxNFTsPerCall)

      expect(logs[logs.length - 1].event).to.be.equal('DonatedForNFT')
      expect(logs[logs.length - 1].args._caller).to.be.equal(user)
      expect(logs[logs.length - 1].args._value).to.be.eq.BN(finalPrice)
      expect(logs[logs.length - 1].args._wearable).to.be.eq.BN(
        WEARABLES[0].name
      )
      expect(logs[logs.length - 1].args._issued).to.be.eq.BN(maxNFTsPerCall)

      recipientBalance = await web3.eth.getBalance(fundsRecipient)
      expect(recipientBalance).to.be.eq.BN(finalPrice)

      balanceOfUser = await erc721Contract.balanceOf(user)
      expect(balanceOfUser).to.be.eq.BN(maxNFTsPerCall)

      balanceOfContract = await web3.eth.getBalance(donationContract.address)
      expect(balanceOfContract).to.be.eq.BN(0)

      amount = await donationContract.donations()
      expect(amount).to.be.eq.BN(finalPrice)
    })

    it('should floor the amount of NFTs and keep all the donation', async function () {
      const hash = await erc721Contract.getWearableKey(WEARABLES[0].name)

      let issued = await erc721Contract.issued(hash)
      let balanceOfUser = await erc721Contract.balanceOf(user)
      expect(issued).to.be.eq.BN(0)
      expect(balanceOfUser).to.be.eq.BN(0)

      let totalSupply = await erc721Contract.totalSupply()
      expect(totalSupply).to.be.eq.BN(0)

      let recipientBalance = await web3.eth.getBalance(fundsRecipient)
      expect(recipientBalance).to.be.eq.BN(0)

      let balanceOfContract = await web3.eth.getBalance(
        donationContract.address
      )
      expect(balanceOfUser).to.be.eq.BN(0)

      let amount = await donationContract.donations()
      expect(amount).to.be.eq.BN(0)

      const amountOfNFTs = 19
      // Should return 18 NFTs for this price
      const finalPrice = price.mul(
        web3.utils.toBN(amountOfNFTs).sub(web3.utils.toBN(1))
      )
      const actualAmountOfNFTs = 18

      const { logs } = await donationContract.donateForNFT(WEARABLES[0].name, {
        ...fromUser,
        value: finalPrice,
      })

      totalSupply = await erc721Contract.totalSupply()
      expect(totalSupply).to.be.eq.BN(actualAmountOfNFTs)

      issued = await erc721Contract.issued(hash)
      expect(logs.length).to.be.equal(actualAmountOfNFTs + 1)
      expect(issued).to.be.eq.BN(actualAmountOfNFTs)

      expect(logs[logs.length - 1].event).to.be.equal('DonatedForNFT')
      expect(logs[logs.length - 1].args._caller).to.be.equal(user)
      expect(logs[logs.length - 1].args._value).to.be.eq.BN(finalPrice)
      expect(logs[logs.length - 1].args._wearable).to.be.eq.BN(
        WEARABLES[0].name
      )
      expect(logs[logs.length - 1].args._issued).to.be.eq.BN(actualAmountOfNFTs)

      recipientBalance = await web3.eth.getBalance(fundsRecipient)
      expect(recipientBalance).to.be.eq.BN(finalPrice)

      balanceOfUser = await erc721Contract.balanceOf(user)
      expect(balanceOfUser).to.be.eq.BN(actualAmountOfNFTs)

      balanceOfContract = await web3.eth.getBalance(donationContract.address)
      expect(balanceOfContract).to.be.eq.BN(0)

      amount = await donationContract.donations()
      expect(amount).to.be.eq.BN(finalPrice)
    })

    it('reverts when donating a value lower than the minimum acceptable', async function () {
      await assertRevert(
        donationContract.donateForNFT(WEARABLES[0].name, {
          ...fromUser,
          value: 0,
        }),
        'The donation should be higher or equal than the price'
      )

      const value = price.sub(web3.utils.toBN(1))
      await assertRevert(
        donationContract.donateForNFT(WEARABLES[0].name, {
          ...fromUser,
          value,
        }),
        'The donation should be higher or equal than the price'
      )
    })

    it('reverts when trying to mint an exhausted wearable', async function () {
      this.timeout(Infinity)
      const hash = await erc721Contract.getWearableKey(WEARABLES[0].name)

      const maxIssuance = await erc721Contract.maxIssuance(hash)

      for (let i = 0; i < maxIssuance; i++) {
        await donationContract.donateForNFT(WEARABLES[0].name, {
          ...fromUser,
          value: price,
        })
      }

      await assertRevert(
        donationContract.donateForNFT(WEARABLES[0].name, {
          ...fromUser,
          value: price,
        }),
        'The amount of wearables to issue is higher than its available supply'
      )

      // Check if the collection was exhausted too
      await assertRevert(
        erc721Contract.issueToken(holder, WEARABLES[0].name, fromUser),
        'Invalid issued id'
      )
    })

    it('reverts when trying to mint an invalid wearable', async function () {
      await assertRevert(
        erc721Contract.issueToken(holder, 'invalid_masks', fromUser),
        'Invalid issued id'
      )
    })
  })

  describe('canMint', function () {
    it('should return if a wearable can be minted', async function () {
      let canMint = await donationContract.canMint(WEARABLES[0].name, 0)
      expect(canMint).to.be.equal(true)

      const optionsCount = await erc721Contract.wearablesCount()

      for (let i = 0; i < optionsCount.toNumber(); i++) {
        canMint = await donationContract.canMint(WEARABLES[i].name, 1)
        expect(canMint).to.be.equal(true)
      }
    })

    it('should return false for an invalid wearable', async function () {
      const canMint = await donationContract.canMint('invalid_masks', 1)
      expect(canMint).to.be.equal(false)
    })

    it('should return false for an exhausted wearable', async function () {
      this.timeout(Infinity)
      let hash = await erc721Contract.getWearableKey(WEARABLES[0].name)

      let maxIssuance = await erc721Contract.maxIssuance(hash)

      for (let i = 0; i < maxIssuance; i++) {
        await donationContract.donateForNFT(WEARABLES[0].name, {
          ...fromUser,
          value: price,
        })
      }

      let canMint = await donationContract.canMint(WEARABLES[0].name, 1)
      expect(canMint).to.be.equal(false)

      hash = await erc721Contract.getWearableKey(WEARABLES[1].name)

      maxIssuance = await erc721Contract.maxIssuance(hash)

      for (let i = 0; i < maxIssuance - maxNFTsPerCall; i++) {
        await donationContract.donateForNFT(WEARABLES[1].name, {
          ...fromUser,
          value: price,
        })
      }

      canMint = await donationContract.canMint(
        WEARABLES[1].name,
        maxNFTsPerCall + 1
      )
      expect(canMint).to.be.equal(false)
    })
  })

  describe('balanceOf', function () {
    it('should return balance of wearables', async function () {
      const optionsCount = await erc721Contract.wearablesCount()

      for (let i = 0; i < optionsCount.toNumber(); i++) {
        const balance = await donationContract.balanceOf(WEARABLES[i].name)
        expect(balance).to.be.eq.BN(WEARABLES[i].max)
      }

      await erc721Contract.issueToken(holder, WEARABLES[0].name, fromUser)

      const hash = await erc721Contract.getWearableKey(WEARABLES[0].name)

      const issued = await await erc721Contract.issued(hash)
      expect(issued).to.be.eq.BN(1)

      const balance = await donationContract.balanceOf(WEARABLES[0].name)
      expect(balance).to.be.eq.BN(WEARABLES[0].max - 1)
    })

    it('should return 0 for an invalid wearable', async function () {
      const balance = await donationContract.balanceOf('invalid_masks')
      expect(balance).to.be.eq.BN(0)
    })
  })

  describe('donations', function () {
    it('should increase donations', async function () {
      let amount = await donationContract.donations()
      expect(amount).to.be.eq.BN(0)

      await donationContract.donate({
        ...fromUser,
        value: donation,
      })

      amount = await donationContract.donations()
      expect(amount).to.be.eq.BN(donation)

      await donationContract.donateForNFT(WEARABLES[0].name, {
        ...fromUser,
        value: price,
      })

      amount = await donationContract.donations()
      expect(amount).to.be.eq.BN(donation.add(price))
    })
  })
})
