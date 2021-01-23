import { randomBytes } from '@ethersproject/random'

import assertRevert from '../helpers/assertRevert'
import {
  ITEMS,
  getInitialRarities,
  getRarityNames,
} from '../helpers/collectionV2'
import { sendMetaTx } from '../helpers/metaTx'
import { expect } from 'chai'

const ERC721CollectionFactoryV2 = artifacts.require('ERC721CollectionFactoryV2')
const ERC721CollectionV2 = artifacts.require('ERC721CollectionV2')
const Committee = artifacts.require('Committee')
const CollectionManager = artifacts.require('CollectionManager')
const Forwarder = artifacts.require('Forwarder')
const Rarities = artifacts.require('Rarities')

describe('Commitee', function () {
  let collectionImplementation
  let factoryContract
  let committeeContract
  let collectionManagerContract
  let forwarderContract
  let raritiesContract

  // Accounts
  let accounts
  let deployer
  let user
  let anotherUser
  let owner
  let hacker
  let relayer
  let fromUser
  let fromHacker
  let fromOwner
  let fromDeployer

  beforeEach(async function () {
    accounts = await web3.eth.getAccounts()
    deployer = accounts[0]
    user = accounts[1]
    owner = accounts[3]
    hacker = accounts[4]
    anotherUser = accounts[5]
    relayer = accounts[6]

    fromUser = { from: user }
    fromHacker = { from: hacker }

    fromOwner = { from: owner }
    fromDeployer = { from: deployer }

    committeeContract = await Committee.new(owner, [user], fromDeployer)
    raritiesContract = await Rarities.new(deployer, getInitialRarities())

    collectionManagerContract = await CollectionManager.new(
      owner,
      committeeContract.address,
      committeeContract.address,
      user,
      raritiesContract.address
    )

    collectionImplementation = await ERC721CollectionV2.new()

    forwarderContract = await Forwarder.new(
      owner,
      collectionManagerContract.address,
      fromDeployer
    )

    factoryContract = await ERC721CollectionFactoryV2.new(
      forwarderContract.address,
      collectionImplementation.address
    )
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

      let res = await committeeContract.setMembers(
        [anotherUser],
        [true],
        fromOwner
      )
      let logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('MemberSet')
      expect(logs[0].args._member).to.be.equal(anotherUser)
      expect(logs[0].args._value).to.be.equal(true)

      isMember = await committeeContract.members(anotherUser)
      expect(isMember).to.be.equal(true)

      res = await committeeContract.setMembers(
        [anotherUser],
        [false],
        fromOwner
      )
      logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('MemberSet')
      expect(logs[0].args._member).to.be.equal(anotherUser)
      expect(logs[0].args._value).to.be.equal(false)

      isMember = await committeeContract.members(anotherUser)
      expect(isMember).to.be.equal(false)
    })

    it('should set members to the committee', async function () {
      let isMember = await committeeContract.members(user)
      expect(isMember).to.be.equal(true)

      isMember = await committeeContract.members(anotherUser)
      expect(isMember).to.be.equal(false)

      let res = await committeeContract.setMembers(
        [user, anotherUser],
        [false, true],
        fromOwner
      )
      let logs = res.logs

      expect(logs.length).to.be.equal(2)
      expect(logs[0].event).to.be.equal('MemberSet')
      expect(logs[0].args._member).to.be.equal(user)
      expect(logs[0].args._value).to.be.equal(false)

      expect(logs[1].event).to.be.equal('MemberSet')
      expect(logs[1].args._member).to.be.equal(anotherUser)
      expect(logs[1].args._value).to.be.equal(true)

      isMember = await committeeContract.members(user)
      expect(isMember).to.be.equal(false)

      isMember = await committeeContract.members(anotherUser)
      expect(isMember).to.be.equal(true)
    })

    it("reverts when trying to set members with different parameter's length", async function () {
      await assertRevert(
        committeeContract.setMembers([user, anotherUser], [false], fromOwner),
        'Committee#setMembers: LENGTH_MISMATCH'
      )

      await assertRevert(
        committeeContract.setMembers([user], [false, true], fromOwner),
        'Committee#setMembers: LENGTH_MISMATCH'
      )
    })

    it('reverts when trying to set members by hacker', async function () {
      await assertRevert(
        committeeContract.setMembers(
          [user, anotherUser],
          [false, true],
          fromHacker
        ),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('manageCollection', async function () {
    const name = 'collectionName'
    const symbol = 'collectionSymbol'
    const baseURI = 'collectionBaseURI'

    let collectionContract

    beforeEach(async () => {
      const rarities = getInitialRarities()

      await raritiesContract.updatePrices(
        getRarityNames(),
        Array(rarities.length).fill(0)
      )

      const salt = randomBytes(32)
      const { logs } = await collectionManagerContract.createCollection(
        forwarderContract.address,
        factoryContract.address,
        salt,
        name,
        symbol,
        baseURI,
        user,
        ITEMS,
        fromOwner
      )
      collectionContract = await ERC721CollectionV2.at(logs[0].address)
    })

    it('should manage a collection', async function () {
      let isApproved = await collectionContract.isApproved()
      expect(isApproved).to.be.equal(false)

      // Approve collection
      await committeeContract.manageCollection(
        collectionManagerContract.address,
        forwarderContract.address,
        collectionContract.address,
        web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'bool',
                name: '_value',
                type: 'bool',
              },
            ],
            name: 'setApproved',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [true]
        ),
        fromUser
      )

      isApproved = await collectionContract.isApproved()
      expect(isApproved).to.be.equal(true)

      // Approve collection
      await committeeContract.manageCollection(
        collectionManagerContract.address,
        forwarderContract.address,
        collectionContract.address,
        web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'bool',
                name: '_value',
                type: 'bool',
              },
            ],
            name: 'setApproved',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [false]
        ),
        fromUser
      )

      isApproved = await collectionContract.isApproved()
      expect(isApproved).to.be.equal(false)
    })

    it('should manage a collection :: Relayed EIP721', async function () {
      let isApproved = await collectionContract.isApproved()
      expect(isApproved).to.be.equal(false)

      // Approve collection
      let functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'contract ICollectionManager',
              name: '_collectionManager',
              type: 'address',
            },
            {
              internalType: 'address',
              name: '_forwarder',
              type: 'address',
            },
            {
              internalType: 'address',
              name: '_collection',
              type: 'address',
            },
            {
              internalType: 'bytes',
              name: '_data',
              type: 'bytes',
            },
          ],
          name: 'manageCollection',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [
          collectionManagerContract.address,
          forwarderContract.address,
          collectionContract.address,
          web3.eth.abi.encodeFunctionCall(
            {
              inputs: [
                {
                  internalType: 'bool',
                  name: '_value',
                  type: 'bool',
                },
              ],
              name: 'setApproved',
              outputs: [],
              stateMutability: 'nonpayable',
              type: 'function',
            },
            [true]
          ),
        ]
      )

      await sendMetaTx(
        committeeContract,
        functionSignature,
        user,
        relayer,
        null,
        'Decentraland Collection Committee',
        '1'
      )

      isApproved = await collectionContract.isApproved()
      expect(isApproved).to.be.equal(true)

      // Reject collection
      functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'contract ICollectionManager',
              name: '_collectionManager',
              type: 'address',
            },
            {
              internalType: 'address',
              name: '_forwarder',
              type: 'address',
            },
            {
              internalType: 'address',
              name: '_collection',
              type: 'address',
            },
            {
              internalType: 'bytes',
              name: '_data',
              type: 'bytes',
            },
          ],
          name: 'manageCollection',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [
          collectionManagerContract.address,
          forwarderContract.address,
          collectionContract.address,
          web3.eth.abi.encodeFunctionCall(
            {
              inputs: [
                {
                  internalType: 'bool',
                  name: '_value',
                  type: 'bool',
                },
              ],
              name: 'setApproved',
              outputs: [],
              stateMutability: 'nonpayable',
              type: 'function',
            },
            [false]
          ),
        ]
      )

      await sendMetaTx(
        committeeContract,
        functionSignature,
        user,
        relayer,
        null,
        'Decentraland Collection Committee',
        '1'
      )

      isApproved = await collectionContract.isApproved()
      expect(isApproved).to.be.equal(false)
    })

    it('reverts when trying to manage a collection by a committee removed member', async function () {
      let isApproved = await collectionContract.isApproved()
      expect(isApproved).to.be.equal(false)

      await committeeContract.manageCollection(
        collectionManagerContract.address,
        forwarderContract.address,
        collectionContract.address,
        web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'bool',
                name: '_value',
                type: 'bool',
              },
            ],
            name: 'setApproved',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [true]
        ),
        fromUser
      )

      isApproved = await collectionContract.isApproved()
      expect(isApproved).to.be.equal(true)

      await committeeContract.setMembers([user], [false], fromOwner)

      await assertRevert(
        committeeContract.manageCollection(
          collectionManagerContract.address,
          forwarderContract.address,
          collectionContract.address,
          web3.eth.abi.encodeFunctionCall(
            {
              inputs: [
                {
                  internalType: 'bool',
                  name: '_value',
                  type: 'bool',
                },
              ],
              name: 'setApproved',
              outputs: [],
              stateMutability: 'nonpayable',
              type: 'function',
            },
            [false]
          ),
          fromUser
        ),
        'Committee#manageCollection: UNAUTHORIZED_SENDER'
      )

      await committeeContract.setMembers([user], [true], fromOwner)

      await committeeContract.manageCollection(
        collectionManagerContract.address,
        forwarderContract.address,
        collectionContract.address,
        web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'bool',
                name: '_value',
                type: 'bool',
              },
            ],
            name: 'setApproved',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [false]
        ),
        fromUser
      )
    })

    it('reverts when trying to manage a collection by not a committee member', async function () {
      let isApproved = await collectionContract.isApproved()
      expect(isApproved).to.be.equal(false)

      await assertRevert(
        committeeContract.manageCollection(
          collectionManagerContract.address,
          forwarderContract.address,
          collectionContract.address,
          web3.eth.abi.encodeFunctionCall(
            {
              inputs: [
                {
                  internalType: 'bool',
                  name: '_value',
                  type: 'bool',
                },
              ],
              name: 'setApproved',
              outputs: [],
              stateMutability: 'nonpayable',
              type: 'function',
            },
            [true]
          ),
          fromHacker
        ),
        'Committee#manageCollection: UNAUTHORIZED_SENDER'
      )

      // Approve collection
      await assertRevert(
        committeeContract.manageCollection(
          collectionManagerContract.address,
          forwarderContract.address,
          collectionContract.address,
          web3.eth.abi.encodeFunctionCall(
            {
              inputs: [
                {
                  internalType: 'bool',
                  name: '_value',
                  type: 'bool',
                },
              ],
              name: 'setApproved',
              outputs: [],
              stateMutability: 'nonpayable',
              type: 'function',
            },
            [true]
          ),
          fromOwner
        ),
        'Committee#manageCollection: UNAUTHORIZED_SENDER'
      )
    })
  })
})
