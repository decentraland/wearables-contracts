import { keccak256 } from '@ethersproject/solidity'
import { randomBytes } from '@ethersproject/random'

import assertRevert from '../helpers/assertRevert'
import {
  createDummyCollection,
  getInitData,
  WEARABLES,
  BASE_URI,
  ZERO_ADDRESS,
} from '../helpers/collectionV2'
import { expect } from 'chai'

const ERC721CollectionFactoryV2 = artifacts.require('ERC721CollectionFactoryV2')
const ERC721CollectionV2 = artifacts.require('ERC721CollectionV2')

describe.only('Factory', function () {
  let collectionContract
  let collectionImplementation
  let factoryContract

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

  beforeEach(async function () {
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
      gas: 9e6,
      gasPrice: 21e9,
    }

    collectionImplementation = await ERC721CollectionV2.new()

    factoryContract = await ERC721CollectionFactoryV2.new(
      collectionImplementation.address,
      factoryOwner
    )

    collectionContract = await createDummyCollection(factoryContract, {
      creator: user,
      shouldComplete: true,
      creationParams,
    })
  })

  describe('create factory', async function () {
    it('deploy with correct values', async function () {
      const collectionImpl = await ERC721CollectionV2.new(creationParams)
      const contract = await ERC721CollectionFactoryV2.new(
        collectionImpl.address,
        factoryOwner
      )

      const impl = await contract.implementation()
      const owner = await contract.owner()
      const code = await contract.code()
      const codeHash = await contract.codeHash()

      const expectedCode = `0x3d602d80600a3d3981f3363d3d373d3d3d363d73${collectionImpl.address.replace(
        '0x',
        ''
      )}5af43d82803e903d91602b57fd5bf3`

      expect(impl).to.be.equal(collectionImpl.address)
      expect(owner).to.be.equal(factoryOwner)
      expect(expectedCode.toLowerCase()).to.be.equal(code.toLowerCase())
      expect(web3.utils.soliditySha3(expectedCode)).to.be.equal(codeHash)
    })
  })

  describe('createCollection', function () {
    it('should set an implementation', async function () {
      let impl = await factoryContract.implementation()
      expect(impl).to.be.equal(collectionImplementation.address)

      const newImpl = await ERC721CollectionV2.new()

      const { logs } = await factoryContract.setImplementation(
        newImpl.address,
        fromFactoryOwner
      )

      const expectedCode = `0x3d602d80600a3d3981f3363d3d373d3d3d363d73${newImpl.address.replace(
        '0x',
        ''
      )}5af43d82803e903d91602b57fd5bf3`

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('ImplementationChanged')
      expect(logs[0].args._implementation).to.be.equal(newImpl.address)
      expect(logs[0].args._code.toLowerCase()).to.be.equal(
        expectedCode.toLowerCase()
      )
      expect(logs[0].args._codeHash).to.be.equal(
        keccak256(['bytes'], [expectedCode])
      )

      impl = await factoryContract.implementation()
      expect(impl).to.be.equal(newImpl.address)
    })

    it('reverts when trying to change the implementation by hacker', async function () {
      const newImpl = await ERC721CollectionV2.new()
      await assertRevert(
        factoryContract.setImplementation(newImpl.address, fromHacker),
        'Ownable: caller is not the owner'
      )
    })

    it('reverts when trying to change with an invalid implementation', async function () {
      await assertRevert(
        factoryContract.setImplementation(user, fromFactoryOwner),
        'MinimalProxyFactoryV2#_setImplementation: INVALID_IMPLEMENTATION'
      )

      await assertRevert(
        factoryContract.setImplementation(ZERO_ADDRESS, fromFactoryOwner),
        'MinimalProxyFactoryV2#_setImplementation: INVALID_IMPLEMENTATION'
      )
    })
  })

  describe.only('getAddress', function () {
    it('should get a deterministic address on-chain', async function () {
      const salt = randomBytes(32)
      const expectedAddress = await factoryContract.getAddress(salt, user)

      const { logs } = await factoryContract.createCollection(
        salt,
        getInitData({
          creator: user,
          shouldComplete: true,
          creationParams,
        }),
        fromUser
      )

      expect(logs[0].args._address.toLowerCase()).to.be.equal(
        expectedAddress.toLowerCase()
      )
    })

    it('should get a deterministic address off-chain', async function () {
      const codeHash = await factoryContract.codeHash()

      const salt = randomBytes(32)

      const expectedAddress = `0x${keccak256(
        ['bytes1', 'address', 'bytes32', 'bytes32'],
        [
          '0xff',
          factoryContract.address,
          keccak256(['bytes32', 'address'], [salt, user]),
          codeHash,
        ]
      ).slice(-40)}`.toLowerCase()

      const { logs } = await factoryContract.createCollection(
        salt,
        getInitData({
          creator: user,
          shouldComplete: true,
          creationParams,
        }),
        fromUser
      )

      expect(logs[0].args._address.toLowerCase()).to.be.equal(
        expectedAddress.toLowerCase()
      )
    })
  })

  describe('createCollection', function () {
    it('should create a collection', async function () {
      const collectionV2Impl = await ERC721CollectionV2.new()

      await factoryContract.setImplementation(
        collectionV2Impl.address,
        factoryOwner
      )

      const data = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'string',
              name: '_name',
              type: 'string',
            },
            {
              internalType: 'string',
              name: '_symbol',
              type: 'string',
            },
            {
              internalType: 'address',
              name: '_creator',
              type: 'address',
            },
            {
              internalType: 'bool',
              name: '_shouldComplete',
              type: 'bool',
            },
            {
              internalType: 'string',
              name: '_baseURI',
              type: 'string',
            },
            {
              components: [
                {
                  internalType: 'uint256',
                  name: 'maxSupply',
                  type: 'uint256',
                },
                {
                  internalType: 'uint256',
                  name: 'totalSupply',
                  type: 'uint256',
                },
                {
                  internalType: 'uint256',
                  name: 'price',
                  type: 'uint256',
                },
                {
                  internalType: 'address',
                  name: 'beneficiary',
                  type: 'address',
                },
                {
                  internalType: 'string',
                  name: 'metadata',
                  type: 'string',
                },
                {
                  internalType: 'bytes32',
                  name: 'contentHash',
                  type: 'bytes32',
                },
              ],
              internalType: 'struct ERC721BaseCollectionV2.Item[]',
              name: '_items',
              type: 'tuple[]',
            },
          ],
          name: 'initialize',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [
          options.name || CONTRACT_NAME,
          options.symbol || CONTRACT_SYMBOL,
          options.creator,
          options.shouldComplete,
          options.baseURI || BASE_URI,
          options.items || ITEMS,
        ]
      )

      const { logs } = await factory.createCollection(
        web3.utils.randomHex(32),
        data,
        { gas: 100000000 }
      )

      const ERC721Collection = artifacts.require('ERC721CollectionV2')
      const contract = logs[0].args._address
      const collection = await ERC721Collection.at(contract)
      return collection
    })

    it('reverts when minting by an allowed address', async function () {
      await assertRevert(
        factoryContract.mint(optionId0, holder, fromHacker),
        'Only `allowed` proxy can issue tokens'
      )

      await assertRevert(
        factoryContract.mint(optionId0, holder, fromFactoryOwner),
        'Only `allowed` proxy can issue tokens'
      )
    })

    it('reverts when minting an invalid option', async function () {
      const optionsCount = await factoryContract.numOptions()
      await assertRevert(
        factoryContract.mint(optionsCount, holder, fromFactoryOwnerProxy),
        'Invalid wearable'
      )
    })

    it('reverts when minting an exhausted option', async function () {
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

    it('reverts when querying if an option can be minted', async function () {
      await assertRevert(factoryContract.canMint(optionId0 - 1))
    })
  })

  describe('transferFrom', function () {
    it('should transferFrom', async function () {
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

    it('reverts when transferFrom by an allowed address', async function () {
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

    it('reverts when transferFrom an invalid option', async function () {
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

    it('reverts when transferFrom an exhausted option', async function () {
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

  describe('Owner', function () {
    it('should set Base URI', async function () {
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

    it('reverts when trying to change values by hacker', async function () {
      await assertRevert(
        factoryContract.setBaseURI('', fromHacker),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('approval', function () {
    it('should return valid isApprovedForAll', async function () {
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

  describe('balanceOf', function () {
    it('should return balance of options', async function () {
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

    it('reverts for an invalid option', async function () {
      await assertRevert(factoryContract.balanceOf(optionId0 - 1))
    })
  })

  describe('proxies', function () {
    it('should return proxy count', async function () {
      const proxy = await factoryContract.proxies(factoryOwner)
      expect(proxy).to.be.equal(factoryOwnerProxy)
    })
  })

  describe('numOptions', function () {
    it('should return options count', async function () {
      const optionsCount = await factoryContract.numOptions()
      expect(optionsCount).to.be.eq.BN(WEARABLES.length)
    })
  })

  describe('supportsFactoryInterface', function () {
    it('should return support factory interface', async function () {
      const supported = await factoryContract.supportsFactoryInterface()
      expect(supported).to.be.equal(true)
    })
  })

  describe('ownerOf', function () {
    it('should return owner of options', async function () {
      const wearablesCount = await erc721Contract.wearablesCount()
      for (let i = 0; i < wearablesCount.toNumber(); i++) {
        const owner = await factoryContract.ownerOf(i)
        expect(owner).to.be.equal(factoryOwner)
      }
    })

    it('should return the owner event if the option is invalid', async function () {
      const owner = await factoryContract.ownerOf(-1)
      expect(owner).to.be.equal(factoryOwner)
    })
  })
})
