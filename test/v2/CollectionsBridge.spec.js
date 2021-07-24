import hr from 'hardhat'
import { expect } from 'chai'

import assertRevert from '../helpers/assertRevert'
import {
  ITEMS,
  ZERO_ADDRESS,
  getInitData,
  RARITIES,
  getInitialRarities,
  getRarityNames,
  getRarityDefaulPrices,
  DEFAULT_RARITY_PRICE,
  MAX_UINT256,
  MAX_TOKENS_PER_TX,
  createDummyFactory,
  createDummyCollection,
  encodeTokenId,
} from '../helpers/collectionV2'
import { sendMetaTx } from '../helpers/metaTx'

const Rarities = artifacts.require('Rarities')
const ERC721CollectionFactoryV2 = artifacts.require('ERC721CollectionFactoryV2')
const ERC721CollectionV2 = artifacts.require('ERC721CollectionV2')
const ERC721BridgedCollection = artifacts.require('ERC721BridgedCollection')
const CollectionsBridgeRoot = artifacts.require('DummyCollectionsBridgeRoot')
const CollectionsBridgeChild = artifacts.require('DummyCollectionsBridgeChild')
const FxRoot = artifacts.require('DummyFxRoot')
const FxChild = artifacts.require('DummyFxChild')
const ERC721CollectionV2Validator = artifacts.require(
  'ERC721CollectionV2Validator'
)

describe('Collection Bridge', function () {
  let manaContract
  let collectionImplementation
  let factoryContract
  let committeeContract
  let collectionManagerContract
  let forwarderContract
  let raritiesContract
  let collectionsBridgeRootContract
  let collectionsBridgeChildContract
  let collectionsBridgedContract
  let collection1
  let collection2
  let fxRoot
  let fxChild
  let collectionsV2Validator

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

    raritiesContract = await Rarities.new(owner, getInitialRarities())
    factoryContract = await createDummyFactory(deployer)
    collectionsV2Validator = await ERC721CollectionV2Validator.new(
      factoryContract.address
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
  })

  describe('Collection Bridge Root', function () {
    describe('create collection bridge root', async function () {
      it('deploy with correct values', async function () {
        const contract = await CollectionsBridgeRoot.new(
          owner,
          MAX_TOKENS_PER_TX,
          rootManager,
          fxRoot.address,
          collectionsV2Validator.address
        )

        await contract.setFxChildTunnel(collectionsBridgeChildContract.address)

        const collectionBridgeRootOwner = await contract.owner()
        const maxTokensPerTx = await contract.maxTokensPerTx()
        const checkpointManager = await contract.checkpointManager()
        const fxRootContract = await contract.fxRoot()
        const collectionValidator = await contract.collectionValidator()
        const childContract = await contract.fxChildTunnel()

        expect(collectionBridgeRootOwner).to.be.equal(owner)
        expect(maxTokensPerTx).to.be.eq.BN(MAX_TOKENS_PER_TX)
        expect(checkpointManager).to.be.equal(rootManager)
        expect(fxRootContract).to.be.equal(fxRoot.address)
        expect(collectionValidator).to.be.equal(collectionsV2Validator.address)
        expect(childContract).to.be.equal(
          collectionsBridgeChildContract.address
        )
      })
    })
    describe('DepositFor', async function () {
      it('should deposit tokens from a valid collections', async function () {
        const tokenId1 = encodeTokenId(0, 1)
        const tokenId2 = encodeTokenId(0, 2)

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

        const tokenURI1 = await collection1.tokenURI(tokenId1)
        const tokenURI2 = await collection1.tokenURI(tokenId2)
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
        expect(logs[0].args.to).to.be.equal(
          collectionsBridgeRootContract.address
        )
        expect(logs[0].args.tokenId).to.eq.BN(tokenId1)

        expect(logs[1].event).to.be.equal('Transfer')
        expect(logs[1].args.from).to.be.equal(user)
        expect(logs[1].args.to).to.be.equal(
          collectionsBridgeRootContract.address
        )
        expect(logs[1].args.tokenId).to.eq.BN(tokenId2)

        expect(logs[2].event).to.be.equal('StateSynced')
        expect(logs[2].args.id).to.eq.BN(1)
        expect(logs[2].args.contractAddress).to.be.equal(fxChild.address)
        expect(logs[2].args.data).to.be.equal(data)

        ownerOfToken1 = await collection1.ownerOf(tokenId1)
        ownerOfToken2 = await collection1.ownerOf(tokenId2)
        expect(ownerOfToken1).to.be.equal(collectionsBridgeRootContract.address)
        expect(ownerOfToken2).to.be.equal(collectionsBridgeRootContract.address)
      })
    })

    describe('Unlock Tokens', async function () {
      it('should unlock tokens', async function () {
        const tokenId1 = encodeTokenId(0, 1)
        const tokenId2 = encodeTokenId(0, 2)
        const tokenURI1 = await collection1.tokenURI(tokenId1)
        const tokenURI2 = await collection1.tokenURI(tokenId2)

        await collectionsBridgeRootContract.depositFor(
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

        let ownerOfToken1 = await collection1.ownerOf(tokenId1)
        let ownerOfToken2 = await collection1.ownerOf(tokenId2)
        expect(ownerOfToken1).to.be.equal(collectionsBridgeRootContract.address)
        expect(ownerOfToken2).to.be.equal(collectionsBridgeRootContract.address)

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

        ownerOfToken1 = await collection1.ownerOf(tokenId1)
        ownerOfToken2 = await collection1.ownerOf(tokenId2)
        expect(ownerOfToken1).to.be.equal(user)
        expect(ownerOfToken2).to.be.equal(user)
      })
    })
  })

  describe('Collection Bridge Child', function () {
    describe('create collection bridge root', async function () {
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
        expect(bridgedCollection).to.be.equal(
          collectionsBridgedContract.address
        )
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

        collectionBridgedBalance =
          await collectionsBridgedContract.totalSupply()
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
    })

    describe('withdrawFor', async function () {
      let tokenURI1
      let tokenURI2
      let bridgedTokenId1
      let bridgedTokenId2

      const tokenId1 = encodeTokenId(0, 1)
      const tokenId2 = encodeTokenId(0, 2)

      beforeEach(async function () {
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

        const res = await collectionsBridgeRootContract.depositFor(
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

        collectionBridgedBalance =
          await collectionsBridgedContract.totalSupply()
        expect(collectionBridgedBalance).to.be.eq.BN(0)
      })
    })
  })
})
