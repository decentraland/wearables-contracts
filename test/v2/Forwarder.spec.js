import assertRevert from '../helpers/assertRevert'
import { ZERO_ADDRESS } from '../helpers/collectionV2'
import { expect } from 'chai'

const Forwarder = artifacts.require('Forwarder')
const Committee = artifacts.require('Committee')

describe('Forwarder', function () {
  let forwarderContract
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

    forwarderContract = await Forwarder.new(owner, user, fromDeployer)

    await committeeContract.transferOwnership(
      forwarderContract.address,
      fromOwner
    )
  })

  describe('create forwarder', async function () {
    it('deploy with correct values', async function () {
      const contract = await Forwarder.new(owner, user, fromDeployer)

      const forwarderOwner = await contract.owner()
      const caller = await contract.caller()

      expect(forwarderOwner).to.be.equal(owner)
      expect(caller).to.be.equal(user)
    })
  })

  describe('setCaller', async function () {
    it('should set the caller', async function () {
      let caller = await forwarderContract.caller()
      expect(caller).to.be.equal(user)

      let res = await forwarderContract.setCaller(
        committeeContract.address,
        fromOwner
      )
      let logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('CallerSet')
      expect(logs[0].args._oldCaller).to.be.equal(user)
      expect(logs[0].args._newCaller).to.be.equal(committeeContract.address)

      caller = await forwarderContract.caller()
      expect(caller).to.be.equal(committeeContract.address)

      res = await forwarderContract.setCaller(user, fromOwner)
      logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('CallerSet')
      expect(logs[0].args._oldCaller).to.be.equal(committeeContract.address)
      expect(logs[0].args._newCaller).to.be.equal(user)

      caller = await forwarderContract.caller()
      expect(caller).to.be.equal(user)
    })

    it('should set the ZERO_ADDRESS as the caller', async function () {
      let caller = await forwarderContract.caller()
      expect(caller).to.be.equal(user)

      let res = await forwarderContract.setCaller(ZERO_ADDRESS, fromOwner)
      let logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('CallerSet')
      expect(logs[0].args._oldCaller).to.be.equal(user)
      expect(logs[0].args._newCaller).to.be.equal(ZERO_ADDRESS)

      caller = await forwarderContract.caller()
      expect(caller).to.be.equal(ZERO_ADDRESS)

      res = await forwarderContract.setCaller(user, fromOwner)
      logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('CallerSet')
      expect(logs[0].args._oldCaller).to.be.equal(ZERO_ADDRESS)
      expect(logs[0].args._newCaller).to.be.equal(user)

      caller = await forwarderContract.caller()
      expect(caller).to.be.equal(user)
    })

    it('reverts when trying to set the caller by hacker', async function () {
      await assertRevert(
        forwarderContract.setCaller(user, fromHacker),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('forwardCall', async function () {
    it('should forward a call by caller', async function () {
      let isMember = await committeeContract.members(anotherUser)
      expect(isMember).to.be.equal(false)

      // Set a member
      await forwarderContract.forwardCall(
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

    it('should forward a call by owner', async function () {
      let isMember = await committeeContract.members(anotherUser)
      expect(isMember).to.be.equal(false)

      // Set a member
      await forwarderContract.forwardCall(
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

    it('reverts when trying to forward a call by not the caller nor owner', async function () {
      await assertRevert(
        forwarderContract.forwardCall(
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
        'Owner#forwardCall: UNAUTHORIZED_SENDER'
      )

      await assertRevert(
        forwarderContract.forwardCall(
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
        'Owner#forwardCall: UNAUTHORIZED_SENDER'
      )
    })
  })
})
