import assertRevert from './helpers/assertRevert'

const BN = web3.utils.BN
const expect = require('chai').use(require('bn-chai')(BN)).expect

const ExclusiveMasks = artifacts.require('ExclusiveMasks')

describe('ExclusiveMasks', function() {
  this.timeout(100000)

  const BASE_URI =
    'https://api-wearables.decentraland.org/v1/sets/exclusive-masks/'

  let creationParams

  //kind
  const birdMask = 'bird_mask'
  const asianFox = 'asian_fox'
  const classicMask = 'classic_mask'
  const birdMaskHash = web3.utils.soliditySha3(birdMask)
  const asianFoxHash = web3.utils.soliditySha3(asianFox)
  const classicMaskHash = web3.utils.soliditySha3(classicMask)

  // tokens
  const mask1 = 0
  const mask2 = 1
  const mask3 = 2

  // Accounts
  let accounts
  let deployer
  let user
  let anotherUser
  let hacker
  let holder
  let anotherHolder
  let fromUser
  let fromHolder
  let fromHacker
  let fromDeployer

  // Contracts
  let exclusiveMasksContract

  beforeEach(async function() {
    // Create Listing environment
    accounts = await web3.eth.getAccounts()
    deployer = accounts[0]
    user = accounts[1]
    holder = accounts[2]
    anotherHolder = accounts[3]
    anotherUser = accounts[4]
    hacker = accounts[5]
    fromUser = { from: user }
    fromHolder = { from: holder }
    fromHacker = { from: hacker }

    fromDeployer = { from: deployer }

    creationParams = {
      ...fromDeployer,
      gas: 6e6,
      gasPrice: 21e9
    }

    exclusiveMasksContract = await ExclusiveMasks.new(
      user,
      BASE_URI,
      creationParams
    )
    await exclusiveMasksContract.getToken(holder, birdMask, fromUser)
    await exclusiveMasksContract.getToken(holder, birdMask, fromUser)
    await exclusiveMasksContract.getToken(anotherHolder, asianFox, fromUser)
  })

  describe('Constructor', function() {
    it('should be depoyed with valid arguments', async function() {
      const contract = await ExclusiveMasks.new(user, BASE_URI, creationParams)

      const baseURI = await contract.baseURI()
      const allowed = await contract.allowed()
      const owner = await contract.owner()

      expect(BASE_URI).to.be.equal(baseURI)
      expect(user).to.be.equal(allowed)
      expect(owner).to.be.equal(deployer)
    })
  })

  describe('Create', function() {
    it('should create a token', async function() {
      await exclusiveMasksContract.getToken(
        anotherHolder,
        classicMask,
        fromUser
      )

      // match issued
      const issued = await exclusiveMasksContract.issued(classicMaskHash)
      expect(issued).to.eq.BN(1)

      const totalSupply = await exclusiveMasksContract.totalSupply()

      // match owner
      const owner = await exclusiveMasksContract.ownerOf(
        totalSupply.toNumber() - 1
      )

      expect(owner).to.be.equal(anotherHolder)

      // match kind id
      const uri = await exclusiveMasksContract.tokenURI(
        totalSupply.toNumber() - 1
      )
      expect(issued).to.eq.BN(uri.split('/').pop())
    })

    it('reverts when creating a token by not allowed user', async function() {
      await assertRevert(
        exclusiveMasksContract.getToken(anotherHolder, classicMask, fromHacker),
        'Only allowed can create tokens'
      )
    })
  })

  describe('TransferBatch', function() {
    it('should transfer in batch', async function() {
      let ownerMask1 = await exclusiveMasksContract.ownerOf(mask1)
      let ownerMask2 = await exclusiveMasksContract.ownerOf(mask2)
      expect(ownerMask1).to.be.equal(holder)
      expect(ownerMask2).to.be.equal(holder)

      const { logs } = await exclusiveMasksContract.batchTransferFrom(
        holder,
        anotherHolder,
        [mask1, mask2],
        fromHolder
      )

      expect(logs.length).to.be.equal(2)
      expect(logs[0].event).to.be.equal('Transfer')
      expect(logs[0].args.from).to.be.equal(holder)
      expect(logs[0].args.to).to.be.equal(anotherHolder)
      expect(logs[0].args.tokenId).to.eq.BN(mask1)

      expect(logs[1].event).to.be.equal('Transfer')
      expect(logs[1].args.from).to.be.equal(holder)
      expect(logs[1].args.to).to.be.equal(anotherHolder)
      expect(logs[1].args.tokenId).to.eq.BN(mask2)

      ownerMask1 = await exclusiveMasksContract.ownerOf(mask1)
      ownerMask2 = await exclusiveMasksContract.ownerOf(mask2)
      expect(ownerMask1).to.be.equal(anotherHolder)
      expect(ownerMask2).to.be.equal(anotherHolder)
    })

    it('should safe transfer in batch', async function() {
      let ownerMask1 = await exclusiveMasksContract.ownerOf(mask1)
      let ownerMask2 = await exclusiveMasksContract.ownerOf(mask2)
      expect(ownerMask1).to.be.equal(holder)
      expect(ownerMask2).to.be.equal(holder)

      const { logs } = await exclusiveMasksContract.safeBatchTransferFrom(
        holder,
        anotherHolder,
        [mask1, mask2],
        fromHolder
      )

      expect(logs.length).to.be.equal(2)
      expect(logs[0].event).to.be.equal('Transfer')
      expect(logs[0].args.from).to.be.equal(holder)
      expect(logs[0].args.to).to.be.equal(anotherHolder)
      expect(logs[0].args.tokenId).to.eq.BN(mask1)

      expect(logs[1].event).to.be.equal('Transfer')
      expect(logs[1].args.from).to.be.equal(holder)
      expect(logs[1].args.to).to.be.equal(anotherHolder)
      expect(logs[1].args.tokenId).to.eq.BN(mask2)

      ownerMask1 = await exclusiveMasksContract.ownerOf(mask1)
      ownerMask2 = await exclusiveMasksContract.ownerOf(mask2)
      expect(ownerMask1).to.be.equal(anotherHolder)
      expect(ownerMask2).to.be.equal(anotherHolder)
    })

    it('should safe transfer in batch by operator', async function() {
      let ownerMask1 = await exclusiveMasksContract.ownerOf(mask1)
      let ownerMask2 = await exclusiveMasksContract.ownerOf(mask2)
      expect(ownerMask1).to.be.equal(holder)
      expect(ownerMask2).to.be.equal(holder)

      await exclusiveMasksContract.approve(hacker, mask1, fromHolder)
      await exclusiveMasksContract.approve(hacker, mask2, fromHolder)

      const { logs } = await exclusiveMasksContract.safeBatchTransferFrom(
        holder,
        anotherHolder,
        [mask1, mask2],
        fromHacker
      )

      expect(logs.length).to.be.equal(2)
      expect(logs[0].event).to.be.equal('Transfer')
      expect(logs[0].args.from).to.be.equal(holder)
      expect(logs[0].args.to).to.be.equal(anotherHolder)
      expect(logs[0].args.tokenId).to.eq.BN(mask1)

      expect(logs[1].event).to.be.equal('Transfer')
      expect(logs[1].args.from).to.be.equal(holder)
      expect(logs[1].args.to).to.be.equal(anotherHolder)
      expect(logs[1].args.tokenId).to.eq.BN(mask2)

      ownerMask1 = await exclusiveMasksContract.ownerOf(mask1)
      ownerMask2 = await exclusiveMasksContract.ownerOf(mask2)
      expect(ownerMask1).to.be.equal(anotherHolder)
      expect(ownerMask2).to.be.equal(anotherHolder)
    })

    it('should safe transfer in batch by approval for all', async function() {
      let ownerMask1 = await exclusiveMasksContract.ownerOf(mask1)
      let ownerMask2 = await exclusiveMasksContract.ownerOf(mask2)
      expect(ownerMask1).to.be.equal(holder)
      expect(ownerMask2).to.be.equal(holder)

      await exclusiveMasksContract.setApprovalForAll(hacker, true, fromHolder)

      const { logs } = await exclusiveMasksContract.safeBatchTransferFrom(
        holder,
        anotherHolder,
        [mask1, mask2],
        fromHacker
      )

      expect(logs.length).to.be.equal(2)
      expect(logs[0].event).to.be.equal('Transfer')
      expect(logs[0].args.from).to.be.equal(holder)
      expect(logs[0].args.to).to.be.equal(anotherHolder)
      expect(logs[0].args.tokenId).to.eq.BN(mask1)

      expect(logs[1].event).to.be.equal('Transfer')
      expect(logs[1].args.from).to.be.equal(holder)
      expect(logs[1].args.to).to.be.equal(anotherHolder)
      expect(logs[1].args.tokenId).to.eq.BN(mask2)

      ownerMask1 = await exclusiveMasksContract.ownerOf(mask1)
      ownerMask2 = await exclusiveMasksContract.ownerOf(mask2)
      expect(ownerMask1).to.be.equal(anotherHolder)
      expect(ownerMask2).to.be.equal(anotherHolder)
    })

    it('reverts when transfer in batch by unuthorized user', async function() {
      let ownerMask1 = await exclusiveMasksContract.ownerOf(mask1)
      let ownerMask2 = await exclusiveMasksContract.ownerOf(mask2)
      expect(ownerMask1).to.be.equal(holder)
      expect(ownerMask2).to.be.equal(holder)

      await assertRevert(
        exclusiveMasksContract.batchTransferFrom(
          holder,
          anotherHolder,
          [mask1, mask2],
          fromHacker
        ),
        'ERC721: transfer caller is not owner nor approved'
      )

      await assertRevert(
        exclusiveMasksContract.batchTransferFrom(
          holder,
          anotherHolder,
          [mask1, mask2, mask3],
          fromHolder
        ),
        'ERC721: transfer caller is not owner nor approved'
      )
    })
  })

  describe('Owner', function() {
    it('should set Allowed user', async function() {
      let allowed = await exclusiveMasksContract.allowed()
      expect(user).to.be.equal(allowed)

      const { logs } = await exclusiveMasksContract.setAllowed(
        anotherUser,
        fromDeployer
      )

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('Allowed')
      expect(logs[0].args._oldAllowed).to.be.equal(user)
      expect(logs[0].args._newAllowed).to.be.equal(anotherUser)

      allowed = await exclusiveMasksContract.allowed()
      expect(anotherUser).to.be.equal(allowed)
    })

    it('should set Base Uri user', async function() {
      const newBaseURI = 'https'

      let baseURI = await exclusiveMasksContract.baseURI()
      expect(BASE_URI).to.be.equal(baseURI)

      const { logs } = await exclusiveMasksContract.setBaseURI(
        newBaseURI,
        fromDeployer
      )

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('BaseURI')
      expect(logs[0].args._oldBaseURI).to.be.equal(BASE_URI)
      expect(logs[0].args._newBaseURI).to.be.equal(newBaseURI)

      baseURI = await exclusiveMasksContract.baseURI()
      expect(newBaseURI).to.be.equal(baseURI)

      const uri = await exclusiveMasksContract.tokenURI(mask1)

      const kindId = uri.split('/').pop()

      expect(uri).to.be.equal(`${newBaseURI}${birdMask}/${kindId}`)
    })

    it('reverts when not the owner try to change values', async function() {
      await assertRevert(
        exclusiveMasksContract.setAllowed(user, fromHacker),
        'Ownable: caller is not the owner'
      )

      await assertRevert(
        exclusiveMasksContract.setBaseURI('', fromHacker),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('Kinds', function() {
    it('should manage kind', async function() {
      let issued = await exclusiveMasksContract.issued(birdMaskHash)
      expect(issued).to.eq.BN(2)

      issued = await exclusiveMasksContract.issued(asianFoxHash)
      expect(issued).to.eq.BN(1)
    })

    it('should reach kind limit', async function() {
      const maxKind = await exclusiveMasksContract.maxIssuance(classicMaskHash)

      for (let i = 0; i < maxKind.toNumber(); i++) {
        await exclusiveMasksContract.getToken(holder, classicMask, fromUser)
      }

      const issued = await exclusiveMasksContract.issued(classicMaskHash)

      expect(issued).to.eq.BN(maxKind)

      await assertRevert(
        exclusiveMasksContract.getToken(holder, classicMask, fromUser),
        'invalid: trying to issue an exhausted kind of nft'
      )
    })

    it('reverts when create an invalid kind', async function() {
      await assertRevert(
        exclusiveMasksContract.getToken(holder, classicMask + 'a', fromUser),
        'invalid: trying to issue an exhausted kind of nft'
      )
    })
  })

  describe('URI', function() {
    it('should create tokens with correct URI', async function() {
      const uri = await exclusiveMasksContract.tokenURI(mask1)
      const owner = await exclusiveMasksContract.ownerOf(mask1)

      const kindId = uri.split('/').pop()

      expect(uri).to.be.equal(`${BASE_URI}${birdMask}/${kindId}`)
      expect(owner).to.be.equal(holder)
    })
  })
})
