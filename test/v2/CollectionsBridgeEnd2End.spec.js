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

describe.only('Collection Bridge End 2 End', function () {
  let factoryContract
  let raritiesContract
  let collectionsBridgeRootContract
  let collectionsBridgeChildContract
  let collectionsBridgedContract
  let collection1
  let collection2
  let fxRoot
  let fxChild
  let collectionsV2Validator

  let tokenURI1
  let tokenURI2
  let bridgedTokenId1
  let bridgedTokenId2

  // Accounts
  let accounts
  let deployer
  let user
  let anotherUser
  let owner
  let collector
  let hacker
  let relayer
  let admin
  let rootManager
  let fromUser
  let fromAnotherUser
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
    relayer = accounts[7]
    admin = accounts[8]
    rootManager = accounts[6]

    fromUser = { from: user }
    fromAnotherUser = { from: anotherUser }
    fromHacker = { from: hacker }

    fromOwner = { from: owner }
    fromDeployer = { from: deployer }

    creationParams = {
      ...fromOwner,
      gas: 9e6,
      gasPrice: 21e9,
    }
  })

  describe('Self deposit and withdraw', function () {
    let stateId
    let depositData
    it('deploy contracts', async function () {
      raritiesContract = await Rarities.new(owner, getInitialRarities())
      factoryContract = await createDummyFactory(deployer)
      collectionsV2Validator = await ERC721CollectionV2Validator.new(
        owner,
        [factoryContract.address],
        [1]
      )
      collection1 = await createDummyCollection(factoryContract, {
        creator: deployer,
        shouldComplete: true,
        shouldApprove: true,
        items: ITEMS,
        rarities: raritiesContract.address,
      })
      collection2 = await createDummyCollection(factoryContract, {
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

      await collection1.setApprovalForAll(
        collectionsBridgeRootContract.address,
        true,
        fromUser
      )
      await collection1.setApprovalForAll(
        collectionsBridgeRootContract.address,
        true,
        fromAnotherUser
      )
      await collection2.setApprovalForAll(
        collectionsBridgeRootContract.address,
        true,
        fromUser
      )
      await collection2.setApprovalForAll(
        collectionsBridgeRootContract.address,
        true,
        fromAnotherUser
      )

      tokenURI1 = await collection1.tokenURI(tokenId1)
      tokenURI2 = await collection1.tokenURI(tokenId2)

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
    })

    it('should deposit tokens', async function () {
      let ownerOfToken1 = await collection1.ownerOf(tokenId1)
      let ownerOfToken2 = await collection1.ownerOf(tokenId2)
      expect(ownerOfToken1).to.be.equal(user)
      expect(ownerOfToken2).to.be.equal(user)

      const { logs } = await collectionsBridgeRootContract.depositFor(
        user,
        [
          [
            collection1.address,
            tokenId1,
            web3.eth.abi.encodeParameters(
              ['address'],
              [factoryContract.address]
            ),
          ],
          [
            collection1.address,
            tokenId2,
            web3.eth.abi.encodeParameters(
              ['address'],
              [factoryContract.address]
            ),
          ],
        ],
        fromUser
      )

      const data = web3.eth.abi.encodeParameters(
        ['address', 'address', 'bytes'],
        [
          collectionsBridgeRootContract.address,
          collectionsBridgeChildContract.address,
          web3.eth.abi.encodeParameters(
            ['address', 'tuple(address,uint256,string)[]'],
            [
              user,
              [
                [collection1.address, tokenId1, tokenURI1],
                [collection1.address, tokenId2, tokenURI2],
              ],
            ]
          ),
        ]
      )

      expect(logs.length).to.be.equal(3)
      expect(logs[0].event).to.be.equal('Transfer')
      expect(logs[0].args.from).to.be.equal(user)
      expect(logs[0].args.to).to.be.equal(collectionsBridgeRootContract.address)
      expect(logs[0].args.tokenId).to.eq.BN(tokenId1)

      expect(logs[1].event).to.be.equal('Transfer')
      expect(logs[1].args.from).to.be.equal(user)
      expect(logs[1].args.to).to.be.equal(collectionsBridgeRootContract.address)
      expect(logs[1].args.tokenId).to.eq.BN(tokenId2)

      expect(logs[2].event).to.be.equal('StateSynced')
      expect(logs[2].args.id).to.eq.BN(1)
      expect(logs[2].args.contractAddress).to.be.equal(fxChild.address)
      expect(logs[2].args.data).to.be.equal(data)

      stateId = logs[2].args.id
      depositData = logs[2].args.data

      ownerOfToken1 = await collection1.ownerOf(tokenId1)
      ownerOfToken2 = await collection1.ownerOf(tokenId2)
      expect(ownerOfToken1).to.be.equal(collectionsBridgeRootContract.address)
      expect(ownerOfToken2).to.be.equal(collectionsBridgeRootContract.address)
    })

    it('reverts when trying to re-deposit the tokens', async function () {
      await assertRevert(
        collectionsBridgeRootContract.depositFor(
          user,
          [
            [
              collection1.address,
              tokenId1,
              web3.eth.abi.encodeParameters(
                ['address'],
                [factoryContract.address]
              ),
            ],
            [
              collection1.address,
              tokenId2,
              web3.eth.abi.encodeParameters(
                ['address'],
                [factoryContract.address]
              ),
            ],
          ],
          fromUser
        ),
        'ERC721: transfer of token that is not own'
      )
    })

    it('should receive deposit', async function () {
      let collectionBridgedBalance =
        await collectionsBridgedContract.totalSupply()
      expect(collectionBridgedBalance).to.be.eq.BN(0)

      const { logs } = await fxChild.onStateReceive(stateId, depositData)

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

    it('reverts when trying to mint the same tokens', async function () {
      await assertRevert(
        fxChild.onStateReceive(stateId, depositData),
        'CBC#_processMessageFromRoot: STATE_ID_ALREADY_PROCESSED'
      )

      await assertRevert(
        fxChild.onStateReceive(2, depositData),
        'ERC721: token already minted'
      )
    })

    it('should withdraw deposited tokens', async function () {
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

    it('reverts when trying to withdraw already withdrawn tokens', async function () {
      await assertRevert(
        collectionsBridgeChildContract.withdrawFor(
          user,
          [bridgedTokenId1, bridgedTokenId2],
          fromUser
        ),
        'ERC721: owner query for nonexistent token'
      )
    })

    it('should unlock tokens', async function () {
      const { logs } = await collectionsBridgeRootContract.receiveMessage(
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

      expect(logs.length).to.be.equal(2)
      expect(logs[0].event).to.be.equal('Transfer')
      expect(logs[0].args.from).to.be.equal(
        collectionsBridgeRootContract.address
      )
      expect(logs[0].args.to).to.be.equal(user)
      expect(logs[0].args.tokenId).to.eq.BN(tokenId1)

      expect(logs[1].event).to.be.equal('Transfer')
      expect(logs[1].args.from).to.be.equal(
        collectionsBridgeRootContract.address
      )
      expect(logs[1].args.to).to.be.equal(user)
      expect(logs[1].args.tokenId).to.eq.BN(tokenId2)

      let ownerOfToken1 = await collection1.ownerOf(tokenId1)
      let ownerOfToken2 = await collection1.ownerOf(tokenId2)
      expect(ownerOfToken1).to.be.equal(user)
      expect(ownerOfToken2).to.be.equal(user)
    })

    it('reverts when trying to re unlock tokens', async function () {
      await assertRevert(
        collectionsBridgeRootContract.receiveMessage(
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
        ),
        'ERC721: transfer of token that is not own'
      )
    })
  })

  describe('Deposit for another user and withdraw for user', function () {
    let stateId
    let depositData
    it('deploy contracts', async function () {
      raritiesContract = await Rarities.new(owner, getInitialRarities())
      factoryContract = await createDummyFactory(deployer)
      collectionsV2Validator = await ERC721CollectionV2Validator.new(
        owner,
        [factoryContract.address],
        [1]
      )
      collection1 = await createDummyCollection(factoryContract, {
        creator: deployer,
        shouldComplete: true,
        shouldApprove: true,
        items: ITEMS,
        rarities: raritiesContract.address,
      })
      collection2 = await createDummyCollection(factoryContract, {
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

      await collection1.setApprovalForAll(
        collectionsBridgeRootContract.address,
        true,
        fromUser
      )
      await collection1.setApprovalForAll(
        collectionsBridgeRootContract.address,
        true,
        fromAnotherUser
      )
      await collection2.setApprovalForAll(
        collectionsBridgeRootContract.address,
        true,
        fromUser
      )
      await collection2.setApprovalForAll(
        collectionsBridgeRootContract.address,
        true,
        fromAnotherUser
      )

      tokenURI1 = await collection1.tokenURI(tokenId1)
      tokenURI2 = await collection1.tokenURI(tokenId2)

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
    })

    it('should deposit tokens', async function () {
      let ownerOfToken1 = await collection1.ownerOf(tokenId1)
      let ownerOfToken2 = await collection1.ownerOf(tokenId2)
      expect(ownerOfToken1).to.be.equal(user)
      expect(ownerOfToken2).to.be.equal(user)

      const { logs } = await collectionsBridgeRootContract.depositFor(
        anotherUser,
        [
          [
            collection1.address,
            tokenId1,
            web3.eth.abi.encodeParameters(
              ['address'],
              [factoryContract.address]
            ),
          ],
          [
            collection1.address,
            tokenId2,
            web3.eth.abi.encodeParameters(
              ['address'],
              [factoryContract.address]
            ),
          ],
        ],
        fromUser
      )

      const data = web3.eth.abi.encodeParameters(
        ['address', 'address', 'bytes'],
        [
          collectionsBridgeRootContract.address,
          collectionsBridgeChildContract.address,
          web3.eth.abi.encodeParameters(
            ['address', 'tuple(address,uint256,string)[]'],
            [
              anotherUser,
              [
                [collection1.address, tokenId1, tokenURI1],
                [collection1.address, tokenId2, tokenURI2],
              ],
            ]
          ),
        ]
      )

      expect(logs.length).to.be.equal(3)
      expect(logs[0].event).to.be.equal('Transfer')
      expect(logs[0].args.from).to.be.equal(user)
      expect(logs[0].args.to).to.be.equal(collectionsBridgeRootContract.address)
      expect(logs[0].args.tokenId).to.eq.BN(tokenId1)

      expect(logs[1].event).to.be.equal('Transfer')
      expect(logs[1].args.from).to.be.equal(user)
      expect(logs[1].args.to).to.be.equal(collectionsBridgeRootContract.address)
      expect(logs[1].args.tokenId).to.eq.BN(tokenId2)

      expect(logs[2].event).to.be.equal('StateSynced')
      expect(logs[2].args.id).to.eq.BN(1)
      expect(logs[2].args.contractAddress).to.be.equal(fxChild.address)
      expect(logs[2].args.data).to.be.equal(data)

      stateId = logs[2].args.id
      depositData = logs[2].args.data

      ownerOfToken1 = await collection1.ownerOf(tokenId1)
      ownerOfToken2 = await collection1.ownerOf(tokenId2)
      expect(ownerOfToken1).to.be.equal(collectionsBridgeRootContract.address)
      expect(ownerOfToken2).to.be.equal(collectionsBridgeRootContract.address)
    })

    it('reverts when trying to re-deposit the tokens', async function () {
      await assertRevert(
        collectionsBridgeRootContract.depositFor(
          anotherUser,
          [
            [
              collection1.address,
              tokenId1,
              web3.eth.abi.encodeParameters(
                ['address'],
                [factoryContract.address]
              ),
            ],
            [
              collection1.address,
              tokenId2,
              web3.eth.abi.encodeParameters(
                ['address'],
                [factoryContract.address]
              ),
            ],
          ],
          fromUser
        ),
        'ERC721: transfer of token that is not own'
      )
    })

    it('should receive deposit', async function () {
      let collectionBridgedBalance =
        await collectionsBridgedContract.totalSupply()
      expect(collectionBridgedBalance).to.be.eq.BN(0)

      const { logs } = await fxChild.onStateReceive(stateId, depositData)

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
            anotherUser,
            [
              [collection1.address, tokenId1, tokenURI1],
              [collection1.address, tokenId2, tokenURI2],
            ],
          ]
        )
      )

      expect(logs[1].event).to.be.equal('Transfer')
      expect(logs[1].args.from).to.be.equal(ZERO_ADDRESS)
      expect(logs[1].args.to).to.be.equal(anotherUser)
      expect(logs[1].args.tokenId).to.eq.BN(bridgedTokenId1)

      expect(logs[2].event).to.be.equal('Transfer')
      expect(logs[2].args.from).to.be.equal(ZERO_ADDRESS)
      expect(logs[2].args.to).to.be.equal(anotherUser)
      expect(logs[2].args.tokenId).to.eq.BN(bridgedTokenId2)

      collectionBridgedBalance = await collectionsBridgedContract.totalSupply()
      expect(collectionBridgedBalance).to.be.eq.BN(2)

      const ownerOfBridgedToken1 = await collectionsBridgedContract.ownerOf(
        bridgedTokenId1
      )
      const ownerOfBridgedToken2 = await collectionsBridgedContract.ownerOf(
        bridgedTokenId2
      )
      expect(ownerOfBridgedToken1).to.be.equal(anotherUser)
      expect(ownerOfBridgedToken2).to.be.equal(anotherUser)

      const token1 = await collectionsBridgedContract.tokens(bridgedTokenId1)
      expect(token1.collection).to.be.equal(collection1.address)
      expect(token1.tokenId).to.be.eq.BN(tokenId1)
      expect(token1.tokenURI).to.be.equal(tokenURI1)

      const token2 = await collectionsBridgedContract.tokens(bridgedTokenId2)
      expect(token2.collection).to.be.equal(collection1.address)
      expect(token2.tokenId).to.be.eq.BN(tokenId2)
      expect(token2.tokenURI).to.be.equal(tokenURI2)
    })

    it('reverts when trying to mint the same tokens', async function () {
      await assertRevert(
        fxChild.onStateReceive(stateId, depositData),
        'CBC#_processMessageFromRoot: STATE_ID_ALREADY_PROCESSED'
      )

      await assertRevert(
        fxChild.onStateReceive(2, depositData),
        'ERC721: token already minted'
      )
    })

    it('should withdraw deposited tokens', async function () {
      let collectionBridgedBalance =
        await collectionsBridgedContract.totalSupply()
      expect(collectionBridgedBalance).to.be.eq.BN(2)

      let balanceOfUser = await collectionsBridgedContract.balanceOf(
        anotherUser
      )
      expect(balanceOfUser).to.be.eq.BN(2)

      const { logs } = await collectionsBridgeChildContract.withdrawFor(
        user,
        [bridgedTokenId1, bridgedTokenId2],
        fromAnotherUser
      )

      expect(logs.length).to.be.equal(3)

      expect(logs[0].event).to.be.equal('Transfer')
      expect(logs[0].args.from).to.be.equal(anotherUser)
      expect(logs[0].args.to).to.be.equal(ZERO_ADDRESS)
      expect(logs[0].args.tokenId).to.eq.BN(bridgedTokenId1)

      expect(logs[1].event).to.be.equal('Transfer')
      expect(logs[1].args.from).to.be.equal(anotherUser)
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

    it('reverts when trying to withdraw already withdrawn tokens', async function () {
      await assertRevert(
        collectionsBridgeChildContract.withdrawFor(
          user,
          [bridgedTokenId1, bridgedTokenId2],
          fromUser
        ),
        'ERC721: owner query for nonexistent token'
      )
    })

    it('should unlock tokens', async function () {
      const { logs } = await collectionsBridgeRootContract.receiveMessage(
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

      expect(logs.length).to.be.equal(2)
      expect(logs[0].event).to.be.equal('Transfer')
      expect(logs[0].args.from).to.be.equal(
        collectionsBridgeRootContract.address
      )
      expect(logs[0].args.to).to.be.equal(user)
      expect(logs[0].args.tokenId).to.eq.BN(tokenId1)

      expect(logs[1].event).to.be.equal('Transfer')
      expect(logs[1].args.from).to.be.equal(
        collectionsBridgeRootContract.address
      )
      expect(logs[1].args.to).to.be.equal(user)
      expect(logs[1].args.tokenId).to.eq.BN(tokenId2)

      let ownerOfToken1 = await collection1.ownerOf(tokenId1)
      let ownerOfToken2 = await collection1.ownerOf(tokenId2)
      expect(ownerOfToken1).to.be.equal(user)
      expect(ownerOfToken2).to.be.equal(user)
    })

    it('reverts when trying to re unlock tokens', async function () {
      await assertRevert(
        collectionsBridgeRootContract.receiveMessage(
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
        ),
        'ERC721: transfer of token that is not own'
      )
    })
  })

  describe('Deposit and withdraw for another user', function () {
    let stateId
    let depositData
    it('deploy contracts', async function () {
      raritiesContract = await Rarities.new(owner, getInitialRarities())
      factoryContract = await createDummyFactory(deployer)
      collectionsV2Validator = await ERC721CollectionV2Validator.new(
        owner,
        [factoryContract.address],
        [1]
      )
      collection1 = await createDummyCollection(factoryContract, {
        creator: deployer,
        shouldComplete: true,
        shouldApprove: true,
        items: ITEMS,
        rarities: raritiesContract.address,
      })
      collection2 = await createDummyCollection(factoryContract, {
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

      await collection1.setApprovalForAll(
        collectionsBridgeRootContract.address,
        true,
        fromUser
      )
      await collection1.setApprovalForAll(
        collectionsBridgeRootContract.address,
        true,
        fromAnotherUser
      )
      await collection2.setApprovalForAll(
        collectionsBridgeRootContract.address,
        true,
        fromUser
      )
      await collection2.setApprovalForAll(
        collectionsBridgeRootContract.address,
        true,
        fromAnotherUser
      )

      tokenURI1 = await collection1.tokenURI(tokenId1)
      tokenURI2 = await collection1.tokenURI(tokenId2)

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
    })

    it('should deposit tokens', async function () {
      let ownerOfToken1 = await collection1.ownerOf(tokenId1)
      let ownerOfToken2 = await collection1.ownerOf(tokenId2)
      expect(ownerOfToken1).to.be.equal(user)
      expect(ownerOfToken2).to.be.equal(user)

      const { logs } = await collectionsBridgeRootContract.depositFor(
        anotherUser,
        [
          [
            collection1.address,
            tokenId1,
            web3.eth.abi.encodeParameters(
              ['address'],
              [factoryContract.address]
            ),
          ],
          [
            collection1.address,
            tokenId2,
            web3.eth.abi.encodeParameters(
              ['address'],
              [factoryContract.address]
            ),
          ],
        ],
        fromUser
      )

      const data = web3.eth.abi.encodeParameters(
        ['address', 'address', 'bytes'],
        [
          collectionsBridgeRootContract.address,
          collectionsBridgeChildContract.address,
          web3.eth.abi.encodeParameters(
            ['address', 'tuple(address,uint256,string)[]'],
            [
              anotherUser,
              [
                [collection1.address, tokenId1, tokenURI1],
                [collection1.address, tokenId2, tokenURI2],
              ],
            ]
          ),
        ]
      )

      expect(logs.length).to.be.equal(3)
      expect(logs[0].event).to.be.equal('Transfer')
      expect(logs[0].args.from).to.be.equal(user)
      expect(logs[0].args.to).to.be.equal(collectionsBridgeRootContract.address)
      expect(logs[0].args.tokenId).to.eq.BN(tokenId1)

      expect(logs[1].event).to.be.equal('Transfer')
      expect(logs[1].args.from).to.be.equal(user)
      expect(logs[1].args.to).to.be.equal(collectionsBridgeRootContract.address)
      expect(logs[1].args.tokenId).to.eq.BN(tokenId2)

      expect(logs[2].event).to.be.equal('StateSynced')
      expect(logs[2].args.id).to.eq.BN(1)
      expect(logs[2].args.contractAddress).to.be.equal(fxChild.address)
      expect(logs[2].args.data).to.be.equal(data)

      stateId = logs[2].args.id
      depositData = logs[2].args.data

      ownerOfToken1 = await collection1.ownerOf(tokenId1)
      ownerOfToken2 = await collection1.ownerOf(tokenId2)
      expect(ownerOfToken1).to.be.equal(collectionsBridgeRootContract.address)
      expect(ownerOfToken2).to.be.equal(collectionsBridgeRootContract.address)
    })

    it('reverts when trying to re-deposit the tokens', async function () {
      await assertRevert(
        collectionsBridgeRootContract.depositFor(
          anotherUser,
          [
            [
              collection1.address,
              tokenId1,
              web3.eth.abi.encodeParameters(
                ['address'],
                [factoryContract.address]
              ),
            ],
            [
              collection1.address,
              tokenId2,
              web3.eth.abi.encodeParameters(
                ['address'],
                [factoryContract.address]
              ),
            ],
          ],
          fromUser
        ),
        'ERC721: transfer of token that is not own'
      )
    })

    it('should receive deposit', async function () {
      let collectionBridgedBalance =
        await collectionsBridgedContract.totalSupply()
      expect(collectionBridgedBalance).to.be.eq.BN(0)

      const { logs } = await fxChild.onStateReceive(stateId, depositData)

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
            anotherUser,
            [
              [collection1.address, tokenId1, tokenURI1],
              [collection1.address, tokenId2, tokenURI2],
            ],
          ]
        )
      )

      expect(logs[1].event).to.be.equal('Transfer')
      expect(logs[1].args.from).to.be.equal(ZERO_ADDRESS)
      expect(logs[1].args.to).to.be.equal(anotherUser)
      expect(logs[1].args.tokenId).to.eq.BN(bridgedTokenId1)

      expect(logs[2].event).to.be.equal('Transfer')
      expect(logs[2].args.from).to.be.equal(ZERO_ADDRESS)
      expect(logs[2].args.to).to.be.equal(anotherUser)
      expect(logs[2].args.tokenId).to.eq.BN(bridgedTokenId2)

      collectionBridgedBalance = await collectionsBridgedContract.totalSupply()
      expect(collectionBridgedBalance).to.be.eq.BN(2)

      const ownerOfBridgedToken1 = await collectionsBridgedContract.ownerOf(
        bridgedTokenId1
      )
      const ownerOfBridgedToken2 = await collectionsBridgedContract.ownerOf(
        bridgedTokenId2
      )
      expect(ownerOfBridgedToken1).to.be.equal(anotherUser)
      expect(ownerOfBridgedToken2).to.be.equal(anotherUser)

      const token1 = await collectionsBridgedContract.tokens(bridgedTokenId1)
      expect(token1.collection).to.be.equal(collection1.address)
      expect(token1.tokenId).to.be.eq.BN(tokenId1)
      expect(token1.tokenURI).to.be.equal(tokenURI1)

      const token2 = await collectionsBridgedContract.tokens(bridgedTokenId2)
      expect(token2.collection).to.be.equal(collection1.address)
      expect(token2.tokenId).to.be.eq.BN(tokenId2)
      expect(token2.tokenURI).to.be.equal(tokenURI2)
    })

    it('reverts when trying to mint the same tokens', async function () {
      await assertRevert(
        fxChild.onStateReceive(stateId, depositData),
        'CBC#_processMessageFromRoot: STATE_ID_ALREADY_PROCESSED'
      )

      await assertRevert(
        fxChild.onStateReceive(2, depositData),
        'ERC721: token already minted'
      )
    })

    it('should withdraw deposited tokens', async function () {
      let collectionBridgedBalance =
        await collectionsBridgedContract.totalSupply()
      expect(collectionBridgedBalance).to.be.eq.BN(2)

      let balanceOfUser = await collectionsBridgedContract.balanceOf(
        anotherUser
      )
      expect(balanceOfUser).to.be.eq.BN(2)

      const { logs } = await collectionsBridgeChildContract.withdrawFor(
        anotherUser,
        [bridgedTokenId1, bridgedTokenId2],
        fromAnotherUser
      )

      expect(logs.length).to.be.equal(3)

      expect(logs[0].event).to.be.equal('Transfer')
      expect(logs[0].args.from).to.be.equal(anotherUser)
      expect(logs[0].args.to).to.be.equal(ZERO_ADDRESS)
      expect(logs[0].args.tokenId).to.eq.BN(bridgedTokenId1)

      expect(logs[1].event).to.be.equal('Transfer')
      expect(logs[1].args.from).to.be.equal(anotherUser)
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

    it('reverts when trying to withdraw already withdrawn tokens', async function () {
      await assertRevert(
        collectionsBridgeChildContract.withdrawFor(
          anotherUser,
          [bridgedTokenId1, bridgedTokenId2],
          fromUser
        ),
        'ERC721: owner query for nonexistent token'
      )
    })

    it('should unlock tokens', async function () {
      const { logs } = await collectionsBridgeRootContract.receiveMessage(
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

      expect(logs.length).to.be.equal(2)
      expect(logs[0].event).to.be.equal('Transfer')
      expect(logs[0].args.from).to.be.equal(
        collectionsBridgeRootContract.address
      )
      expect(logs[0].args.to).to.be.equal(anotherUser)
      expect(logs[0].args.tokenId).to.eq.BN(tokenId1)

      expect(logs[1].event).to.be.equal('Transfer')
      expect(logs[1].args.from).to.be.equal(
        collectionsBridgeRootContract.address
      )
      expect(logs[1].args.to).to.be.equal(anotherUser)
      expect(logs[1].args.tokenId).to.eq.BN(tokenId2)

      let ownerOfToken1 = await collection1.ownerOf(tokenId1)
      let ownerOfToken2 = await collection1.ownerOf(tokenId2)
      expect(ownerOfToken1).to.be.equal(anotherUser)
      expect(ownerOfToken2).to.be.equal(anotherUser)
    })

    it('reverts when trying to re unlock tokens', async function () {
      await assertRevert(
        collectionsBridgeRootContract.receiveMessage(
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
        ),
        'ERC721: transfer of token that is not own'
      )
    })
  })
})
