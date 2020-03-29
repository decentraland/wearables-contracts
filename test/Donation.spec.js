import assertRevert from './helpers/assertRevert'
import { createDummyCollection, WEARABLES } from './helpers/collection'

const Donation = artifacts.require('DummyDonation')

describe('Donation', function () {
  const initialbalance = web3.utils.toBN(web3.utils.toWei('10000', 'ether'))

  // Contract
  let erc721Contract
  let donationContract

  // Options
  const optionId0 = 0

  // Donation
  const minDonation = web3.utils.toBN(web3.utils.toWei('0.025', 'ether'))
  const donation = web3.utils.toBN(web3.utils.toWei('10', 'ether'))

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
      minDonation,
      WEARABLES[0].max,
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

  describe('create factory', async function () {
    it('deploy with correct values', async function () {
      const contract = await Donation.new(
        fundsRecipient,
        erc721Contract.address,
        minDonation,
        WEARABLES[0].max,
        fromDonationOwner
      )

      const recipient = await contract.fundsRecipient()
      const collectionContract = await contract.erc721Collection()
      const minDonationAcceptable = await contract.minDonation()
      const maxOptions = await contract.maxOptions()
      const maxIssuance = await contract.maxIssuance()
      const issued = await contract.issued()
      const amount = await contract.donations()

      expect(recipient).to.be.equal(fundsRecipient)
      expect(collectionContract).to.be.equal(erc721Contract.address)
      expect(minDonationAcceptable).to.be.eq.BN(minDonation)
      expect(maxOptions).to.be.eq.BN(WEARABLES.length)
      expect(maxIssuance).to.be.eq.BN(WEARABLES.length * WEARABLES[0].max)
      expect(issued).to.be.eq.BN(0)
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
    it('should donate for an NFT', async function () {
      const wearableId = await erc721Contract.wearables(optionId0)
      const hash = await erc721Contract.getWearableKey(wearableId)
      let issued = await erc721Contract.issued(hash)
      let balanceOfUser = await erc721Contract.balanceOf(user)
      expect(wearableId).to.be.equal(WEARABLES[optionId0].name)
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

      let donatedIssued = await donationContract.issued()
      expect(donatedIssued).to.be.eq.BN(0)

      let amount = await donationContract.donations()
      expect(amount).to.be.eq.BN(0)

      const { logs } = await donationContract.donateForNFT({
        ...fromUser,
        value: donation,
      })

      totalSupply = await erc721Contract.totalSupply()
      expect(totalSupply).to.be.eq.BN(1)

      issued = await erc721Contract.issued(hash)
      expect(logs.length).to.be.equal(2)
      expect(logs[0].event).to.be.equal('Issue')
      expect(logs[0].args._beneficiary).to.be.equal(user)
      expect(logs[0].args._tokenId).to.be.eq.BN(totalSupply.toNumber() - 1)
      expect(logs[0].args._wearableIdKey).to.be.equal(hash)
      expect(logs[0].args._wearableId).to.be.equal(WEARABLES[optionId0].name)
      expect(logs[0].args._issuedId).to.eq.BN(issued)
      expect(issued).to.be.eq.BN(1)

      expect(logs[1].event).to.be.equal('DonatedForNFT')
      expect(logs[1].args._caller).to.be.equal(user)
      expect(logs[1].args._value).to.be.eq.BN(donation)
      expect(logs[1].args._optionId).to.be.eq.BN(optionId0)
      expect(logs[1].args._wearable).to.be.eq.BN(WEARABLES[optionId0].name)

      recipientBalance = await web3.eth.getBalance(fundsRecipient)
      expect(recipientBalance).to.be.eq.BN(donation)

      balanceOfUser = await erc721Contract.balanceOf(user)
      expect(balanceOfUser).to.be.eq.BN(1)

      balanceOfContract = await web3.eth.getBalance(donationContract.address)
      expect(balanceOfContract).to.be.eq.BN(0)

      donatedIssued = await donationContract.issued()
      expect(donatedIssued).to.be.eq.BN(1)

      amount = await donationContract.donations()
      expect(amount).to.be.eq.BN(donation)
    })

    it('should increase last issued and reset', async function () {
      let totalSupply = await erc721Contract.totalSupply()
      expect(totalSupply).to.be.eq.BN(0)

      let recipientBalance = await web3.eth.getBalance(fundsRecipient)
      expect(recipientBalance).to.be.eq.BN(0)

      let donatedIssued = await donationContract.issued()
      expect(donatedIssued).to.be.eq.BN(0)

      let amount = await donationContract.donations()
      expect(amount).to.be.eq.BN(0)

      for (let i = 0; i <= WEARABLES.length; i++) {
        const { logs } = await donationContract.donateForNFT({
          ...fromUser,
          value: minDonation,
        })

        let optionId = i
        let issued = 1
        if (i === WEARABLES.length) {
          optionId = 0
          issued = 2
        }

        totalSupply = await erc721Contract.totalSupply()

        expect(logs.length).to.be.equal(2)
        expect(logs[0].event).to.be.equal('Issue')
        expect(logs[0].args._beneficiary).to.be.equal(user)
        expect(logs[0].args._tokenId).to.be.eq.BN(totalSupply.toNumber() - 1)
        expect(logs[0].args._wearableId).to.be.equal(WEARABLES[optionId].name)
        expect(logs[0].args._issuedId).to.eq.BN(issued)

        expect(logs[1].event).to.be.equal('DonatedForNFT')
        expect(logs[1].args._caller).to.be.equal(user)
        expect(logs[1].args._value).to.be.eq.BN(minDonation)
        expect(logs[1].args._optionId).to.be.eq.BN(optionId)
        expect(logs[1].args._wearable).to.be.eq.BN(WEARABLES[optionId].name)
      }

      donatedIssued = await donationContract.issued()
      expect(donatedIssued).to.be.eq.BN(WEARABLES.length + 1)

      totalSupply = await erc721Contract.totalSupply()
      expect(totalSupply).to.be.eq.BN(WEARABLES.length + 1)

      recipientBalance = await web3.eth.getBalance(fundsRecipient)
      expect(recipientBalance).to.be.eq.BN(
        minDonation.mul(web3.utils.toBN(WEARABLES.length + 1))
      )

      amount = await donationContract.donations()
      expect(amount).to.be.eq.BN(
        minDonation.mul(web3.utils.toBN(WEARABLES.length + 1))
      )
    })

    it('reverts when donating a value lower than the minimum acceptable', async function () {
      await assertRevert(
        donationContract.donateForNFT({
          ...fromUser,
          value: 0,
        }),
        'The donation should be higher or equal than the minimum donation ETH'
      )

      const value = minDonation.sub(web3.utils.toBN(1))
      await assertRevert(
        donationContract.donateForNFT({
          ...fromUser,
          value,
        }),
        'The donation should be higher or equal than the minimum donation ETH'
      )
    })

    it('reverts when trying to mint a completed collection', async function () {
      this.timeout(Infinity)
      const maxIssuance = await donationContract.maxIssuance()

      for (let i = 0; i < maxIssuance; i++) {
        await donationContract.donateForNFT({
          ...fromUser,
          value: minDonation,
        })
      }

      await assertRevert(
        donationContract.donateForNFT({
          ...fromUser,
          value: minDonation,
        }),
        'All wearables have been minted'
      )

      // Check if the collection was exhausted too
      for (let i = 0; i < WEARABLES.length; i++) {
        await assertRevert(
          erc721Contract.issueToken(holder, WEARABLES[i].name, fromUser),
          'invalid: trying to issue an exhausted wearable of nft'
        )
      }
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

      await donationContract.donateForNFT({
        ...fromUser,
        value: minDonation,
      })

      amount = await donationContract.donations()
      expect(amount).to.be.eq.BN(donation.add(minDonation))
    })
  })
})
