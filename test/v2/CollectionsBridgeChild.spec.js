import hr from 'hardhat'
import { expect } from 'chai'

import assertRevert from '../helpers/assertRevert'
import {
  ITEMS,
  ZERO_ADDRESS,
  getInitialRarities,
  MAX_TOKENS_PER_TX,
  createDummyFactory,
  createDummyCollection,
  encodeTokenId,
} from '../helpers/collectionV2'
import { sendMetaTx } from '../helpers/metaTx'

const Rarities = artifacts.require('Rarities')
const ERC721BridgedCollection = artifacts.require('ERC721BridgedCollection')
const CollectionsBridgeRoot = artifacts.require('DummyCollectionsBridgeRoot')
const CollectionsBridgeChild = artifacts.require('DummyCollectionsBridgeChild')
const FxRoot = artifacts.require('DummyFxRoot')
const FxChild = artifacts.require('DummyFxChild')
const ERC721CollectionV2Validator = artifacts.require(
  'ERC721CollectionV2Validator'
)
const tokenId1 = encodeTokenId(0, 1)
const tokenId2 = encodeTokenId(0, 2)
const tokenId3 = encodeTokenId(0, 3)

describe('CollectionsBridgeChild', function () {
  let factoryContract1
  let factoryContract2
  let raritiesContract
  let collectionsBridgeRootContract
  let collectionsBridgeChildContract
  let collectionsBridgedContract
  let collection1
  let collection2
  let collection3
  let fxRoot
  let fxChild
  let collectionsV2Validator

  let tokenURI1
  let tokenURI2
  let tokenURI3

  // Accounts
  let accounts
  let deployer
  let user
  let anotherUser
  let owner
  let hacker
  let relayer
  let rootManager
  let fromUser
  let fromAnotherUser
  let fromHacker
  let fromOwner

  let creationParams

  beforeEach(async function () {
    accounts = await web3.eth.getAccounts()
    deployer = accounts[0]
    user = accounts[1]
    owner = accounts[3]
    hacker = accounts[4]
    anotherUser = accounts[5]
    relayer = accounts[7]
    rootManager = accounts[6]

    fromUser = { from: user }
    fromAnotherUser = { from: anotherUser }
    fromHacker = { from: hacker }

    fromOwner = { from: owner }

    creationParams = {
      ...fromOwner,
      gas: 9e6,
      gasPrice: 21e9,
    }

    raritiesContract = await Rarities.new(owner, getInitialRarities())
    factoryContract1 = await createDummyFactory(deployer)
    factoryContract2 = await createDummyFactory(deployer)
    collectionsV2Validator = await ERC721CollectionV2Validator.new(
      owner,
      [factoryContract1.address],
      [1]
    )
    collection1 = await createDummyCollection(factoryContract1, {
      creator: deployer,
      shouldComplete: true,
      shouldApprove: true,
      items: ITEMS,
      rarities: raritiesContract.address,
    })
    collection2 = await createDummyCollection(factoryContract1, {
      creator: deployer,
      shouldComplete: true,
      shouldApprove: true,
      items: ITEMS,
      rarities: raritiesContract.address,
    })
    collection3 = await createDummyCollection(factoryContract2, {
      creator: deployer,
      shouldComplete: true,
      shouldApprove: true,
      items: ITEMS,
      rarities: raritiesContract.address,
    })

    await collection1.issueTokens(
      [user, user, anotherUser, anotherUser],
      [0, 0, 0, 1]
    )
    await collection2.issueTokens(
      [user, user, anotherUser, anotherUser],
      [0, 3, 0, 1]
    )

    fxRoot = await FxRoot.new()
    fxChild = await FxChild.new(fxRoot.address)
    await fxRoot.setFxChild(fxChild.address)

    collectionsBridgeRootContract = await CollectionsBridgeRoot.new(
      owner,
      MAX_TOKENS_PER_TX,
      rootManager,
      fxRoot.address,
      collectionsV2Validator.address
    )

    collectionsBridgedContract = await ERC721BridgedCollection.new(
      owner,
      ZERO_ADDRESS,
      'Collection Bridged',
      'CB'
    )

    collectionsBridgeChildContract = await CollectionsBridgeChild.new(
      owner,
      MAX_TOKENS_PER_TX,
      fxChild.address,
      collectionsBridgedContract.address
    )

    await collectionsBridgeRootContract.setFxChildTunnel(
      collectionsBridgeChildContract.address
    )
    await collectionsBridgeChildContract.setFxRootTunnel(
      collectionsBridgeRootContract.address
    )

    await collectionsBridgedContract.setAdmin(
      collectionsBridgeChildContract.address,
      fromOwner
    )

    collection1.setApprovalForAll(
      collectionsBridgeRootContract.address,
      true,
      fromUser
    )
    collection1.setApprovalForAll(
      collectionsBridgeRootContract.address,
      true,
      fromAnotherUser
    )
    collection2.setApprovalForAll(
      collectionsBridgeRootContract.address,
      true,
      fromUser
    )
    collection2.setApprovalForAll(
      collectionsBridgeRootContract.address,
      true,
      fromAnotherUser
    )

    tokenURI1 = await collection1.tokenURI(tokenId1)
    tokenURI2 = await collection1.tokenURI(tokenId2)
    tokenURI3 = await collection1.tokenURI(tokenId3)
  })

  describe('create collection bridge child', async function () {
    it('deploy with correct values', async function () {
      const contract = await CollectionsBridgeChild.new(
        owner,
        MAX_TOKENS_PER_TX,
        fxChild.address,
        collectionsBridgedContract.address
      )

      await contract.setFxRootTunnel(collectionsBridgeRootContract.address)

      const collectionBridgeChildOwner = await contract.owner()
      const maxTokensPerTx = await contract.maxTokensPerTx()
      const collectionBridgeChildfFxChild = await contract.fxChild()
      const bridgedCollection = await contract.bridgedCollection()
      const rootContract = await contract.fxRootTunnel()

      expect(collectionBridgeChildOwner).to.be.equal(owner)
      expect(maxTokensPerTx).to.be.eq.BN(MAX_TOKENS_PER_TX)
      expect(collectionBridgeChildfFxChild).to.be.equal(fxChild.address)
      expect(bridgedCollection).to.be.equal(collectionsBridgedContract.address)
      expect(rootContract).to.be.equal(collectionsBridgeRootContract.address)
    })
  })

  describe('Receive Deposit', async function () {
    it('should receive deposited tokens', async function () {
      const tokenId1 = encodeTokenId(0, 1)
      const tokenId2 = encodeTokenId(0, 2)
      const tokenURI1 = await collection1.tokenURI(tokenId1)
      const tokenURI2 = await collection1.tokenURI(tokenId2)
      const bridgedTokenId1 = web3.utils.toBN(
        web3.utils.soliditySha3({
          t: 'bytes',
          v: web3.eth.abi.encodeParameters(
            ['address', 'uint256'],
            [collection1.address, tokenId1]
          ),
        })
      )
      const bridgedTokenId2 = web3.utils.toBN(
        web3.utils.soliditySha3({
          t: 'bytes',
          v: web3.eth.abi.encodeParameters(
            ['address', 'uint256'],
            [collection1.address, tokenId2]
          ),
        })
      )

      const res = await collectionsBridgeRootContract.depositFor(
        user,
        [
          [
            collection1.address,
            tokenId1,
            web3.eth.abi.encodeParameters(
              ['address'],
              [factoryContract1.address]
            ),
          ],
          [
            collection1.address,
            tokenId2,
            web3.eth.abi.encodeParameters(
              ['address'],
              [factoryContract1.address]
            ),
          ],
        ],
        fromUser
      )
      const depositData = res.logs[2].args.data

      let collectionBridgedBalance =
        await collectionsBridgedContract.totalSupply()
      expect(collectionBridgedBalance).to.be.eq.BN(0)

      const { logs } = await fxChild.onStateReceive(
        res.logs[2].args.id,
        depositData
      )

      expect(logs.length).to.be.equal(3)

      expect(logs[0].event).to.be.equal('NewFxMessage')
      expect(logs[0].args.rootMessageSender).to.be.equal(
        collectionsBridgeRootContract.address
      )
      expect(logs[0].args.receiver).to.be.equal(
        collectionsBridgeChildContract.address
      )
      expect(logs[0].args.data).to.equal(
        web3.eth.abi.encodeParameters(
          ['address', 'tuple(address,uint256,string)[]'],
          [
            user,
            [
              [collection1.address, tokenId1, tokenURI1],
              [collection1.address, tokenId2, tokenURI2],
            ],
          ]
        )
      )

      expect(logs[1].event).to.be.equal('Transfer')
      expect(logs[1].args.from).to.be.equal(ZERO_ADDRESS)
      expect(logs[1].args.to).to.be.equal(user)
      expect(logs[1].args.tokenId).to.eq.BN(bridgedTokenId1)

      expect(logs[2].event).to.be.equal('Transfer')
      expect(logs[2].args.from).to.be.equal(ZERO_ADDRESS)
      expect(logs[2].args.to).to.be.equal(user)
      expect(logs[2].args.tokenId).to.eq.BN(bridgedTokenId2)

      collectionBridgedBalance = await collectionsBridgedContract.totalSupply()
      expect(collectionBridgedBalance).to.be.eq.BN(2)

      const ownerOfBridgedToken1 = await collectionsBridgedContract.ownerOf(
        bridgedTokenId1
      )
      const ownerOfBridgedToken2 = await collectionsBridgedContract.ownerOf(
        bridgedTokenId2
      )
      expect(ownerOfBridgedToken1).to.be.equal(user)
      expect(ownerOfBridgedToken2).to.be.equal(user)

      const token1 = await collectionsBridgedContract.tokens(bridgedTokenId1)
      expect(token1.collection).to.be.equal(collection1.address)
      expect(token1.tokenId).to.be.eq.BN(tokenId1)
      expect(token1.tokenURI).to.be.equal(tokenURI1)

      const token2 = await collectionsBridgedContract.tokens(bridgedTokenId2)
      expect(token2.collection).to.be.equal(collection1.address)
      expect(token2.tokenId).to.be.eq.BN(tokenId2)
      expect(token2.tokenURI).to.be.equal(tokenURI2)
    })

    it('reverts when receiving an already processed state', async function () {
      const res = await collectionsBridgeRootContract.depositFor(
        user,
        [
          [
            collection1.address,
            tokenId1,
            web3.eth.abi.encodeParameters(
              ['address'],
              [factoryContract1.address]
            ),
          ],
          [
            collection1.address,
            tokenId2,
            web3.eth.abi.encodeParameters(
              ['address'],
              [factoryContract1.address]
            ),
          ],
        ],
        fromUser
      )
      const depositData = res.logs[2].args.data

      await fxChild.onStateReceive(res.logs[2].args.id, depositData)

      await assertRevert(
        fxChild.onStateReceive(res.logs[2].args.id, depositData),
        'CBC#_processMessageFromRoot: STATE_ID_ALREADY_PROCESSED'
      )
    })

    it('reverts when trying to mint an existing token', async function () {
      let res = await collectionsBridgeRootContract.depositFor(
        user,
        [
          [
            collection1.address,
            tokenId1,
            web3.eth.abi.encodeParameters(
              ['address'],
              [factoryContract1.address]
            ),
          ],
          [
            collection1.address,
            tokenId2,
            web3.eth.abi.encodeParameters(
              ['address'],
              [factoryContract1.address]
            ),
          ],
        ],
        fromUser
      )
      let depositData = res.logs[2].args.data

      await fxChild.onStateReceive(res.logs[2].args.id, depositData)

      await collectionsBridgeRootContract.receiveMessage(
        web3.eth.abi.encodeParameters(
          ['address', 'tuple(address,uint256,string)[]'],
          [
            user,
            [
              [collection1.address, tokenId1, tokenURI1],
              [collection1.address, tokenId2, tokenURI2],
            ],
          ]
        )
      )

      res = await collectionsBridgeRootContract.depositFor(
        user,
        [
          [
            collection1.address,
            tokenId1,
            web3.eth.abi.encodeParameters(
              ['address'],
              [factoryContract1.address]
            ),
          ],
          [
            collection1.address,
            tokenId2,
            web3.eth.abi.encodeParameters(
              ['address'],
              [factoryContract1.address]
            ),
          ],
        ],
        fromUser
      )
      depositData = res.logs[2].args.data

      await assertRevert(
        fxChild.onStateReceive(res.logs[2].args.id, depositData),
        'ERC721: token already minted'
      )
    })
  })

  describe('withdrawFor', async function () {
    let bridgedTokenId1
    let bridgedTokenId2

    beforeEach(async function () {
      bridgedTokenId1 = web3.utils.toBN(
        web3.utils.soliditySha3({
          t: 'bytes',
          v: web3.eth.abi.encodeParameters(
            ['address', 'uint256'],
            [collection1.address, tokenId1]
          ),
        })
      )
      bridgedTokenId2 = web3.utils.toBN(
        web3.utils.soliditySha3({
          t: 'bytes',
          v: web3.eth.abi.encodeParameters(
            ['address', 'uint256'],
            [collection1.address, tokenId2]
          ),
        })
      )

      const res = await collectionsBridgeRootContract.depositFor(
        user,
        [
          [
            collection1.address,
            tokenId1,
            web3.eth.abi.encodeParameters(
              ['address'],
              [factoryContract1.address]
            ),
          ],
          [
            collection1.address,
            tokenId2,
            web3.eth.abi.encodeParameters(
              ['address'],
              [factoryContract1.address]
            ),
          ],
        ],
        fromUser
      )
      const depositData = res.logs[2].args.data

      await fxChild.onStateReceive(res.logs[2].args.id, depositData)
    })

    it('should withdraw bridged tokens', async function () {
      let collectionBridgedBalance =
        await collectionsBridgedContract.totalSupply()
      expect(collectionBridgedBalance).to.be.eq.BN(2)

      let balanceOfUser = await collectionsBridgedContract.balanceOf(user)
      expect(balanceOfUser).to.be.eq.BN(2)

      const { logs } = await collectionsBridgeChildContract.withdrawFor(
        user,
        [bridgedTokenId1, bridgedTokenId2],
        fromUser
      )

      expect(logs.length).to.be.equal(3)

      expect(logs[0].event).to.be.equal('Transfer')
      expect(logs[0].args.from).to.be.equal(user)
      expect(logs[0].args.to).to.be.equal(ZERO_ADDRESS)
      expect(logs[0].args.tokenId).to.eq.BN(bridgedTokenId1)

      expect(logs[1].event).to.be.equal('Transfer')
      expect(logs[1].args.from).to.be.equal(user)
      expect(logs[1].args.to).to.be.equal(ZERO_ADDRESS)
      expect(logs[1].args.tokenId).to.eq.BN(bridgedTokenId2)

      expect(logs[2].event).to.be.equal('MessageSent')
      expect(logs[2].args.message).to.be.equal(
        web3.eth.abi.encodeParameters(
          ['address', 'tuple(address,uint256,string)[]'],
          [
            user,
            [
              [collection1.address, tokenId1, tokenURI1],
              [collection1.address, tokenId2, tokenURI2],
            ],
          ]
        )
      )

      collectionBridgedBalance = await collectionsBridgedContract.totalSupply()
      expect(collectionBridgedBalance).to.be.eq.BN(0)
    })

    it('should withdraw bridged tokens :: Relayed EIP721', async function () {
      let collectionBridgedBalance =
        await collectionsBridgedContract.totalSupply()
      expect(collectionBridgedBalance).to.be.eq.BN(2)

      let balanceOfUser = await collectionsBridgedContract.balanceOf(user)
      expect(balanceOfUser).to.be.eq.BN(2)

      const functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
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
          ],
          name: 'withdrawFor',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [user, [bridgedTokenId1, bridgedTokenId2]]
      )

      const { logs } = await sendMetaTx(
        collectionsBridgeChildContract,
        functionSignature,
        user,
        relayer,
        null,
        'Decentraland Collection Bridge Child',
        '1'
      )

      expect(logs.length).to.be.equal(4)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(user)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      expect(logs[1].event).to.be.equal('Transfer')
      expect(logs[1].args.from).to.be.equal(user)
      expect(logs[1].args.to).to.be.equal(ZERO_ADDRESS)
      expect(logs[1].args.tokenId).to.eq.BN(bridgedTokenId1)

      expect(logs[2].event).to.be.equal('Transfer')
      expect(logs[2].args.from).to.be.equal(user)
      expect(logs[2].args.to).to.be.equal(ZERO_ADDRESS)
      expect(logs[2].args.tokenId).to.eq.BN(bridgedTokenId2)

      expect(logs[3].event).to.be.equal('MessageSent')
      expect(logs[3].args.message).to.be.equal(
        web3.eth.abi.encodeParameters(
          ['address', 'tuple(address,uint256,string)[]'],
          [
            user,
            [
              [collection1.address, tokenId1, tokenURI1],
              [collection1.address, tokenId2, tokenURI2],
            ],
          ]
        )
      )

      collectionBridgedBalance = await collectionsBridgedContract.totalSupply()
      expect(collectionBridgedBalance).to.be.eq.BN(0)
    })

    it('should withdraw bridged tokens for another account', async function () {
      let collectionBridgedBalance =
        await collectionsBridgedContract.totalSupply()
      expect(collectionBridgedBalance).to.be.eq.BN(2)

      let balanceOfUser = await collectionsBridgedContract.balanceOf(user)
      expect(balanceOfUser).to.be.eq.BN(2)

      const { logs } = await collectionsBridgeChildContract.withdrawFor(
        anotherUser,
        [bridgedTokenId1, bridgedTokenId2],
        fromUser
      )

      expect(logs.length).to.be.equal(3)

      expect(logs[0].event).to.be.equal('Transfer')
      expect(logs[0].args.from).to.be.equal(user)
      expect(logs[0].args.to).to.be.equal(ZERO_ADDRESS)
      expect(logs[0].args.tokenId).to.eq.BN(bridgedTokenId1)

      expect(logs[1].event).to.be.equal('Transfer')
      expect(logs[1].args.from).to.be.equal(user)
      expect(logs[1].args.to).to.be.equal(ZERO_ADDRESS)
      expect(logs[1].args.tokenId).to.eq.BN(bridgedTokenId2)

      expect(logs[2].event).to.be.equal('MessageSent')
      expect(logs[2].args.message).to.be.equal(
        web3.eth.abi.encodeParameters(
          ['address', 'tuple(address,uint256,string)[]'],
          [
            anotherUser,
            [
              [collection1.address, tokenId1, tokenURI1],
              [collection1.address, tokenId2, tokenURI2],
            ],
          ]
        )
      )

      collectionBridgedBalance = await collectionsBridgedContract.totalSupply()
      expect(collectionBridgedBalance).to.be.eq.BN(0)
    })

    it('reverts when trying to withdraw more tokens than the maximum allowed', async function () {
      const tokensToWithdraw = []
      for (let i = 0; i <= MAX_TOKENS_PER_TX; i++) {
        tokensToWithdraw.push(bridgedTokenId1)
      }
      await assertRevert(
        collectionsBridgeChildContract.withdrawFor(
          anotherUser,
          tokensToWithdraw,
          fromUser
        ),
        'CBC#withdrawFor: MAX_TOKENS_PER_TX_EXCEEDED'
      )
    })

    it('reverts when trying to withdraw not owned tokens', async function () {
      await assertRevert(
        collectionsBridgeChildContract.withdrawFor(
          user,
          [bridgedTokenId1, bridgedTokenId2],
          fromHacker
        ),
        'CBC#withdrawFor: SENDER_NOT_THE_TOKEN_OWNER'
      )

      await assertRevert(
        collectionsBridgeChildContract.withdrawFor(
          user,
          [bridgedTokenId1, bridgedTokenId1],
          fromHacker
        ),
        'CBC#withdrawFor: SENDER_NOT_THE_TOKEN_OWNER'
      )
    })

    it('reverts when trying to withdraw an non-existing token', async function () {
      await assertRevert(
        collectionsBridgeChildContract.withdrawFor(user, [1], fromHacker),
        'ERC721: owner query for nonexistent token'
      )
    })
  })
})
