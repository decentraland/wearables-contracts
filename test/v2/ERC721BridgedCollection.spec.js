import hr from 'hardhat'
import { expect } from 'chai'

import assertRevert from '../helpers/assertRevert'
import { getTokenId } from '../helpers/bridgedCollection'
import { ZERO_ADDRESS, BASE_URI, EMPTY_HASH } from '../helpers/collectionV2'
import { sendMetaTx } from '../helpers/metaTx'

const ERC721BridgedCollection = artifacts.require('ERC721BridgedCollection')

describe('ERC721BridgedCollection', function () {
  let collectionsBridgedContract
  let tokenId1
  let tokenId2
  let tokenId3
  let tokenURI1
  let tokenURI2
  let tokenURI3

  // Accounts
  let accounts
  let user
  let anotherUser
  let operator
  let owner
  let hacker
  let relayer
  let admin
  let fakeCollection
  let fromUser
  let fromAnotherUser
  let fromHacker
  let fromOwner
  let fromAdmin

  let creationParams

  beforeEach(async function () {
    accounts = await web3.eth.getAccounts()
    user = accounts[1]
    fakeCollection = accounts[2]
    owner = accounts[3]
    hacker = accounts[4]
    anotherUser = accounts[5]
    operator = accounts[6]
    relayer = accounts[7]
    admin = accounts[8]

    fromUser = { from: user }
    fromAnotherUser = { from: anotherUser }
    fromHacker = { from: hacker }
    fromAdmin = { from: admin }

    fromOwner = { from: owner }

    creationParams = {
      ...fromOwner,
      gas: 9e6,
      gasPrice: 21e9,
    }

    collectionsBridgedContract = await ERC721BridgedCollection.new(
      owner,
      admin,
      'Collection Bridged',
      'CB'
    )

    tokenId1 = getTokenId(fakeCollection, 1)
    tokenId2 = getTokenId(fakeCollection, 2)
    tokenId3 = getTokenId(fakeCollection, 3)
    tokenURI1 = BASE_URI + '1'
    tokenURI2 = BASE_URI + '2'
    tokenURI3 = BASE_URI + '3'
  })

  describe('create bridged collection', async function () {
    it('deploy with correct values', async function () {
      const name = 'Collection Bridged'
      const symbol = 'CB'
      const contract = await ERC721BridgedCollection.new(
        owner,
        admin,
        name,
        symbol
      )

      const contractName = await contract.name()
      const contractSymbol = await contract.symbol()
      const bridgedCollectionOwner = await contract.owner()
      const contractAdmin = await contract.admin()
      const totalSupply = await contract.totalSupply()

      expect(contractName).to.be.equal(name)
      expect(contractSymbol).to.be.equal(symbol)
      expect(bridgedCollectionOwner).to.be.equal(owner)
      expect(contractAdmin).to.be.equal(admin)
      expect(totalSupply).to.be.eq.BN(0)
    })
  })

  describe('mint', async function () {
    it('should mint tokens', async function () {
      let userBalance = await collectionsBridgedContract.balanceOf(user)
      expect(userBalance).to.be.eq.BN(web3.utils.toBN(0))

      let totalSupply = await collectionsBridgedContract.totalSupply()
      expect(totalSupply).to.be.eq.BN(web3.utils.toBN(0))

      const { logs } = await collectionsBridgedContract.mint(
        user,
        [
          [fakeCollection, 1, tokenURI1],
          [fakeCollection, 2, tokenURI2],
        ],
        fromAdmin
      )

      expect(logs.length).to.be.equal(2)
      expect(logs[0].event).to.be.equal('Transfer')
      expect(logs[0].args.from).to.be.equal(ZERO_ADDRESS)
      expect(logs[0].args.to).to.be.equal(user)
      expect(logs[0].args.tokenId).to.eq.BN(tokenId1)

      expect(logs[1].event).to.be.equal('Transfer')
      expect(logs[1].args.from).to.be.equal(ZERO_ADDRESS)
      expect(logs[1].args.to).to.be.equal(user)
      expect(logs[1].args.tokenId).to.eq.BN(tokenId2)

      userBalance = await collectionsBridgedContract.balanceOf(user)
      expect(userBalance).to.be.eq.BN(web3.utils.toBN(2))

      totalSupply = await collectionsBridgedContract.totalSupply()
      expect(totalSupply).to.be.eq.BN(web3.utils.toBN(2))

      const ownerOfToken1 = await collectionsBridgedContract.ownerOf(tokenId1)
      const ownerOfToken2 = await collectionsBridgedContract.ownerOf(tokenId2)
      expect(ownerOfToken1).to.be.equal(user)
      expect(ownerOfToken2).to.be.equal(user)

      const token1 = await collectionsBridgedContract.tokens(tokenId1)
      expect(token1.collection).to.be.equal(fakeCollection)
      expect(token1.tokenId).to.be.eq.BN(web3.utils.toBN(1))
      expect(token1.tokenURI).to.be.eq.BN(tokenURI1)

      const token2 = await collectionsBridgedContract.tokens(tokenId2)
      expect(token2.collection).to.be.equal(fakeCollection)
      expect(token2.tokenId).to.be.eq.BN(web3.utils.toBN(2))
      expect(token2.tokenURI).to.be.eq.BN(tokenURI2)
    })

    it('should mint tokens :: Relayed EIP721', async function () {
      let userBalance = await collectionsBridgedContract.balanceOf(user)
      expect(userBalance).to.be.eq.BN(web3.utils.toBN(0))

      let totalSupply = await collectionsBridgedContract.totalSupply()
      expect(totalSupply).to.be.eq.BN(web3.utils.toBN(0))

      const functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'address',
              name: '_beneficiary',
              type: 'address',
            },
            {
              components: [
                {
                  internalType: 'address',
                  name: 'collection',
                  type: 'address',
                },
                {
                  internalType: 'uint256',
                  name: 'tokenId',
                  type: 'uint256',
                },
                {
                  internalType: 'string',
                  name: 'tokenURI',
                  type: 'string',
                },
              ],
              internalType: 'struct ERC721BridgedCollection.Token[]',
              name: '_tokens',
              type: 'tuple[]',
            },
          ],
          name: 'mint',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [
          user,
          [
            [fakeCollection, 1, tokenURI1],
            [fakeCollection, 2, tokenURI2],
          ],
        ]
      )

      const { logs } = await sendMetaTx(
        collectionsBridgedContract,
        functionSignature,
        admin,
        relayer,
        null,
        'Decentraland Bridged Collection',
        '1'
      )

      expect(logs.length).to.be.equal(3)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(admin)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      expect(logs[1].event).to.be.equal('Transfer')
      expect(logs[1].args.from).to.be.equal(ZERO_ADDRESS)
      expect(logs[1].args.to).to.be.equal(user)
      expect(logs[1].args.tokenId).to.eq.BN(tokenId1)

      expect(logs[2].event).to.be.equal('Transfer')
      expect(logs[2].args.from).to.be.equal(ZERO_ADDRESS)
      expect(logs[2].args.to).to.be.equal(user)
      expect(logs[2].args.tokenId).to.eq.BN(tokenId2)

      userBalance = await collectionsBridgedContract.balanceOf(user)
      expect(userBalance).to.be.eq.BN(web3.utils.toBN(2))

      totalSupply = await collectionsBridgedContract.totalSupply()
      expect(totalSupply).to.be.eq.BN(web3.utils.toBN(2))

      const ownerOfToken1 = await collectionsBridgedContract.ownerOf(tokenId1)
      const ownerOfToken2 = await collectionsBridgedContract.ownerOf(tokenId2)
      expect(ownerOfToken1).to.be.equal(user)
      expect(ownerOfToken2).to.be.equal(user)

      const token1 = await collectionsBridgedContract.tokens(tokenId1)
      expect(token1.collection).to.be.equal(fakeCollection)
      expect(token1.tokenId).to.be.eq.BN(web3.utils.toBN(1))
      expect(token1.tokenURI).to.be.eq.BN(tokenURI1)

      const token2 = await collectionsBridgedContract.tokens(tokenId2)
      expect(token2.collection).to.be.equal(fakeCollection)
      expect(token2.tokenId).to.be.eq.BN(web3.utils.toBN(2))
      expect(token2.tokenURI).to.be.eq.BN(tokenURI2)
    })

    it('reverts when trying to mint tokens by an unauthorized user', async function () {
      await assertRevert(
        collectionsBridgedContract.mint(
          user,
          [
            [fakeCollection, 1, tokenURI1],
            [fakeCollection, 2, tokenURI2],
          ],
          fromHacker
        ),
        'EBC#onlyadmin: CALLER_IS_NOT_ADMIN'
      )
    })

    it('reverts when trying to mint already minted tokens', async function () {
      await collectionsBridgedContract.mint(
        user,
        [
          [fakeCollection, 1, tokenURI1],
          [fakeCollection, 2, tokenURI2],
        ],
        fromAdmin
      )

      await assertRevert(
        collectionsBridgedContract.mint(
          user,
          [
            [fakeCollection, 1, tokenURI1],
            [fakeCollection, 2, tokenURI2],
          ],
          fromAdmin
        ),
        'ERC721: token already minted'
      )
    })
  })

  describe('burn', async function () {
    beforeEach(async function () {
      await collectionsBridgedContract.mint(
        user,
        [
          [fakeCollection, 1, tokenURI1],
          [fakeCollection, 2, tokenURI2],
        ],
        fromAdmin
      )
    })

    it('should burn tokens', async function () {
      let userBalance = await collectionsBridgedContract.balanceOf(user)
      expect(userBalance).to.be.eq.BN(web3.utils.toBN(2))

      let totalSupply = await collectionsBridgedContract.totalSupply()
      expect(totalSupply).to.be.eq.BN(web3.utils.toBN(2))

      let ownerOfToken1 = await collectionsBridgedContract.ownerOf(tokenId1)
      let ownerOfToken2 = await collectionsBridgedContract.ownerOf(tokenId2)
      expect(ownerOfToken1).to.be.equal(user)
      expect(ownerOfToken2).to.be.equal(user)

      const { logs } = await collectionsBridgedContract.burn(
        [tokenId1, tokenId2],
        fromAdmin
      )

      expect(logs.length).to.be.equal(4)

      expect(logs[0].event).to.be.equal('Approval')
      expect(logs[0].args.owner).to.be.equal(user)
      expect(logs[0].args.approved).to.be.equal(ZERO_ADDRESS)
      expect(logs[0].args.tokenId).to.eq.BN(tokenId1)

      expect(logs[1].event).to.be.equal('Transfer')
      expect(logs[1].args.from).to.be.equal(user)
      expect(logs[1].args.to).to.be.equal(ZERO_ADDRESS)
      expect(logs[1].args.tokenId).to.eq.BN(tokenId1)

      expect(logs[2].event).to.be.equal('Approval')
      expect(logs[2].args.owner).to.be.equal(user)
      expect(logs[2].args.approved).to.be.equal(ZERO_ADDRESS)
      expect(logs[2].args.tokenId).to.eq.BN(tokenId2)

      expect(logs[3].event).to.be.equal('Transfer')
      expect(logs[3].args.from).to.be.equal(user)
      expect(logs[3].args.to).to.be.equal(ZERO_ADDRESS)
      expect(logs[3].args.tokenId).to.eq.BN(tokenId2)

      userBalance = await collectionsBridgedContract.balanceOf(user)
      expect(userBalance).to.be.eq.BN(web3.utils.toBN(0))

      totalSupply = await collectionsBridgedContract.totalSupply()
      expect(totalSupply).to.be.eq.BN(web3.utils.toBN(0))
    })

    it('should burn tokens :: Relayed EIP721', async function () {
      let userBalance = await collectionsBridgedContract.balanceOf(user)
      expect(userBalance).to.be.eq.BN(web3.utils.toBN(2))

      let totalSupply = await collectionsBridgedContract.totalSupply()
      expect(totalSupply).to.be.eq.BN(web3.utils.toBN(2))

      let ownerOfToken1 = await collectionsBridgedContract.ownerOf(tokenId1)
      let ownerOfToken2 = await collectionsBridgedContract.ownerOf(tokenId2)
      expect(ownerOfToken1).to.be.equal(user)
      expect(ownerOfToken2).to.be.equal(user)

      const functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'uint256[]',
              name: '_tokenIds',
              type: 'uint256[]',
            },
          ],
          name: 'burn',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [[tokenId1, tokenId2]]
      )

      const { logs } = await sendMetaTx(
        collectionsBridgedContract,
        functionSignature,
        admin,
        relayer,
        null,
        'Decentraland Bridged Collection',
        '1'
      )

      expect(logs.length).to.be.equal(5)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(admin)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      expect(logs[1].event).to.be.equal('Approval')
      expect(logs[1].args.owner).to.be.equal(user)
      expect(logs[1].args.approved).to.be.equal(ZERO_ADDRESS)
      expect(logs[1].args.tokenId).to.eq.BN(tokenId1)

      expect(logs[2].event).to.be.equal('Transfer')
      expect(logs[2].args.from).to.be.equal(user)
      expect(logs[2].args.to).to.be.equal(ZERO_ADDRESS)
      expect(logs[2].args.tokenId).to.eq.BN(tokenId1)

      expect(logs[3].event).to.be.equal('Approval')
      expect(logs[3].args.owner).to.be.equal(user)
      expect(logs[3].args.approved).to.be.equal(ZERO_ADDRESS)
      expect(logs[3].args.tokenId).to.eq.BN(tokenId2)

      expect(logs[4].event).to.be.equal('Transfer')
      expect(logs[4].args.from).to.be.equal(user)
      expect(logs[4].args.to).to.be.equal(ZERO_ADDRESS)
      expect(logs[4].args.tokenId).to.eq.BN(tokenId2)

      userBalance = await collectionsBridgedContract.balanceOf(user)
      expect(userBalance).to.be.eq.BN(web3.utils.toBN(0))

      totalSupply = await collectionsBridgedContract.totalSupply()
      expect(totalSupply).to.be.eq.BN(web3.utils.toBN(0))
    })

    it('reverts when tryint to burn tokens by an unauthorized address', async function () {
      await assertRevert(
        collectionsBridgedContract.burn([tokenId1, tokenId2], fromHacker),
        'EBC#onlyadmin: CALLER_IS_NOT_ADMIN'
      )

      await assertRevert(
        collectionsBridgedContract.burn([tokenId1, tokenId2], fromUser),
        'EBC#onlyadmin: CALLER_IS_NOT_ADMIN'
      )
    })

    it('reverts when tryint to burn tokens already burnt tokens', async function () {
      await collectionsBridgedContract.burn([tokenId1, tokenId2], fromAdmin)
      await assertRevert(
        collectionsBridgedContract.burn([tokenId1, tokenId2], fromAdmin),
        'ERC721: owner query for nonexistent token'
      )
    })
  })

  describe('setAdmin', function () {
    it('should set the admin', async function () {
      let totalSupply = await collectionsBridgedContract.totalSupply()
      expect(totalSupply).to.be.eq.BN(web3.utils.toBN(0))

      let currentAdmin = await collectionsBridgedContract.admin()
      expect(currentAdmin).to.be.equal(admin)

      const { logs } = await collectionsBridgedContract.setAdmin(
        user,
        fromOwner
      )

      expect(logs.length).to.be.equal(1)

      expect(logs[0].event).to.be.equal('AdminSet')
      expect(logs[0].args._oldValue).to.be.equal(admin)
      expect(logs[0].args._newValue).to.be.equal(user)

      currentAdmin = await collectionsBridgedContract.admin()
      expect(currentAdmin).to.be.equal(user)

      await assertRevert(
        collectionsBridgedContract.mint(
          user,
          [
            [fakeCollection, 1, tokenURI1],
            [fakeCollection, 2, tokenURI2],
          ],
          fromAdmin
        ),
        'EBC#onlyadmin: CALLER_IS_NOT_ADMIN'
      )

      await collectionsBridgedContract.mint(
        user,
        [
          [fakeCollection, 1, tokenURI1],
          [fakeCollection, 2, tokenURI2],
        ],
        fromUser
      )

      totalSupply = await collectionsBridgedContract.totalSupply()
      expect(totalSupply).to.be.eq.BN(web3.utils.toBN(2))
    })

    it('should set the admin :: Relayed EIP721', async function () {
      let totalSupply = await collectionsBridgedContract.totalSupply()
      expect(totalSupply).to.be.eq.BN(web3.utils.toBN(0))

      let currentAdmin = await collectionsBridgedContract.admin()
      expect(currentAdmin).to.be.equal(admin)

      const functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'address',
              name: '_newAdmin',
              type: 'address',
            },
          ],
          name: 'setAdmin',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [user]
      )

      const { logs } = await sendMetaTx(
        collectionsBridgedContract,
        functionSignature,
        owner,
        relayer,
        null,
        'Decentraland Bridged Collection',
        '1'
      )

      expect(logs.length).to.be.equal(2)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(owner)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      expect(logs[1].event).to.be.equal('AdminSet')
      expect(logs[1].args._oldValue).to.be.equal(admin)
      expect(logs[1].args._newValue).to.be.equal(user)

      currentAdmin = await collectionsBridgedContract.admin()
      expect(currentAdmin).to.be.equal(user)

      await assertRevert(
        collectionsBridgedContract.mint(
          user,
          [
            [fakeCollection, 1, tokenURI1],
            [fakeCollection, 2, tokenURI2],
          ],
          fromAdmin
        ),
        'EBC#onlyadmin: CALLER_IS_NOT_ADMIN'
      )

      await collectionsBridgedContract.mint(
        user,
        [
          [fakeCollection, 1, tokenURI1],
          [fakeCollection, 2, tokenURI2],
        ],
        fromUser
      )

      totalSupply = await collectionsBridgedContract.totalSupply()
      expect(totalSupply).to.be.eq.BN(web3.utils.toBN(2))
    })

    it('reverts when trying to set the admin by an unauthorized user', async function () {
      await assertRevert(
        collectionsBridgedContract.setAdmin(user, fromAdmin),
        'Ownable: caller is not the owner'
      )

      await assertRevert(
        collectionsBridgedContract.setAdmin(user, fromHacker),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('transferBatch', function () {
    beforeEach(async function () {
      await collectionsBridgedContract.mint(
        user,
        [
          [fakeCollection, 1, tokenURI1],
          [fakeCollection, 2, tokenURI2],
          [fakeCollection, 3, tokenURI3],
        ],
        fromAdmin
      )
    })
    it('should transfer in batch', async function () {
      let ownerToken1 = await collectionsBridgedContract.ownerOf(tokenId1)
      let ownerToken2 = await collectionsBridgedContract.ownerOf(tokenId2)
      expect(ownerToken1).to.be.equal(user)
      expect(ownerToken2).to.be.equal(user)

      const { logs } = await collectionsBridgedContract.batchTransferFrom(
        user,
        anotherUser,
        [tokenId1, tokenId2],
        fromUser
      )

      // 0.6 Zep contracts emits an approval before each Transfer event for cleaning allowances
      expect(logs.length).to.be.equal(4)
      expect(logs[1].event).to.be.equal('Transfer')
      expect(logs[1].args.from).to.be.equal(user)
      expect(logs[1].args.to).to.be.equal(anotherUser)
      expect(logs[1].args.tokenId).to.eq.BN(tokenId1)

      expect(logs[3].event).to.be.equal('Transfer')
      expect(logs[3].args.from).to.be.equal(user)
      expect(logs[3].args.to).to.be.equal(anotherUser)
      expect(logs[3].args.tokenId).to.eq.BN(tokenId2)

      ownerToken1 = await collectionsBridgedContract.ownerOf(tokenId1)
      ownerToken2 = await collectionsBridgedContract.ownerOf(tokenId2)
      expect(ownerToken1).to.be.equal(anotherUser)
      expect(ownerToken2).to.be.equal(anotherUser)
    })

    it('should transfer in batch :: Relayed EIP721', async function () {
      let ownerToken1 = await collectionsBridgedContract.ownerOf(tokenId1)
      let ownerToken2 = await collectionsBridgedContract.ownerOf(tokenId2)
      expect(ownerToken1).to.be.equal(user)
      expect(ownerToken2).to.be.equal(user)

      const functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'address',
              name: '_from',
              type: 'address',
            },
            {
              internalType: 'address',
              name: '_to',
              type: 'address',
            },
            {
              internalType: 'uint256[]',
              name: '_tokenIds',
              type: 'uint256[]',
            },
            {
              internalType: 'bytes',
              name: '_data',
              type: 'bytes',
            },
          ],
          name: 'safeBatchTransferFrom',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [
          user,
          anotherUser,
          [tokenId1.toString(), tokenId2.toString()],
          EMPTY_HASH,
        ]
      )

      const { logs } = await sendMetaTx(
        collectionsBridgedContract,
        functionSignature,
        user,
        relayer,
        null,
        'Decentraland Bridged Collection',
        '1'
      )

      // 0.6 Zep contracts emits an approval before each Transfer event for cleaning allowances
      expect(logs.length).to.be.equal(5)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(user)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      expect(logs[2].event).to.be.equal('Transfer')
      expect(logs[2].args.from).to.be.equal(user)
      expect(logs[2].args.to).to.be.equal(anotherUser)
      expect(logs[2].args.tokenId).to.eq.BN(tokenId1)

      expect(logs[4].event).to.be.equal('Transfer')
      expect(logs[4].args.from).to.be.equal(user)
      expect(logs[4].args.to).to.be.equal(anotherUser)
      expect(logs[4].args.tokenId).to.eq.BN(tokenId2)

      ownerToken1 = await collectionsBridgedContract.ownerOf(tokenId1)
      ownerToken2 = await collectionsBridgedContract.ownerOf(tokenId2)
      expect(ownerToken1).to.be.equal(anotherUser)
      expect(ownerToken2).to.be.equal(anotherUser)
    })

    it('should safe transfer in batch', async function () {
      let ownerToken1 = await collectionsBridgedContract.ownerOf(tokenId1)
      let ownerToken2 = await collectionsBridgedContract.ownerOf(tokenId2)
      expect(ownerToken1).to.be.equal(user)
      expect(ownerToken2).to.be.equal(user)

      const { logs } = await collectionsBridgedContract.safeBatchTransferFrom(
        user,
        anotherUser,
        [tokenId1, tokenId2],
        EMPTY_HASH,
        fromUser
      )

      // 0.6 Zep contracts emits an approval before each Transfer event for cleaning allowances
      expect(logs.length).to.be.equal(4)
      expect(logs[1].event).to.be.equal('Transfer')
      expect(logs[1].args.from).to.be.equal(user)
      expect(logs[1].args.to).to.be.equal(anotherUser)
      expect(logs[1].args.tokenId).to.eq.BN(tokenId1)

      expect(logs[3].event).to.be.equal('Transfer')
      expect(logs[3].args.from).to.be.equal(user)
      expect(logs[3].args.to).to.be.equal(anotherUser)
      expect(logs[3].args.tokenId).to.eq.BN(tokenId2)

      ownerToken1 = await collectionsBridgedContract.ownerOf(tokenId1)
      ownerToken2 = await collectionsBridgedContract.ownerOf(tokenId2)
      expect(ownerToken1).to.be.equal(anotherUser)
      expect(ownerToken2).to.be.equal(anotherUser)
    })

    it('should safe transfer in batch by operator', async function () {
      let ownerToken1 = await collectionsBridgedContract.ownerOf(tokenId1)
      let ownerToken2 = await collectionsBridgedContract.ownerOf(tokenId2)
      expect(ownerToken1).to.be.equal(user)
      expect(ownerToken2).to.be.equal(user)

      await collectionsBridgedContract.approve(hacker, tokenId1, fromUser)
      await collectionsBridgedContract.approve(hacker, tokenId2, fromUser)

      const { logs } = await collectionsBridgedContract.safeBatchTransferFrom(
        user,
        anotherUser,
        [tokenId1, tokenId2],
        EMPTY_HASH,
        fromHacker
      )

      // 0.6 Zep contracts emits an approval before each Transfer event for cleaning allowances
      expect(logs.length).to.be.equal(4)
      expect(logs[1].event).to.be.equal('Transfer')
      expect(logs[1].args.from).to.be.equal(user)
      expect(logs[1].args.to).to.be.equal(anotherUser)
      expect(logs[1].args.tokenId).to.eq.BN(tokenId1)

      expect(logs[3].event).to.be.equal('Transfer')
      expect(logs[3].args.from).to.be.equal(user)
      expect(logs[3].args.to).to.be.equal(anotherUser)
      expect(logs[3].args.tokenId).to.eq.BN(tokenId2)

      ownerToken1 = await collectionsBridgedContract.ownerOf(tokenId1)
      ownerToken2 = await collectionsBridgedContract.ownerOf(tokenId2)
      expect(ownerToken1).to.be.equal(anotherUser)
      expect(ownerToken2).to.be.equal(anotherUser)
    })

    it('should safe transfer in batch by operator :: Relayed EIP721', async function () {
      let ownerToken1 = await collectionsBridgedContract.ownerOf(tokenId1)
      let ownerToken2 = await collectionsBridgedContract.ownerOf(tokenId2)
      expect(ownerToken1).to.be.equal(user)
      expect(ownerToken2).to.be.equal(user)

      await collectionsBridgedContract.approve(operator, tokenId1, fromUser)
      await collectionsBridgedContract.approve(operator, tokenId2, fromUser)

      const functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'address',
              name: '_from',
              type: 'address',
            },
            {
              internalType: 'address',
              name: '_to',
              type: 'address',
            },
            {
              internalType: 'uint256[]',
              name: '_tokenIds',
              type: 'uint256[]',
            },
            {
              internalType: 'bytes',
              name: 'data',
              type: 'bytes',
            },
          ],
          name: 'safeBatchTransferFrom',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [
          user,
          anotherUser,
          [tokenId1.toString(), tokenId2.toString()],
          EMPTY_HASH,
        ]
      )

      const { logs } = await sendMetaTx(
        collectionsBridgedContract,
        functionSignature,
        operator,
        relayer,
        null,
        'Decentraland Bridged Collection',
        '1'
      )

      // 0.6 Zep contracts emits an approval before each Transfer event for cleaning allowances
      expect(logs.length).to.be.equal(5)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(operator)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      expect(logs[2].event).to.be.equal('Transfer')
      expect(logs[2].args.from).to.be.equal(user)
      expect(logs[2].args.to).to.be.equal(anotherUser)
      expect(logs[2].args.tokenId).to.eq.BN(tokenId1)

      expect(logs[4].event).to.be.equal('Transfer')
      expect(logs[4].args.from).to.be.equal(user)
      expect(logs[4].args.to).to.be.equal(anotherUser)
      expect(logs[4].args.tokenId).to.eq.BN(tokenId2)

      ownerToken1 = await collectionsBridgedContract.ownerOf(tokenId1)
      ownerToken2 = await collectionsBridgedContract.ownerOf(tokenId2)
      expect(ownerToken1).to.be.equal(anotherUser)
      expect(ownerToken2).to.be.equal(anotherUser)
    })

    it('should safe transfer in batch by approval for all', async function () {
      let ownerToken1 = await collectionsBridgedContract.ownerOf(tokenId1)
      let ownerToken2 = await collectionsBridgedContract.ownerOf(tokenId2)
      expect(ownerToken1).to.be.equal(user)
      expect(ownerToken2).to.be.equal(user)

      await collectionsBridgedContract.setApprovalForAll(
        operator,
        true,
        fromUser
      )

      const { logs } = await collectionsBridgedContract.safeBatchTransferFrom(
        user,
        anotherUser,
        [tokenId1, tokenId2],
        EMPTY_HASH,
        { from: operator }
      )

      // 0.6 Zep contracts emits an approval before each Transfer event for cleaning allowances
      expect(logs.length).to.be.equal(4)
      expect(logs[1].event).to.be.equal('Transfer')
      expect(logs[1].args.from).to.be.equal(user)
      expect(logs[1].args.to).to.be.equal(anotherUser)
      expect(logs[1].args.tokenId).to.eq.BN(tokenId1)

      expect(logs[3].event).to.be.equal('Transfer')
      expect(logs[3].args.from).to.be.equal(user)
      expect(logs[3].args.to).to.be.equal(anotherUser)
      expect(logs[3].args.tokenId).to.eq.BN(tokenId2)

      ownerToken1 = await collectionsBridgedContract.ownerOf(tokenId1)
      ownerToken2 = await collectionsBridgedContract.ownerOf(tokenId2)
      expect(ownerToken1).to.be.equal(anotherUser)
      expect(ownerToken2).to.be.equal(anotherUser)
    })

    it('should safe transfer in batch by approval for all :: Relayed EIP721', async function () {
      let ownerToken1 = await collectionsBridgedContract.ownerOf(tokenId1)
      let ownerToken2 = await collectionsBridgedContract.ownerOf(tokenId2)
      expect(ownerToken1).to.be.equal(user)
      expect(ownerToken2).to.be.equal(user)

      await collectionsBridgedContract.setApprovalForAll(
        operator,
        true,
        fromUser
      )

      const functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'address',
              name: '_from',
              type: 'address',
            },
            {
              internalType: 'address',
              name: '_to',
              type: 'address',
            },
            {
              internalType: 'uint256[]',
              name: '_tokenIds',
              type: 'uint256[]',
            },
            {
              internalType: 'bytes',
              name: '_data',
              type: 'bytes',
            },
          ],
          name: 'safeBatchTransferFrom',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [
          user,
          anotherUser,
          [tokenId1.toString(), tokenId2.toString()],
          EMPTY_HASH,
        ]
      )

      const { logs } = await sendMetaTx(
        collectionsBridgedContract,
        functionSignature,
        operator,
        relayer,
        null,
        'Decentraland Bridged Collection',
        '1'
      )

      // 0.6 Zep contracts emits an approval before each Transfer event for cleaning allowances
      expect(logs.length).to.be.equal(5)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(operator)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      expect(logs[2].event).to.be.equal('Transfer')
      expect(logs[2].args.from).to.be.equal(user)
      expect(logs[2].args.to).to.be.equal(anotherUser)
      expect(logs[2].args.tokenId).to.eq.BN(tokenId1)

      expect(logs[4].event).to.be.equal('Transfer')
      expect(logs[4].args.from).to.be.equal(user)
      expect(logs[4].args.to).to.be.equal(anotherUser)
      expect(logs[4].args.tokenId).to.eq.BN(tokenId2)

      ownerToken1 = await collectionsBridgedContract.ownerOf(tokenId1)
      ownerToken2 = await collectionsBridgedContract.ownerOf(tokenId2)
      expect(ownerToken1).to.be.equal(anotherUser)
      expect(ownerToken2).to.be.equal(anotherUser)
    })

    it('reverts when transfer in batch by unuthorized user', async function () {
      let ownerToken1 = await collectionsBridgedContract.ownerOf(tokenId1)
      let ownerToken2 = await collectionsBridgedContract.ownerOf(tokenId2)
      expect(ownerToken1).to.be.equal(user)
      expect(ownerToken2).to.be.equal(user)

      await assertRevert(
        collectionsBridgedContract.batchTransferFrom(
          user,
          anotherUser,
          [tokenId1, tokenId2],
          fromHacker
        ),
        'ERC721: transfer caller is not owner nor approved'
      )

      await assertRevert(
        collectionsBridgedContract.batchTransferFrom(
          user,
          anotherUser,
          [tokenId1, tokenId2, tokenId3],
          fromAnotherUser
        ),
        'ERC721: transfer caller is not owner nor approved'
      )
    })

    it('reverts when transfer in batch by unuthorized user :: Relayed EIP721 ', async function () {
      let ownerToken1 = await collectionsBridgedContract.ownerOf(tokenId1)
      let ownerToken2 = await collectionsBridgedContract.ownerOf(tokenId2)
      expect(ownerToken1).to.be.equal(user)
      expect(ownerToken2).to.be.equal(user)

      let functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'address',
              name: '_from',
              type: 'address',
            },
            {
              internalType: 'address',
              name: '_to',
              type: 'address',
            },
            {
              internalType: 'uint256[]',
              name: '_tokenIds',
              type: 'uint256[]',
            },
            {
              internalType: 'bytes',
              name: '_data',
              type: 'bytes',
            },
          ],
          name: 'safeBatchTransferFrom',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [
          user,
          anotherUser,
          [tokenId1.toString(), tokenId2.toString()],
          EMPTY_HASH,
        ]
      )

      await assertRevert(
        sendMetaTx(
          collectionsBridgedContract,
          functionSignature,
          hacker,
          relayer,
          null,
          'Decentraland Bridged Collection',
          '1'
        ),
        'NMT#executeMetaTransaction: CALL_FAILED'
      )

      functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'address',
              name: '_from',
              type: 'address',
            },
            {
              internalType: 'address',
              name: '_to',
              type: 'address',
            },
            {
              internalType: 'uint256[]',
              name: '_tokenIds',
              type: 'uint256[]',
            },
            {
              internalType: 'bytes',
              name: '_data',
              type: 'bytes',
            },
          ],
          name: 'safeBatchTransferFrom',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [
          user,
          anotherUser,
          [tokenId1.toString(), tokenId2.toString(), tokenId3.toString()],
          '0x',
        ]
      )

      await assertRevert(
        sendMetaTx(
          collectionsBridgedContract,
          functionSignature,
          anotherUser,
          relayer,
          null,
          'Decentraland Bridged Collection',
          '1'
        ),
        'NMT#executeMetaTransaction: CALL_FAILED'
      )
    })

    it('reverts when beneficiary is 0 address', async function () {
      await assertRevert(
        collectionsBridgedContract.batchTransferFrom(
          user,
          ZERO_ADDRESS,
          [tokenId1, tokenId2],
          fromUser
        ),
        'ERC721: transfer to the zero address'
      )
    })
  })

  describe('tokenURI', async function () {
    beforeEach(async function () {
      await collectionsBridgedContract.mint(
        user,
        [
          [fakeCollection, 1, tokenURI1],
          [fakeCollection, 2, tokenURI2],
          [fakeCollection, 3, tokenURI3],
        ],
        fromAdmin
      )
    })

    it('should get tokenURI', async function () {
      let tokenURI = await collectionsBridgedContract.tokenURI(tokenId1)
      expect(tokenURI).to.be.equal(tokenURI1)

      tokenURI = await collectionsBridgedContract.tokenURI(tokenId2)
      expect(tokenURI).to.be.equal(tokenURI2)

      tokenURI = await collectionsBridgedContract.tokenURI(tokenId3)
      expect(tokenURI).to.be.equal(tokenURI3)
    })

    it('reverts when trying to get a non existing token tokenURI', async function () {
      await assertRevert(
        collectionsBridgedContract.tokenURI(EMPTY_HASH),
        'EBC#tokenURI: INVALID_TOKEN_ID'
      )
    })
  })
})
