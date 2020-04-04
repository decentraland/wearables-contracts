import assertRevert from './helpers/assertRevert'
import { createDummyCollection, WEARABLES } from './helpers/collection'

const Donation = artifacts.require('DummyDonation')

describe('Donation', function () {
  // Contract
  let erc721Contract
  let donationContract

  // Donation
  const price = web3.utils.toBN(web3.utils.toWei('0.025', 'ether'))
  const donation = web3.utils.toBN(web3.utils.toWei('10', 'ether'))
  const maxNFTsPerTx = 25

  // Accounts
  let accounts
  let deployer
  let user
  let donationOwner
  let fundsRecipient
  let hacker
  let holder
  let fromUser
  let fromHacker
  let fromDeployer
  let fromDonationOwner
  let fromFundsRecipient

  let creationParams

  beforeEach(async function () {
    accounts = await web3.eth.getAccounts()
    deployer = accounts[0]
    user = accounts[1]
    holder = accounts[2]
    donationOwner = accounts[3]
    hacker = accounts[4]
    fundsRecipient = accounts[5]

    fromDonationOwner = { from: donationOwner }
    fromUser = { from: user }
    fromHacker = { from: hacker }
    fromFundsRecipient = { from: fundsRecipient }

    fromDeployer = { from: deployer }

    creationParams = {
      ...fromDeployer,
      gas: 6e6,
      gasPrice: 21e9,
    }

    erc721Contract = await createDummyCollection({
      allowed: user,
      creationParams,
    })

    donationContract = await Donation.new(
      fundsRecipient,
      erc721Contract.address,
      price,
      maxNFTsPerTx,
      fromDonationOwner
    )

    await erc721Contract.setAllowed(donationContract.address, true)

    // Clear funds recipient balance
    const recipientBalance = await web3.eth.getBalance(fundsRecipient)
    if (recipientBalance !== 0) {
      await web3.eth.sendTransaction({
        from: fundsRecipient,
        to: holder,
        value: recipientBalance,
        gasPrice: 0,
      })
    }
  })

  describe('Deploy', async function () {
    it('deploy with correct values', async function () {
      const contract = await Donation.new(
        fundsRecipient,
        erc721Contract.address,
        price,
        maxNFTsPerTx,
        fromDonationOwner
      )

      const recipient = await contract.fundsRecipient()
      const collectionContract = await contract.erc721Collection()
      const expectedPrice = await contract.price()
      const expectedMaxNFTsPerTx = await contract.maxNFTsPerTx()
      const amount = await contract.donations()

      expect(recipient).to.be.equal(fundsRecipient)
      expect(collectionContract).to.be.equal(erc721Contract.address)
      expect(expectedPrice).to.be.eq.BN(price)
      expect(expectedMaxNFTsPerTx).to.be.eq.BN(maxNFTsPerTx)
      expect(amount).to.be.eq.BN(0)
    })
  })

  describe('donate', function () {
    it('should donate', async function () {
      let totalSupply = await erc721Contract.totalSupply()
      expect(totalSupply).to.be.eq.BN(0)

      let recipientBalance = await web3.eth.getBalance(fundsRecipient)
      expect(recipientBalance).to.be.eq.BN(0)

      let amount = await donationContract.donations()
      expect(amount).to.be.eq.BN(0)

      const { logs } = await donationContract.donate({
        ...fromUser,
        value: donation,
      })

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('Donated')
      expect(logs[0].args._caller).to.be.equal(user)
      expect(logs[0].args._value).to.be.eq.BN(donation)

      totalSupply = await erc721Contract.totalSupply()
      expect(totalSupply).to.be.eq.BN(0)

      recipientBalance = await web3.eth.getBalance(fundsRecipient)
      expect(recipientBalance).to.be.eq.BN(donation)

      amount = await donationContract.donations()
      expect(amount).to.be.eq.BN(donation)
    })

    it('reverts when donating 0', async function () {
      await assertRevert(
        donationContract.donate({
          ...fromUser,
          value: 0,
        }),
        'The donation should be higher than 0'
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

      const amountOfNFTs = maxNFTsPerTx + 110
      const finalPrice = price.mul(web3.utils.toBN(amountOfNFTs))
      const { logs } = await donationContract.donateForNFT(WEARABLES[0].name, {
        ...fromUser,
        value: finalPrice,
      })

      totalSupply = await erc721Contract.totalSupply()
      expect(totalSupply).to.be.eq.BN(maxNFTsPerTx)

      issued = await erc721Contract.issued(hash)
      expect(logs.length).to.be.equal(maxNFTsPerTx + 1)
      expect(issued).to.be.eq.BN(maxNFTsPerTx)

      expect(logs[logs.length - 1].event).to.be.equal('DonatedForNFT')
      expect(logs[logs.length - 1].args._caller).to.be.equal(user)
      expect(logs[logs.length - 1].args._value).to.be.eq.BN(finalPrice)
      expect(logs[logs.length - 1].args._wearable).to.be.eq.BN(
        WEARABLES[0].name
      )
      expect(logs[logs.length - 1].args._issued).to.be.eq.BN(maxNFTsPerTx)

      recipientBalance = await web3.eth.getBalance(fundsRecipient)
      expect(recipientBalance).to.be.eq.BN(finalPrice)

      balanceOfUser = await erc721Contract.balanceOf(user)
      expect(balanceOfUser).to.be.eq.BN(maxNFTsPerTx)

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
        'invalid: trying to issue an exhausted wearable of nft'
      )
    })

    it('reverts when trying to mint an invalid wearable', async function () {
      await assertRevert(
        erc721Contract.issueToken(holder, 'invalid_masks', fromUser),
        'invalid: trying to issue an exhausted wearable of nft'
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

      for (let i = 0; i < maxIssuance - maxNFTsPerTx; i++) {
        await donationContract.donateForNFT(WEARABLES[1].name, {
          ...fromUser,
          value: price,
        })
      }

      canMint = await donationContract.canMint(
        WEARABLES[1].name,
        maxNFTsPerTx + 1
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
