import assertRevert from '../helpers/assertRevert'
import { ZERO_ADDRESS } from '../helpers/collectionV2'
import { expect } from 'chai'

const SimpleForwarder = artifacts.require('SimpleForwarder')
const Committee = artifacts.require('Committee')

describe('SimpleForwarder', function () {
  let simpleForwarderContract
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

    committeeContract = await Committee.new(owner, [user], fromDeployer)

    simpleForwarderContract = await SimpleForwarder.new(owner, fromDeployer)

    await committeeContract.transferOwnership(
      simpleForwarderContract.address,
      fromOwner
    )
  })

  describe('create forwarder', async function () {
    it('deploy with correct values', async function () {
      const contract = await SimpleForwarder.new(owner, fromDeployer)

      const forwarderOwner = await contract.owner()

      expect(forwarderOwner).to.be.equal(owner)
    })
  })

  describe('forwardCall', async function () {
    it('should forward a call by owner', async function () {
      let isMember = await committeeContract.members(anotherUser)
      expect(isMember).to.be.equal(false)

      // Set a member
      await simpleForwarderContract.forwardCall(
        committeeContract.address,
        web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'address[]',
                name: '_members',
                type: 'address[]',
              },
              {
                internalType: 'bool[]',
                name: '_values',
                type: 'bool[]',
              },
            ],
            name: 'setMembers',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [[anotherUser], [true]]
        ),
        fromOwner
      )

      isMember = await committeeContract.members(anotherUser)
      expect(isMember).to.be.equal(true)
    })

    it('should forward a call by new owner', async function () {
      let isMember = await committeeContract.members(anotherUser)
      expect(isMember).to.be.equal(false)

      await simpleForwarderContract.transferOwnership(user, fromOwner)

      // Set a member
      await simpleForwarderContract.forwardCall(
        committeeContract.address,
        web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'address[]',
                name: '_members',
                type: 'address[]',
              },
              {
                internalType: 'bool[]',
                name: '_values',
                type: 'bool[]',
              },
            ],
            name: 'setMembers',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [[anotherUser], [true]]
        ),
        fromUser
      )

      isMember = await committeeContract.members(anotherUser)
      expect(isMember).to.be.equal(true)
    })

    it('reverts when trying to forward a call by not the owner', async function () {
      await assertRevert(
        simpleForwarderContract.forwardCall(
          committeeContract.address,
          web3.eth.abi.encodeFunctionCall(
            {
              inputs: [
                {
                  internalType: 'address[]',
                  name: '_members',
                  type: 'address[]',
                },
                {
                  internalType: 'bool[]',
                  name: '_values',
                  type: 'bool[]',
                },
              ],
              name: 'setMembers',
              outputs: [],
              stateMutability: 'nonpayable',
              type: 'function',
            },
            [[anotherUser], [true]]
          ),
          { from: anotherUser }
        ),
        'Ownable: caller is not the owner'
      )

      await assertRevert(
        simpleForwarderContract.forwardCall(
          committeeContract.address,
          web3.eth.abi.encodeFunctionCall(
            {
              inputs: [
                {
                  internalType: 'address[]',
                  name: '_members',
                  type: 'address[]',
                },
                {
                  internalType: 'bool[]',
                  name: '_values',
                  type: 'bool[]',
                },
              ],
              name: 'setMembers',
              outputs: [],
              stateMutability: 'nonpayable',
              type: 'function',
            },
            [[anotherUser], [true]]
          ),
          fromHacker
        ),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('TransferOwnership', async function () {
    it('transfer ownership', async function () {
      let forwarderOwner = await simpleForwarderContract.owner()
      expect(forwarderOwner).to.be.equal(owner)

      await simpleForwarderContract.transferOwnership(user, fromOwner)

      forwarderOwner = await simpleForwarderContract.owner()
      expect(forwarderOwner).to.be.equal(user)
    })

    it('reverts when not the owner trying to transfer ownership', async function () {
      await assertRevert(
        simpleForwarderContract.transferOwnership(user, fromUser),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('renounceOwnership', async function () {
    it('transfer ownership', async function () {
      let forwarderOwner = await simpleForwarderContract.owner()
      expect(forwarderOwner).to.be.equal(owner)

      await simpleForwarderContract.renounceOwnership(fromOwner)

      forwarderOwner = await simpleForwarderContract.owner()
      expect(forwarderOwner).to.be.equal(ZERO_ADDRESS)
    })

    it('reverts when not the owner trying to renounce ownership', async function () {
      await assertRevert(
        simpleForwarderContract.renounceOwnership(fromUser),
        'Ownable: caller is not the owner'
      )
    })
  })
})
