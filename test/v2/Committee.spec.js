import { keccak256 } from '@ethersproject/solidity'
import { randomBytes } from '@ethersproject/random'
import { hexlify } from '@ethersproject/bytes'

import assertRevert from '../helpers/assertRevert'
import { getInitData, ZERO_ADDRESS, ITEMS } from '../helpers/collectionV2'
import { expect } from 'chai'

const ERC721CollectionFactoryV2 = artifacts.require('ERC721CollectionFactoryV2')
const ERC721CollectionV2 = artifacts.require('ERC721CollectionV2')
const Committee = artifacts.require('Committee')

function encodeERC721Initialize(
  name,
  symbol,
  creator,
  shouldComplete,
  baseURI,
  items
) {
  return web3.eth.abi.encodeFunctionCall(
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
              internalType: 'enum ERC721BaseCollectionV2.RARITY',
              name: 'rarity',
              type: 'uint8',
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
    [name, symbol, creator, shouldComplete, baseURI, items]
  )
}

describe.only('Commitee V2', function () {
  let collectionImplementation
  let factoryContract
  let committeeContract

  // Accounts
  let accounts
  let deployer
  let user
  let anotherUser
  let owner
  let hacker
  let fromUser
  let fromHacker
  let fromOwner
  let fromDeployer

  let creationParams

  beforeEach(async function () {
    accounts = await web3.eth.getAccounts()
    deployer = accounts[0]
    user = accounts[1]
    owner = accounts[3]
    hacker = accounts[4]
    anotherUser = accounts[5]

    fromUser = { from: user }
    fromHacker = { from: hacker }

    fromOwner = { from: owner }
    fromDeployer = { from: deployer }

    creationParams = {
      ...fromOwner,
      gas: 9e6,
      gasPrice: 21e9,
    }

    collectionImplementation = await ERC721CollectionV2.new()

    factoryContract = await ERC721CollectionFactoryV2.new(
      collectionImplementation.address,
      owner
    )

    committeeContract = await Committee.new(owner, [user], fromDeployer)
  })

  describe('create committee', async function () {
    it('deploy with correct values', async function () {
      const contract = await Committee.new(owner, [user], fromDeployer)

      const committeeOwner = await contract.owner()
      const isMember = await contract.members(user)

      expect(committeeOwner).to.be.equal(owner)
      expect(isMember).to.be.equal(true)
    })
  })

  describe('setMember', async function () {
    it('should add a member to the committee', async function () {
      let isMember = await committeeContract.members(anotherUser)
      expect(isMember).to.be.equal(false)

      let res = await committeeContract.setMember(anotherUser, true, fromOwner)
      let logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('MemberSet')
      expect(logs[0].args._member).to.be.equal(anotherUser)
      expect(logs[0].args._value).to.be.equal(true)

      isMember = await committeeContract.members(anotherUser)
      expect(isMember).to.be.equal(true)

      res = await committeeContract.setMember(anotherUser, false, fromOwner)
      logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('MemberSet')
      expect(logs[0].args._member).to.be.equal(anotherUser)
      expect(logs[0].args._value).to.be.equal(false)

      isMember = await committeeContract.members(anotherUser)
      expect(isMember).to.be.equal(false)
    })
  })
})
