import assertRevert from './helpers/assertRevert'
import {
  createDummyCollection,
  WEARABLES,
  BASE_URI
} from './helpers/collection'

const ProxyRegistry = artifacts.require('ProxyRegistry')
const ERC721CollectionFactory = artifacts.require(
  'DummyERC721CollectionFactory'
)

describe('Factory', function() {
  // Contract
  const name = 'Factory'
  const symbol = 'FCTR'

  let erc721Contract
  let proxyRegistry
  let factoryContract

  // Options
  const optionId0 = 0

  // Accounts
  let accounts
  let deployer
  let user
  let factoryOwner
  let factoryOwnerProxy
  let hacker
  let holder
  let fromUser
  let fromHacker
  let fromFactoryOwner
  let fromFactoryOwnerProxy
  let fromDeployer

  let creationParams

  beforeEach(async function() {
    accounts = await web3.eth.getAccounts()
    deployer = accounts[0]
    user = accounts[1]
    holder = accounts[2]
    factoryOwner = accounts[3]
    hacker = accounts[4]
    factoryOwnerProxy = accounts[5]

    fromFactoryOwner = { from: factoryOwner }
    fromUser = { from: user }
    fromHacker = { from: hacker }
    fromFactoryOwnerProxy = { from: factoryOwnerProxy }

    fromDeployer = { from: deployer }

    creationParams = {
      ...fromDeployer,
      gas: 6e6,
      gasPrice: 21e9
    }

    proxyRegistry = await ProxyRegistry.new()
    proxyRegistry.setProxy(factoryOwnerProxy, fromFactoryOwner)

    erc721Contract = await createDummyCollection({
      allowed: user,
      creationParams
    })

    factoryContract = await ERC721CollectionFactory.new(
      name,
      symbol,
      BASE_URI,
      proxyRegistry.address,
      erc721Contract.address,
      fromFactoryOwner
    )

    await erc721Contract.setAllowed(factoryContract.address, true)
  })

  describe('create factory', async function() {
    it('deploy with correct values', async function() {
      const contract = await ERC721CollectionFactory.new(
        name,
        symbol,
        BASE_URI,
        proxyRegistry.address,
        erc721Contract.address,
        fromFactoryOwner
      )

      const _name = await contract.name()
      const _symbol = await contract.symbol()
      const _baseURI = await contract.baseURI()
      const owner = await contract.owner()
      const proxyRegistryContract = await contract.proxyRegistry()
      const collectionContract = await contract.erc721Collection()
      const optionsCount = await contract.numOptions()

      expect(_name).to.be.equal(name)
      expect(_symbol).to.be.equal(symbol)
      expect(_baseURI).to.be.equal(BASE_URI)
      expect(owner).to.be.equal(factoryOwner)
      expect(proxyRegistryContract).to.be.equal(proxyRegistry.address)
      expect(collectionContract).to.be.equal(erc721Contract.address)
      expect(optionsCount).to.be.eq.BN(WEARABLES.length)
    })
  })

  describe('mint', function() {
    it('should mint', async function() {
      const wearableId = await erc721Contract.wearables(optionId0)
      const hash = await erc721Contract.getWearableKey(wearableId)

      let issued = await erc721Contract.issued(hash)
      let balanceOfHolder = await erc721Contract.balanceOf(holder)

      expect(wearableId).to.be.equal(WEARABLES[optionId0].name)
      expect(issued).to.be.eq.BN(0)
      expect(balanceOfHolder).to.be.eq.BN(0)

      const { logs } = await factoryContract.mint(
        optionId0,
        holder,
        fromFactoryOwnerProxy
      )

      const totalSupply = await erc721Contract.totalSupply()

      issued = await erc721Contract.issued(hash)

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('Issue')
      expect(logs[0].args._beneficiary).to.be.equal(holder)
      expect(logs[0].args._tokenId).to.be.eq.BN(totalSupply.toNumber() - 1)
      expect(logs[0].args._wearableIdKey).to.be.equal(hash)
      expect(logs[0].args._wearableId).to.be.equal(WEARABLES[optionId0].name)
      expect(logs[0].args._issuedId).to.eq.BN(issued)

      expect(issued).to.be.eq.BN(1)
      balanceOfHolder = await erc721Contract.balanceOf(holder)
      expect(balanceOfHolder).to.be.eq.BN(1)
    })

    it('reverts when minting by an allowed address', async function() {
      await assertRevert(
        factoryContract.mint(optionId0, holder, fromHacker),
        'Only `allowed` proxy can issue tokens'
      )

      await assertRevert(
        factoryContract.mint(optionId0, holder, fromFactoryOwner),
        'Only `allowed` proxy can issue tokens'
      )
    })

    it('reverts when minting an invalid option', async function() {
      const optionsCount = await factoryContract.numOptions()
      await assertRevert(
        factoryContract.mint(optionsCount, holder, fromFactoryOwnerProxy),
        'Invalid wearable'
      )
    })

    it('reverts when minting an exhausted option', async function() {
      const wearableId = await erc721Contract.wearables(optionId0)
      const hash = await erc721Contract.getWearableKey(wearableId)

      const maxKind = await erc721Contract.maxIssuance(hash)

      let canMint = await factoryContract.canMint(optionId0)
      expect(canMint).to.be.equal(true)

      for (let i = 0; i < maxKind.toNumber(); i++) {
        await erc721Contract.issueToken(holder, wearableId, fromUser)
      }

      await assertRevert(
        factoryContract.mint(optionId0, holder, fromFactoryOwnerProxy),
        'Exhausted wearable'
      )

      canMint = await factoryContract.canMint(optionId0)
      expect(canMint).to.be.equal(false)
    })

    it('reverts when querying if an option can be minted', async function() {
      await assertRevert(factoryContract.canMint(optionId0 - 1))
    })
  })

  describe('transferFrom', function() {
    it('should transferFrom', async function() {
      const wearableId = await erc721Contract.wearables(optionId0)
      const hash = await erc721Contract.getWearableKey(wearableId)

      let issued = await erc721Contract.issued(hash)
      let balanceOfHolder = await erc721Contract.balanceOf(holder)

      expect(wearableId).to.be.equal(WEARABLES[optionId0].name)
      expect(issued).to.be.eq.BN(0)
      expect(balanceOfHolder).to.be.eq.BN(0)

      const { logs } = await factoryContract.transferFrom(
        hacker,
        holder,
        optionId0,
        fromFactoryOwnerProxy
      )

      const totalSupply = await erc721Contract.totalSupply()

      issued = await erc721Contract.issued(hash)

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('Issue')
      expect(logs[0].args._beneficiary).to.be.equal(holder)
      expect(logs[0].args._tokenId).to.be.eq.BN(totalSupply.toNumber() - 1)
      expect(logs[0].args._wearableIdKey).to.be.equal(hash)
      expect(logs[0].args._wearableId).to.be.equal(WEARABLES[optionId0].name)
      expect(logs[0].args._issuedId).to.eq.BN(issued)

      expect(issued).to.be.eq.BN(1)
      balanceOfHolder = await erc721Contract.balanceOf(holder)
      expect(balanceOfHolder).to.be.eq.BN(1)
    })

    it('reverts when transferFrom by an allowed address', async function() {
      await assertRevert(
        factoryContract.transferFrom(hacker, holder, optionId0, fromHacker),
        'Only `allowed` proxy can issue tokens'
      )

      await assertRevert(
        factoryContract.transferFrom(
          hacker,
          holder,
          optionId0,
          fromFactoryOwner
        ),
        'Only `allowed` proxy can issue tokens'
      )
    })

    it('reverts when transferFrom an invalid option', async function() {
      const optionsCount = await factoryContract.numOptions()
      await assertRevert(
        factoryContract.transferFrom(
          hacker,
          holder,
          optionsCount,
          fromFactoryOwnerProxy
        ),
        'Invalid wearable'
      )
    })

    it('reverts when transferFrom an exhausted option', async function() {
      const wearableId = await erc721Contract.wearables(optionId0)
      const hash = await erc721Contract.getWearableKey(wearableId)

      const maxKind = await erc721Contract.maxIssuance(hash)

      let canMint = await factoryContract.canMint(optionId0)
      expect(canMint).to.be.equal(true)

      for (let i = 0; i < maxKind.toNumber(); i++) {
        await erc721Contract.issueToken(holder, wearableId, fromUser)
      }

      await assertRevert(
        factoryContract.transferFrom(
          hacker,
          holder,
          optionId0,
          fromFactoryOwnerProxy
        ),
        'Exhausted wearable'
      )

      canMint = await factoryContract.canMint(optionId0)
      expect(canMint).to.be.equal(false)
    })
  })

  describe('Owner', function() {
    it('should set Base URI', async function() {
      const newBaseURI = 'https'

      let _baseURI = await factoryContract.baseURI()
      expect(_baseURI).to.be.equal(BASE_URI)

      const { logs } = await factoryContract.setBaseURI(
        newBaseURI,
        fromFactoryOwner
      )

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('BaseURI')
      expect(logs[0].args._oldBaseURI).to.be.equal(_baseURI)
      expect(logs[0].args._newBaseURI).to.be.equal(newBaseURI)

      const wearableId = await erc721Contract.wearables(optionId0)
      const uri = await factoryContract.tokenURI(optionId0)

      _baseURI = await factoryContract.baseURI()

      expect(_baseURI).to.be.equal(newBaseURI)
      expect(wearableId).to.be.equal(WEARABLES[optionId0].name)
      expect(uri).to.be.equal(newBaseURI + WEARABLES[optionId0].name)
    })

    it('reverts when trying to change values by hacker', async function() {
      await assertRevert(
        factoryContract.setBaseURI('', fromHacker),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('approval', function() {
    it('should return valid isApprovedForAll', async function() {
      let isApprovedForAll = await factoryContract.isApprovedForAll(
        factoryOwner,
        factoryOwner
      )
      expect(isApprovedForAll).to.be.equal(true)

      isApprovedForAll = await factoryContract.isApprovedForAll(
        factoryOwner,
        factoryOwnerProxy
      )
      expect(isApprovedForAll).to.be.equal(true)

      isApprovedForAll = await factoryContract.isApprovedForAll(
        user,
        factoryOwner
      )
      expect(isApprovedForAll).to.be.equal(false)

      isApprovedForAll = await factoryContract.isApprovedForAll(hacker, user)
      expect(isApprovedForAll).to.be.equal(false)
    })
  })

  describe('balanceOf', function() {
    it('should return balance of options', async function() {
      const optionsCount = await factoryContract.numOptions()

      for (let i = 0; i < optionsCount.toNumber(); i++) {
        const balance = await factoryContract.balanceOf(i)
        expect(balance).to.be.eq.BN(WEARABLES[i].max)
      }

      const wearableId = await erc721Contract.wearables(optionId0)

      await erc721Contract.issueToken(holder, wearableId, fromUser)

      const hash = await erc721Contract.getWearableKey(wearableId)
      const balance = await factoryContract.balanceOf(optionId0)

      const issued = await await erc721Contract.issued(hash)
      expect(balance).to.be.eq.BN(WEARABLES[optionId0].max - issued.toNumber())
    })

    it('reverts for an invalid option', async function() {
      await assertRevert(factoryContract.balanceOf(optionId0 - 1))
    })
  })

  describe('proxies', function() {
    it('should return proxy count', async function() {
      const proxy = await factoryContract.proxies(factoryOwner)
      expect(proxy).to.be.equal(factoryOwnerProxy)
    })
  })

  describe('numOptions', function() {
    it('should return options count', async function() {
      const optionsCount = await factoryContract.numOptions()
      expect(optionsCount).to.be.eq.BN(WEARABLES.length)
    })
  })

  describe('supportsFactoryInterface', function() {
    it('should return support factory interface', async function() {
      const supported = await factoryContract.supportsFactoryInterface()
      expect(supported).to.be.equal(true)
    })
  })

  describe('ownerOf', function() {
    it('should return owner of options', async function() {
      const wearablesCount = await erc721Contract.wearablesCount()
      for (let i = 0; i < wearablesCount.toNumber(); i++) {
        const owner = await factoryContract.ownerOf(i)
        expect(owner).to.be.equal(factoryOwner)
      }
    })

    it('should return the owner event if the option is invalid', async function() {
      const owner = await factoryContract.ownerOf(-1)
      expect(owner).to.be.equal(factoryOwner)
    })
  })
})
