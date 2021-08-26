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

describe('CollectionsBridgeRoot', function () {
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
      expect(childContract).to.be.equal(collectionsBridgeChildContract.address)
    })
  })

  describe('DepositFor', async function () {
    it('should deposit tokens from a valid collections', async function () {
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

      ownerOfToken1 = await collection1.ownerOf(tokenId1)
      ownerOfToken2 = await collection1.ownerOf(tokenId2)
      expect(ownerOfToken1).to.be.equal(collectionsBridgeRootContract.address)
      expect(ownerOfToken2).to.be.equal(collectionsBridgeRootContract.address)
    })

    it('should deposit tokens from a valid collections :: Relayed EIP721', async function () {
      let ownerOfToken1 = await collection1.ownerOf(tokenId1)
      let ownerOfToken2 = await collection1.ownerOf(tokenId2)
      expect(ownerOfToken1).to.be.equal(user)
      expect(ownerOfToken2).to.be.equal(user)

      const functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'address',
              name: '_to',
              type: 'address',
            },
            {
              components: [
                {
                  internalType: 'contract IERC721BridgedCollection',
                  name: 'collection',
                  type: 'address',
                },
                {
                  internalType: 'uint256',
                  name: 'tokenId',
                  type: 'uint256',
                },
                {
                  internalType: 'bytes',
                  name: 'auxData',
                  type: 'bytes',
                },
              ],
              internalType:
                'struct CollectionsBridgeRoot.CollectionTokenParam[]',
              name: '_collectionsTokens',
              type: 'tuple[]',
            },
          ],
          name: 'depositFor',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [
          user,
          [
            [
              collection1.address,
              tokenId1.toString(),
              web3.eth.abi.encodeParameters(
                ['address'],
                [factoryContract1.address]
              ),
            ],
            [
              collection1.address,
              tokenId2.toString(),
              web3.eth.abi.encodeParameters(
                ['address'],
                [factoryContract1.address]
              ),
            ],
          ],
        ]
      )

      const { logs } = await sendMetaTx(
        collectionsBridgeRootContract,
        functionSignature,
        user,
        relayer,
        null,
        'Decentraland Collection Bridge Root',
        '1'
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

      expect(logs.length).to.be.equal(4)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(user)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      expect(logs[1].event).to.be.equal('Transfer')
      expect(logs[1].args.from).to.be.equal(user)
      expect(logs[1].args.to).to.be.equal(collectionsBridgeRootContract.address)
      expect(logs[1].args.tokenId).to.eq.BN(tokenId1)

      expect(logs[2].event).to.be.equal('Transfer')
      expect(logs[2].args.from).to.be.equal(user)
      expect(logs[2].args.to).to.be.equal(collectionsBridgeRootContract.address)
      expect(logs[2].args.tokenId).to.eq.BN(tokenId2)

      expect(logs[3].event).to.be.equal('StateSynced')
      expect(logs[3].args.id).to.eq.BN(web3.utils.toBN(1))
      expect(logs[3].args.contractAddress).to.be.equal(fxChild.address)
      expect(logs[3].args.data).to.be.equal(data)

      ownerOfToken1 = await collection1.ownerOf(tokenId1)
      ownerOfToken2 = await collection1.ownerOf(tokenId2)
      expect(ownerOfToken1).to.be.equal(collectionsBridgeRootContract.address)
      expect(ownerOfToken2).to.be.equal(collectionsBridgeRootContract.address)
    })

    it('should deposit tokens to someone else', async function () {
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

      ownerOfToken1 = await collection1.ownerOf(tokenId1)
      ownerOfToken2 = await collection1.ownerOf(tokenId2)
      expect(ownerOfToken1).to.be.equal(collectionsBridgeRootContract.address)
      expect(ownerOfToken2).to.be.equal(collectionsBridgeRootContract.address)
    })

    it('reverts when trying to deposit more tokens than the maximum allowed', async function () {
      const tokensToDeposit = []
      for (let i = 0; i <= MAX_TOKENS_PER_TX; i++) {
        tokensToDeposit.push([
          collection1.address,
          tokenId1,
          web3.eth.abi.encodeParameters(
            ['address'],
            [factoryContract1.address]
          ),
        ])
      }
      await assertRevert(
        collectionsBridgeRootContract.depositFor(
          user,
          tokensToDeposit,
          fromUser
        ),
        'CBR#depositFor: MAX_TOKENS_PER_TX_EXCEEDED'
      )
    })

    it('reverts when trying to deposit tokens from an invalid collection', async function () {
      await collection3.issueTokens(
        [user, user, anotherUser, anotherUser],
        [0, 3, 0, 1]
      )

      // invalid collection
      await assertRevert(
        collectionsBridgeRootContract.depositFor(
          user,
          [
            [
              collection3.address,
              tokenId1,
              web3.eth.abi.encodeParameters(
                ['address'],
                [factoryContract2.address]
              ),
            ],
            [
              collection1.address,
              tokenId2,
              web3.eth.abi.encodeParameters(
                ['address'],
                [factoryContract2.address]
              ),
            ],
          ],
          fromUser
        ),
        'CBR#depositFor: INVALID_COLLECTION'
      )

      // Invalid tokens
      await assertRevert(
        collectionsBridgeRootContract.depositFor(
          user,
          [
            [
              collection1.address,
              10,
              web3.eth.abi.encodeParameters(
                ['address'],
                [factoryContract2.address]
              ),
            ],
          ],
          fromUser
        ),
        'CBR#depositFor: INVALID_COLLECTION'
      )
    })

    it('reverts when trying to deposit not owned tokens', async function () {
      await assertRevert(
        collectionsBridgeRootContract.depositFor(
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
          ],
          fromHacker
        ),
        'ERC721: transfer of token that is not own'
      )
    })
  })

  describe('Unlock Tokens', async function () {
    beforeEach(async function () {
      await collectionsBridgeRootContract.depositFor(
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
    })

    it('should unlock tokens', async function () {
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

    it('should unlock tokens :: Relayed EIP721', async function () {
      let ownerOfToken1 = await collection1.ownerOf(tokenId1)
      let ownerOfToken2 = await collection1.ownerOf(tokenId2)
      expect(ownerOfToken1).to.be.equal(collectionsBridgeRootContract.address)
      expect(ownerOfToken2).to.be.equal(collectionsBridgeRootContract.address)

      const functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'bytes',
              name: 'inputData',
              type: 'bytes',
            },
          ],
          name: 'receiveMessage',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [
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

      const { logs } = await sendMetaTx(
        collectionsBridgeRootContract,
        functionSignature,
        user,
        relayer,
        null,
        'Decentraland Collection Bridge Root',
        '1'
      )

      expect(logs.length).to.be.equal(3)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(user)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      expect(logs[1].event).to.be.equal('Transfer')
      expect(logs[1].args.from).to.be.equal(
        collectionsBridgeRootContract.address
      )
      expect(logs[1].args.to).to.be.equal(user)
      expect(logs[1].args.tokenId).to.eq.BN(tokenId1)

      expect(logs[2].event).to.be.equal('Transfer')
      expect(logs[2].args.from).to.be.equal(
        collectionsBridgeRootContract.address
      )
      expect(logs[2].args.to).to.be.equal(user)
      expect(logs[2].args.tokenId).to.eq.BN(tokenId2)

      ownerOfToken1 = await collection1.ownerOf(tokenId1)
      ownerOfToken2 = await collection1.ownerOf(tokenId2)
      expect(ownerOfToken1).to.be.equal(user)
      expect(ownerOfToken2).to.be.equal(user)
    })

    it('reverts when trying to unlock tokens not deposited', async function () {
      let ownerOfToken3 = await collection1.ownerOf(tokenId3)
      expect(ownerOfToken3).to.be.equal(anotherUser)

      await assertRevert(
        collectionsBridgeRootContract.receiveMessage(
          web3.eth.abi.encodeParameters(
            ['address', 'tuple(address,uint256,string)[]'],
            [user, [[collection1.address, tokenId3, tokenURI3]]]
          )
        ),
        'ERC721: transfer of token that is not own'
      )
    })
  })
})
