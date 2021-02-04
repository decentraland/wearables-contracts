import assertRevert from './assertRevert'
import {
  EMPTY_HASH,
  ZERO_ADDRESS,
  BASE_URI,
  MAX_UINT256,
  RARITIES,
  COLLECTION_HASH,
  decodeTokenId,
  encodeTokenId,
} from './collectionV2'
import {
  sendMetaTx,
  getDomainSeparator,
  getSignature,
  DEFAULT_DOMAIN,
  DEFAULT_VERSION,
} from './metaTx'

const BN = web3.utils.BN
const expect = require('chai').use(require('bn-chai')(BN)).expect

export function doTest(
  Contract,
  createContract,
  contractName,
  contractSymbol,
  items,
  issueItem,
  afterEach = () => ({}),
  tokenIds = [0, 1, 2]
) {
  describe('Base Collection V2', function () {
    this.timeout(100000)

    let creationParams

    // tokens
    const token1 = tokenIds[0]
    const token2 = tokenIds[1]
    const token3 = tokenIds[2]

    // Accounts
    let accounts
    let deployer
    let user
    let anotherUser
    let hacker
    let holder
    let anotherHolder
    let beneficiary
    let creator
    let minter
    let manager
    let relayer
    let operator
    let approvedForAll
    let fromUser
    let fromHolder
    let fromHacker
    let fromDeployer
    let fromCreator
    let fromManager
    let fromMinter
    let fromApprovedForAll

    // Contracts
    let collectionContract
    let raritiesContractAddress

    // contract variable
    let chainId

    beforeEach(async function () {
      // Create Listing environment
      accounts = await web3.eth.getAccounts()
      deployer = accounts[0]
      user = accounts[1]
      holder = accounts[2]
      anotherHolder = accounts[3]
      anotherUser = accounts[4]
      hacker = accounts[5]
      beneficiary = accounts[6]
      creator = accounts[7]
      minter = accounts[8]
      manager = accounts[9]
      relayer = accounts[10]
      operator = accounts[11]
      approvedForAll = accounts[12]
      fromUser = { from: user }
      fromHolder = { from: holder }
      fromHacker = { from: hacker }
      fromCreator = { from: creator }
      fromManager = { from: manager }
      fromMinter = { from: minter }
      fromApprovedForAll = { from: approvedForAll }

      fromDeployer = { from: deployer }

      creationParams = {
        ...fromDeployer,
        gasPrice: 21e9,
      }

      // Create collection and set up wearables
      collectionContract = await createContract(
        creator,
        true, // shouldComplete
        true, // isApproved
        true,
        creationParams
      )

      raritiesContractAddress = await collectionContract.rarities()

      // Issue some tokens
      await issueItem(collectionContract, holder, 0, fromCreator)
      await issueItem(collectionContract, holder, 0, fromCreator)
      await issueItem(collectionContract, anotherHolder, 1, fromCreator)

      chainId = await web3.eth.net.getId()
    })

    this.afterEach(async () => {
      if (typeof afterEach === 'function') {
        afterEach()
      }
    })

    describe('initialize', function () {
      it('should be initialized with correct values', async function () {
        const contract = await Contract.new()
        await contract.initialize(
          contractName,
          contractSymbol,
          BASE_URI,
          user,
          false,
          true,
          raritiesContractAddress,
          items,
          creationParams
        )

        const baseURI_ = await contract.baseURI()
        const creator_ = await contract.creator()
        const owner_ = await contract.owner()
        const name_ = await contract.name()
        const symbol_ = await contract.symbol()
        const isInitialized_ = await contract.isInitialized()
        const isApproved_ = await contract.isApproved()
        const isCompleted_ = await contract.isCompleted()
        const isEditable_ = await contract.isEditable()
        const collectionHash = await contract.COLLECTION_HASH()
        const rarities = await contract.rarities()

        expect(baseURI_).to.be.equal(BASE_URI)
        expect(creator_).to.be.equal(user)
        expect(owner_).to.be.equal(deployer)
        expect(name_).to.be.equal(contractName)
        expect(symbol_).to.be.equal(contractSymbol)
        expect(isInitialized_).to.be.equal(true)
        expect(isApproved_).to.be.equal(true)
        expect(isCompleted_).to.be.equal(false)
        expect(isEditable_).to.be.equal(true)
        expect(collectionHash).to.be.equal(COLLECTION_HASH)
        expect(raritiesContractAddress).to.be.equal(rarities)

        const itemLength = await contract.itemsCount()

        expect(items.length).to.be.eq.BN(itemLength)

        for (let i = 0; i < items.length; i++) {
          const {
            rarity,
            maxSupply,
            totalSupply,
            price,
            beneficiary,
            metadata,
            contentHash,
          } = await contract.items(i)

          expect(rarity).to.be.eq.BN(items[i][0])
          expect(maxSupply).to.be.eq.BN(RARITIES[rarity].value)
          expect(totalSupply).to.be.eq.BN(0)
          expect(price).to.be.eq.BN(items[i][1])
          expect(beneficiary.toLowerCase()).to.be.equal(
            items[i][2].toLowerCase()
          )
          expect(metadata).to.be.equal(items[i][3])
          expect(contentHash).to.be.equal(EMPTY_HASH)
        }
      })

      it('should be initialized without items', async function () {
        const contract = await Contract.new()
        await contract.initialize(
          contractName,
          contractSymbol,
          BASE_URI,
          user,
          false,
          true,
          raritiesContractAddress,
          [],
          creationParams
        )

        const baseURI_ = await contract.baseURI()
        const creator_ = await contract.creator()
        const owner_ = await contract.owner()
        const name_ = await contract.name()
        const symbol_ = await contract.symbol()
        const isInitialized_ = await contract.isInitialized()
        const isApproved_ = await contract.isApproved()
        const isCompleted_ = await contract.isCompleted()
        const isEditable_ = await contract.isEditable()
        const collectionHash = await contract.COLLECTION_HASH()
        const rarities = await contract.rarities()

        expect(baseURI_).to.be.equal(BASE_URI)
        expect(creator_).to.be.equal(user)
        expect(owner_).to.be.equal(deployer)
        expect(name_).to.be.equal(contractName)
        expect(symbol_).to.be.equal(contractSymbol)
        expect(isInitialized_).to.be.equal(true)
        expect(isApproved_).to.be.equal(true)
        expect(isCompleted_).to.be.equal(false)
        expect(isEditable_).to.be.equal(true)
        expect(collectionHash).to.be.equal(COLLECTION_HASH)
        expect(raritiesContractAddress).to.be.equal(rarities)

        const itemLength = await contract.itemsCount()

        expect(0).to.be.eq.BN(itemLength)
      })

      it('should be initialized and completed', async function () {
        const contract = await Contract.new()
        await contract.initialize(
          contractName,
          contractSymbol,
          BASE_URI,
          user,
          true,
          true,
          raritiesContractAddress,
          [],
          creationParams
        )

        const isCompleted_ = await contract.isCompleted()
        expect(isCompleted_).to.be.equal(true)
      })

      it('should be initialized and not approved', async function () {
        const contract = await Contract.new()
        await contract.initialize(
          contractName,
          contractSymbol,
          BASE_URI,
          user,
          false,
          false,
          raritiesContractAddress,
          [],
          creationParams
        )

        const isApproved_ = await contract.isApproved()
        expect(isApproved_).to.be.equal(false)
      })

      it('reverts when trying to initialize with an invalid creator', async function () {
        const contract = await Contract.new()
        await assertRevert(
          contract.initialize(
            contractName,
            contractSymbol,
            BASE_URI,
            user,
            true,
            true,
            ZERO_ADDRESS,
            [],
            creationParams
          ),
          'initialize: INVALID_RARITIES'
        )
      })

      it('reverts when trying to initialize with an invalid creator', async function () {
        const contract = await Contract.new()
        await assertRevert(
          contract.initialize(
            contractName,
            contractSymbol,
            BASE_URI,
            ZERO_ADDRESS,
            true,
            true,
            raritiesContractAddress,
            [],
            creationParams
          ),
          'initialize: INVALID_CREATOR'
        )
      })

      it('reverts when trying to initialize more than once', async function () {
        const contract = await Contract.new()
        await contract.initialize(
          contractName,
          contractSymbol,
          BASE_URI,
          user,
          true,
          true,
          raritiesContractAddress,
          [],
          creationParams
        )

        await assertRevert(
          contract.initialize(
            contractName,
            contractSymbol,
            BASE_URI,
            user,
            true,
            true,
            raritiesContractAddress,
            [],
            creationParams
          ),
          'initialize: ALREADY_INITIALIZED'
        )
      })
    })

    describe('setApproved', function () {
      let contract
      beforeEach(async () => {
        contract = await Contract.new()
        await contract.initialize(
          contractName,
          contractSymbol,
          BASE_URI,
          creator,
          true,
          true,
          raritiesContractAddress,
          items,
          creationParams
        )
      })

      it('should set isApproved', async function () {
        let isApproved = await contract.isApproved()
        expect(isApproved).to.be.equal(true)

        const { logs } = await contract.setApproved(false, fromDeployer)

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('SetApproved')
        expect(logs[0].args._previousValue).to.be.equal(true)
        expect(logs[0].args._newValue).to.be.equal(false)

        isApproved = await contract.isApproved()
        expect(isApproved).to.be.equal(false)

        await contract.setApproved(true, fromDeployer)

        isApproved = await contract.isApproved()
        expect(isApproved).to.be.equal(true)
      })

      it('should setApproved :: Relayed EIP721', async function () {
        let isApproved = await contract.isApproved()
        expect(isApproved).to.be.equal(true)

        let functionSignature = web3.eth.abi.encodeFunctionCall(
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
        )

        const { logs } = await sendMetaTx(
          contract,
          functionSignature,
          deployer,
          relayer
        )

        expect(logs.length).to.be.equal(2)
        expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
        expect(logs[0].args.userAddress).to.be.equal(deployer)
        expect(logs[0].args.relayerAddress).to.be.equal(relayer)
        expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

        expect(logs[1].event).to.be.equal('SetApproved')
        expect(logs[1].args._previousValue).to.be.equal(true)
        expect(logs[1].args._newValue).to.be.equal(false)

        isApproved = await contract.isApproved()
        expect(isApproved).to.be.equal(false)

        functionSignature = web3.eth.abi.encodeFunctionCall(
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
        )

        await sendMetaTx(contract, functionSignature, deployer, relayer)

        isApproved = await contract.isApproved()
        expect(isApproved).to.be.equal(true)
      })

      it('reverts when trying to approve a collection by not the owner', async function () {
        await contract.setMinters([minter], [true], fromCreator)
        await contract.setManagers([manager], [true], fromCreator)
        await contract.setItemsMinters([0], [minter], [1], fromCreator)
        await contract.setItemsManagers([0], [manager], [true], fromCreator)

        await assertRevert(
          contract.setApproved(false, fromCreator),
          'Ownable: caller is not the owner'
        )

        await assertRevert(
          contract.setApproved(false, fromMinter),
          'Ownable: caller is not the owner'
        )

        await assertRevert(
          contract.setApproved(false, fromManager),
          'Ownable: caller is not the owner'
        )

        await assertRevert(
          contract.setApproved(false, fromHacker),
          'Ownable: caller is not the owner'
        )
      })

      it('reverts when trying to approve a collection by not the owner :: Relayed EIP721', async function () {
        const functionSignature = web3.eth.abi.encodeFunctionCall(
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
        )

        await contract.setMinters([minter], [true], fromCreator)
        await contract.setManagers([manager], [true], fromCreator)
        await contract.setItemsMinters([0], [minter], [1], fromCreator)
        await contract.setItemsManagers([0], [manager], [true], fromCreator)

        await assertRevert(
          sendMetaTx(contract, functionSignature, creator, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(contract, functionSignature, minter, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(contract, functionSignature, manager, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(contract, functionSignature, hacker, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )
      })

      it('reverts when trying to approve with the same value', async function () {
        await assertRevert(
          contract.setApproved(true, fromDeployer),
          'setApproved: VALUE_IS_THE_SAME'
        )
      })
    })

    describe('minters', function () {
      it('should add global minters', async function () {
        let isMinter = await collectionContract.globalMinters(minter)
        expect(isMinter).to.be.equal(false)

        const { logs } = await collectionContract.setMinters(
          [minter],
          [true],
          fromCreator
        )
        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('SetGlobalMinter')
        expect(logs[0].args._minter).to.be.equal(minter)
        expect(logs[0].args._value).to.be.equal(true)

        isMinter = await collectionContract.globalMinters(minter)
        expect(isMinter).to.be.equal(true)

        await collectionContract.setMinters([minter], [false], fromCreator)
        isMinter = await collectionContract.globalMinters(minter)
        expect(isMinter).to.be.equal(false)
      })

      it('should add global minters in batch', async function () {
        let isMinter = await collectionContract.globalMinters(minter)
        expect(isMinter).to.be.equal(false)

        isMinter = await collectionContract.globalMinters(user)
        expect(isMinter).to.be.equal(false)

        let res = await collectionContract.setMinters(
          [minter, user],
          [true, true],
          fromCreator
        )
        let logs = res.logs

        expect(logs.length).to.be.equal(2)
        expect(logs[0].event).to.be.equal('SetGlobalMinter')
        expect(logs[0].args._minter).to.be.equal(minter)
        expect(logs[0].args._value).to.be.equal(true)

        expect(logs[1].event).to.be.equal('SetGlobalMinter')
        expect(logs[1].args._minter).to.be.equal(user)
        expect(logs[1].args._value).to.be.equal(true)

        res = await collectionContract.setMinters(
          [minter, anotherUser, user],
          [false, true, false],
          fromCreator
        )
        logs = res.logs

        expect(logs.length).to.be.equal(3)
        expect(logs[0].event).to.be.equal('SetGlobalMinter')
        expect(logs[0].args._minter).to.be.equal(minter)
        expect(logs[0].args._value).to.be.equal(false)

        expect(logs[1].event).to.be.equal('SetGlobalMinter')
        expect(logs[1].args._minter).to.be.equal(anotherUser)
        expect(logs[1].args._value).to.be.equal(true)

        expect(logs[2].event).to.be.equal('SetGlobalMinter')
        expect(logs[2].args._minter).to.be.equal(user)
        expect(logs[2].args._value).to.be.equal(false)

        isMinter = await collectionContract.globalMinters(minter)
        expect(isMinter).to.be.equal(false)

        isMinter = await collectionContract.globalMinters(user)
        expect(isMinter).to.be.equal(false)

        isMinter = await collectionContract.globalMinters(anotherUser)
        expect(isMinter).to.be.equal(true)
      })

      it('should add items minters', async function () {
        let minterAllowance = await collectionContract.itemMinters(0, minter)
        expect(minterAllowance).to.be.eq.BN(0)

        const { logs } = await collectionContract.setItemsMinters(
          [0],
          [minter],
          [1],
          fromCreator
        )
        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('SetItemMinter')
        expect(logs[0].args._itemId).to.be.eq.BN(0)
        expect(logs[0].args._minter).to.be.equal(minter)
        expect(logs[0].args._value).to.be.eq.BN(1)

        minterAllowance = await collectionContract.itemMinters(0, minter)
        expect(minterAllowance).to.be.eq.BN(1)

        await collectionContract.setItemsMinters(
          [0],
          [minter],
          [0],
          fromCreator
        )
        minterAllowance = await collectionContract.itemMinters(0, minter)
        expect(minterAllowance).to.be.eq.BN(0)
      })

      it('should add items minters in batch', async function () {
        let minterAllowance = await collectionContract.itemMinters(1, minter)
        expect(minterAllowance).to.be.eq.BN(0)

        minterAllowance = await collectionContract.itemMinters(1, user)
        expect(minterAllowance).to.be.eq.BN(0)

        let res = await collectionContract.setItemsMinters(
          [1, 1],
          [minter, user],
          [1, 1],
          fromCreator
        )
        let logs = res.logs

        expect(logs.length).to.be.equal(2)
        expect(logs[0].event).to.be.equal('SetItemMinter')
        expect(logs[0].args._itemId).to.be.eq.BN(1)
        expect(logs[0].args._minter).to.be.equal(minter)
        expect(logs[0].args._value).to.be.eq.BN(1)

        expect(logs[1].event).to.be.equal('SetItemMinter')
        expect(logs[1].args._itemId).to.be.eq.BN(1)
        expect(logs[1].args._minter).to.be.equal(user)
        expect(logs[1].args._value).to.be.eq.BN(1)

        res = await collectionContract.setItemsMinters(
          [1, 1, 1],
          [minter, anotherUser, user],
          [0, 10, 0],
          fromCreator
        )
        logs = res.logs

        expect(logs.length).to.be.equal(3)
        expect(logs[0].event).to.be.equal('SetItemMinter')
        expect(logs[0].args._itemId).to.be.eq.BN(1)
        expect(logs[0].args._minter).to.be.equal(minter)
        expect(logs[0].args._value).to.be.eq.BN(0)

        expect(logs[1].event).to.be.equal('SetItemMinter')
        expect(logs[1].args._itemId).to.be.eq.BN(1)
        expect(logs[1].args._minter).to.be.equal(anotherUser)
        expect(logs[1].args._value).to.be.eq.BN(10)

        expect(logs[2].event).to.be.equal('SetItemMinter')
        expect(logs[2].args._itemId).to.be.eq.BN(1)
        expect(logs[2].args._minter).to.be.equal(user)
        expect(logs[2].args._value).to.be.eq.BN(0)

        minterAllowance = await collectionContract.itemMinters(1, minter)
        expect(minterAllowance).to.be.eq.BN(0)

        minterAllowance = await collectionContract.itemMinters(1, user)
        expect(minterAllowance).to.be.eq.BN(0)

        minterAllowance = await collectionContract.itemMinters(1, anotherUser)
        expect(minterAllowance).to.be.eq.BN(10)
      })

      it('should add global minters :: Relayed EIP721', async function () {
        let isMinter = await collectionContract.globalMinters(minter)
        expect(isMinter).to.be.equal(false)

        let functionSignature = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'address[]',
                name: '_minters',
                type: 'address[]',
              },
              {
                internalType: 'bool[]',
                name: '_values',
                type: 'bool[]',
              },
            ],
            name: 'setMinters',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [[minter], [true]]
        )

        const { logs } = await sendMetaTx(
          collectionContract,
          functionSignature,
          creator,
          relayer
        )

        expect(logs.length).to.be.equal(2)
        expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
        expect(logs[0].args.userAddress).to.be.equal(creator)
        expect(logs[0].args.relayerAddress).to.be.equal(relayer)
        expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

        expect(logs[1].event).to.be.equal('SetGlobalMinter')
        expect(logs[1].args._minter).to.be.equal(minter)
        expect(logs[1].args._value).to.be.equal(true)

        isMinter = await collectionContract.globalMinters(minter)
        expect(isMinter).to.be.equal(true)

        functionSignature = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'address[]',
                name: '_minters',
                type: 'address[]',
              },
              {
                internalType: 'bool[]',
                name: '_values',
                type: 'bool[]',
              },
            ],
            name: 'setMinters',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [[minter], [false]]
        )

        await sendMetaTx(
          collectionContract,
          functionSignature,
          creator,
          relayer
        )

        isMinter = await collectionContract.globalMinters(minter)
        expect(isMinter).to.be.equal(false)
      })

      it('should add items minters :: Relayed EIP721', async function () {
        let minterAllowance = await collectionContract.itemMinters(0, minter)
        expect(minterAllowance).to.be.eq.BN(0)

        let functionSignature = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'uint256[]',
                name: '_itemIds',
                type: 'uint256[]',
              },
              {
                internalType: 'address[]',
                name: '_minters',
                type: 'address[]',
              },
              {
                internalType: 'uint256[]',
                name: '_values',
                type: 'uint256[]',
              },
            ],
            name: 'setItemsMinters',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [[0], [minter], [1]]
        )

        const { logs } = await sendMetaTx(
          collectionContract,
          functionSignature,
          creator,
          relayer
        )

        expect(logs.length).to.be.equal(2)

        expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
        expect(logs[0].args.userAddress).to.be.equal(creator)
        expect(logs[0].args.relayerAddress).to.be.equal(relayer)
        expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

        expect(logs[1].event).to.be.equal('SetItemMinter')
        expect(logs[1].args._itemId).to.be.eq.BN(0)
        expect(logs[1].args._minter).to.be.equal(minter)
        expect(logs[1].args._value).to.be.eq.BN(1)

        minterAllowance = await collectionContract.itemMinters(0, minter)
        expect(minterAllowance).to.be.eq.BN(1)

        functionSignature = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'uint256[]',
                name: '_itemIds',
                type: 'uint256[]',
              },
              {
                internalType: 'address[]',
                name: '_minters',
                type: 'address[]',
              },
              {
                internalType: 'uint256[]',
                name: '_values',
                type: 'uint256[]',
              },
            ],
            name: 'setItemsMinters',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [[0], [minter], [0]]
        )

        await sendMetaTx(
          collectionContract,
          functionSignature,
          creator,
          relayer
        )

        minterAllowance = await collectionContract.itemMinters(0, minter)
        expect(minterAllowance).to.be.eq.BN(0)
      })

      it("reverts when params' length mismatch", async function () {
        await assertRevert(
          collectionContract.setMinters([minter], [true, false], fromCreator),
          'setMinters: LENGTH_MISMATCH'
        )

        await assertRevert(
          collectionContract.setMinters([minter, user], [true], fromCreator),
          'setMinters: LENGTH_MISMATCH'
        )

        await assertRevert(
          collectionContract.setItemsMinters(
            [0, 0],
            [minter],
            [1],
            fromCreator
          ),
          'setItemsMinters: LENGTH_MISMATCH'
        )

        await assertRevert(
          collectionContract.setItemsMinters(
            [0],
            [minter, user],
            [1],
            fromCreator
          ),
          'setItemsMinters: LENGTH_MISMATCH'
        )

        await assertRevert(
          collectionContract.setItemsMinters(
            [0],
            [minter],
            [1, 1],
            fromCreator
          ),
          'setItemsMinters: LENGTH_MISMATCH'
        )
      })

      it('reverts when not the creator trying to set a minter', async function () {
        await collectionContract.setMinters([minter], [true], fromCreator)
        await collectionContract.setManagers([manager], [true], fromCreator)
        await collectionContract.setItemsMinters(
          [0],
          [minter],
          [1],
          fromCreator
        )
        await collectionContract.setItemsManagers(
          [0],
          [manager],
          [1],
          fromCreator
        )

        await assertRevert(
          collectionContract.setMinters([user], [false], fromDeployer),
          'onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          collectionContract.setMinters([user], [false], fromMinter),
          'onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          collectionContract.setMinters([user], [false], fromManager),
          'onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          collectionContract.setMinters([user], [false], fromHacker),
          'onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          collectionContract.setItemsMinters([1], [user], [1], fromDeployer),
          'onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          collectionContract.setItemsMinters([1], [user], [1], fromMinter),
          'onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          collectionContract.setItemsMinters([1], [user], [1], fromManager),
          'onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          collectionContract.setItemsMinters([1], [user], [1], fromHacker),
          'onlyCreator: CALLER_IS_NOT_CREATOR'
        )
      })

      it('reverts when not the creator trying to set a minter :: Relayed EIP721', async function () {
        const functionSignatureGlobal = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'address[]',
                name: '_minters',
                type: 'address[]',
              },
              {
                internalType: 'bool[]',
                name: '_values',
                type: 'bool[]',
              },
            ],
            name: 'setMinters',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [[minter], [false]]
        )

        const functionSignatureItem = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'uint256[]',
                name: '_itemIds',
                type: 'uint256[]',
              },
              {
                internalType: 'address[]',
                name: '_minters',
                type: 'address[]',
              },
              {
                internalType: 'uint256[]',
                name: '_values',
                type: 'uint256[]',
              },
            ],
            name: 'setItemsMinters',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [[0], [minter], [1]]
        )

        await collectionContract.setMinters([minter], [true], fromCreator)
        await collectionContract.setManagers([manager], [true], fromCreator)
        await collectionContract.setItemsMinters(
          [0],
          [minter],
          [1],
          fromCreator
        )
        await collectionContract.setItemsManagers(
          [0],
          [manager],
          [1],
          fromCreator
        )

        await assertRevert(
          sendMetaTx(
            collectionContract,
            functionSignatureGlobal,
            deployer,
            relayer
          ),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(
            collectionContract,
            functionSignatureGlobal,
            minter,
            relayer
          ),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(
            collectionContract,
            functionSignatureGlobal,
            manager,
            relayer
          ),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(
            collectionContract,
            functionSignatureGlobal,
            hacker,
            relayer
          ),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(
            collectionContract,
            functionSignatureItem,
            deployer,
            relayer
          ),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(
            collectionContract,
            functionSignatureItem,
            minter,
            relayer
          ),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(
            collectionContract,
            functionSignatureItem,
            manager,
            relayer
          ),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(
            collectionContract,
            functionSignatureItem,
            hacker,
            relayer
          ),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )
      })

      it('reverts when using an invalid address', async function () {
        await assertRevert(
          collectionContract.setMinters([ZERO_ADDRESS], [true], fromCreator),
          'setMinters: INVALID_MINTER_ADDRESS'
        )

        await assertRevert(
          collectionContract.setItemsMinters(
            [0],
            [ZERO_ADDRESS],
            [1],
            fromCreator
          ),
          'setItemsMinters: INVALID_MINTER_ADDRESS'
        )
      })

      it('reverts when the itemId is invalid', async function () {
        await assertRevert(
          collectionContract.setItemsMinters(
            [items.length],
            [minter],
            [1],
            fromCreator
          ),
          'setItemsMinters: ITEM_DOES_NOT_EXIST'
        )
      })

      it('reverts when the value is the same', async function () {
        await collectionContract.setMinters([minter], [true], fromCreator)
        await collectionContract.setItemsMinters(
          [0],
          [minter],
          [1],
          fromCreator
        )

        await assertRevert(
          collectionContract.setMinters([minter], [true], fromCreator),
          'setMinters: VALUE_IS_THE_SAME'
        )

        await assertRevert(
          collectionContract.setMinters(
            [user, minter],
            [true, true],
            fromCreator
          ),
          'setMinters: VALUE_IS_THE_SAME'
        )

        await assertRevert(
          collectionContract.setItemsMinters([0], [minter], [1], fromCreator),
          'setItemsMinters: VALUE_IS_THE_SAME'
        )

        await assertRevert(
          collectionContract.setItemsMinters(
            [0, 1, 0],
            [user, minter, minter],
            [1, 1, 1],
            fromCreator
          ),
          'setItemsMinters: VALUE_IS_THE_SAME'
        )
      })
    })

    describe('managers', function () {
      it('should add global managers', async function () {
        let isManager = await collectionContract.globalManagers(manager)
        expect(isManager).to.be.equal(false)

        const { logs } = await collectionContract.setManagers(
          [manager],
          [true],
          fromCreator
        )
        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('SetGlobalManager')
        expect(logs[0].args._manager).to.be.equal(manager)
        expect(logs[0].args._value).to.be.equal(true)

        isManager = await collectionContract.globalManagers(manager)
        expect(isManager).to.be.equal(true)

        await collectionContract.setManagers([manager], [false], fromCreator)
        isManager = await collectionContract.globalManagers(manager)
        expect(isManager).to.be.equal(false)
      })

      it('should add global managers in batch', async function () {
        let isManager = await collectionContract.globalManagers(manager)
        expect(isManager).to.be.equal(false)

        isManager = await collectionContract.globalManagers(user)
        expect(isManager).to.be.equal(false)

        let res = await collectionContract.setManagers(
          [manager, user],
          [true, true],
          fromCreator
        )
        let logs = res.logs

        expect(logs.length).to.be.equal(2)
        expect(logs[0].event).to.be.equal('SetGlobalManager')
        expect(logs[0].args._manager).to.be.equal(manager)
        expect(logs[0].args._value).to.be.equal(true)

        expect(logs[1].event).to.be.equal('SetGlobalManager')
        expect(logs[1].args._manager).to.be.equal(user)
        expect(logs[1].args._value).to.be.equal(true)

        res = await collectionContract.setManagers(
          [manager, anotherUser, user],
          [false, true, false],
          fromCreator
        )
        logs = res.logs

        expect(logs.length).to.be.equal(3)
        expect(logs[0].event).to.be.equal('SetGlobalManager')
        expect(logs[0].args._manager).to.be.equal(manager)
        expect(logs[0].args._value).to.be.equal(false)

        expect(logs[1].event).to.be.equal('SetGlobalManager')
        expect(logs[1].args._manager).to.be.equal(anotherUser)
        expect(logs[1].args._value).to.be.equal(true)

        expect(logs[2].event).to.be.equal('SetGlobalManager')
        expect(logs[2].args._manager).to.be.equal(user)
        expect(logs[2].args._value).to.be.equal(false)

        isManager = await collectionContract.globalManagers(manager)
        expect(isManager).to.be.equal(false)

        isManager = await collectionContract.globalManagers(user)
        expect(isManager).to.be.equal(false)

        isManager = await collectionContract.globalManagers(anotherUser)
        expect(isManager).to.be.equal(true)
      })

      it('should add items managers', async function () {
        let isManager = await collectionContract.itemManagers(0, manager)
        expect(isManager).to.be.equal(false)

        const { logs } = await collectionContract.setItemsManagers(
          [0],
          [manager],
          [true],
          fromCreator
        )
        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('SetItemManager')
        expect(logs[0].args._itemId).to.be.eq.BN(0)
        expect(logs[0].args._manager).to.be.equal(manager)
        expect(logs[0].args._value).to.be.equal(true)

        isManager = await collectionContract.itemManagers(0, manager)
        expect(isManager).to.be.equal(true)

        await collectionContract.setItemsManagers(
          [0],
          [manager],
          [false],
          fromCreator
        )
        isManager = await collectionContract.itemManagers(0, manager)
        expect(isManager).to.be.equal(false)
      })

      it('should add items managers in batch', async function () {
        let isManager = await collectionContract.itemManagers(1, manager)
        expect(isManager).to.be.equal(false)

        isManager = await collectionContract.itemManagers(1, user)
        expect(isManager).to.be.equal(false)

        let res = await collectionContract.setItemsManagers(
          [1, 1],
          [manager, user],
          [true, true],
          fromCreator
        )
        let logs = res.logs

        expect(logs.length).to.be.equal(2)
        expect(logs[0].event).to.be.equal('SetItemManager')
        expect(logs[0].args._itemId).to.be.eq.BN(1)
        expect(logs[0].args._manager).to.be.equal(manager)
        expect(logs[0].args._value).to.be.equal(true)

        expect(logs[1].event).to.be.equal('SetItemManager')
        expect(logs[1].args._itemId).to.be.eq.BN(1)
        expect(logs[1].args._manager).to.be.equal(user)
        expect(logs[1].args._value).to.be.equal(true)

        res = await collectionContract.setItemsManagers(
          [1, 1, 1],
          [manager, anotherUser, user],
          [false, true, false],
          fromCreator
        )
        logs = res.logs

        expect(logs.length).to.be.equal(3)
        expect(logs[0].event).to.be.equal('SetItemManager')
        expect(logs[0].args._itemId).to.be.eq.BN(1)
        expect(logs[0].args._manager).to.be.equal(manager)
        expect(logs[0].args._value).to.be.equal(false)

        expect(logs[1].event).to.be.equal('SetItemManager')
        expect(logs[1].args._itemId).to.be.eq.BN(1)
        expect(logs[1].args._manager).to.be.equal(anotherUser)
        expect(logs[1].args._value).to.be.equal(true)

        expect(logs[2].event).to.be.equal('SetItemManager')
        expect(logs[2].args._itemId).to.be.eq.BN(1)
        expect(logs[2].args._manager).to.be.equal(user)
        expect(logs[2].args._value).to.be.equal(false)

        isManager = await collectionContract.itemManagers(1, manager)
        expect(isManager).to.be.equal(false)

        isManager = await collectionContract.itemManagers(1, user)
        expect(isManager).to.be.equal(false)

        isManager = await collectionContract.itemManagers(1, anotherUser)
        expect(isManager).to.be.equal(true)
      })

      it('should add global managers :: Relayed EIP721', async function () {
        let isManager = await collectionContract.globalManagers(manager)
        expect(isManager).to.be.equal(false)

        let functionSignature = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'address[]',
                name: '_managers',
                type: 'address[]',
              },
              {
                internalType: 'bool[]',
                name: '_values',
                type: 'bool[]',
              },
            ],
            name: 'setManagers',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [[manager], [true]]
        )

        const { logs } = await sendMetaTx(
          collectionContract,
          functionSignature,
          creator,
          relayer
        )

        expect(logs.length).to.be.equal(2)
        expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
        expect(logs[0].args.userAddress).to.be.equal(creator)
        expect(logs[0].args.relayerAddress).to.be.equal(relayer)
        expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

        expect(logs[1].event).to.be.equal('SetGlobalManager')
        expect(logs[1].args._manager).to.be.equal(manager)
        expect(logs[1].args._value).to.be.equal(true)

        isManager = await collectionContract.globalManagers(manager)
        expect(isManager).to.be.equal(true)

        functionSignature = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'address[]',
                name: '_managers',
                type: 'address[]',
              },
              {
                internalType: 'bool[]',
                name: '_values',
                type: 'bool[]',
              },
            ],
            name: 'setManagers',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [[manager], [false]]
        )

        await sendMetaTx(
          collectionContract,
          functionSignature,
          creator,
          relayer
        )

        isManager = await collectionContract.globalMinters(manager)
        expect(isManager).to.be.equal(false)
      })

      it('should add items managers :: Relayed EIP721', async function () {
        let isManager = await collectionContract.itemManagers(0, manager)
        expect(isManager).to.be.equal(false)

        let functionSignature = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'uint256[]',
                name: '_itemIds',
                type: 'uint256[]',
              },
              {
                internalType: 'address[]',
                name: '_managers',
                type: 'address[]',
              },
              {
                internalType: 'bool[]',
                name: '_values',
                type: 'bool[]',
              },
            ],
            name: 'setItemsManagers',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [[0], [manager], [true]]
        )

        const { logs } = await sendMetaTx(
          collectionContract,
          functionSignature,
          creator,
          relayer
        )

        expect(logs.length).to.be.equal(2)

        expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
        expect(logs[0].args.userAddress).to.be.equal(creator)
        expect(logs[0].args.relayerAddress).to.be.equal(relayer)
        expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

        expect(logs[1].event).to.be.equal('SetItemManager')
        expect(logs[1].args._itemId).to.be.eq.BN(0)
        expect(logs[1].args._manager).to.be.equal(manager)
        expect(logs[1].args._value).to.be.equal(true)

        isManager = await collectionContract.itemManagers(0, manager)
        expect(isManager).to.be.equal(true)

        functionSignature = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'uint256[]',
                name: '_itemIds',
                type: 'uint256[]',
              },
              {
                internalType: 'address[]',
                name: '_managers',
                type: 'address[]',
              },
              {
                internalType: 'bool[]',
                name: '_values',
                type: 'bool[]',
              },
            ],
            name: 'setItemsManagers',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [[0], [manager], [false]]
        )

        await sendMetaTx(
          collectionContract,
          functionSignature,
          creator,
          relayer
        )

        isManager = await collectionContract.itemManagers(0, manager)
        expect(isManager).to.be.equal(false)
      })

      it("reverts when params' length mismatch", async function () {
        await assertRevert(
          collectionContract.setManagers([manager], [true, false], fromCreator),
          'setManagers: LENGTH_MISMATCH'
        )

        await assertRevert(
          collectionContract.setManagers([manager, user], [true], fromCreator),
          'setManagers: LENGTH_MISMATCH'
        )

        await assertRevert(
          collectionContract.setItemsManagers(
            [0, 0],
            [manager],
            [true],
            fromCreator
          ),
          'setItemsManagers: LENGTH_MISMATCH'
        )

        await assertRevert(
          collectionContract.setItemsManagers(
            [0],
            [manager, user],
            [true],
            fromCreator
          ),
          'setItemsManagers: LENGTH_MISMATCH'
        )

        await assertRevert(
          collectionContract.setItemsManagers(
            [0],
            [manager],
            [true, false],
            fromCreator
          ),
          'setItemsManagers: LENGTH_MISMATCH'
        )
      })

      it('reverts when not the creator trying to set a manager', async function () {
        await collectionContract.setMinters([minter], [true], fromCreator)
        await collectionContract.setManagers([manager], [true], fromCreator)
        await collectionContract.setItemsMinters(
          [0],
          [minter],
          [1],
          fromCreator
        )
        await collectionContract.setItemsManagers(
          [0],
          [manager],
          [true],
          fromCreator
        )

        await assertRevert(
          collectionContract.setManagers([user], [false], fromDeployer),
          'onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          collectionContract.setManagers([user], [false], fromManager),
          'onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          collectionContract.setManagers([user], [false], fromMinter),
          'onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          collectionContract.setManagers([user], [false], fromHacker),
          'onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          collectionContract.setItemsManagers(
            [1],
            [user],
            [false],
            fromDeployer
          ),
          'onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          collectionContract.setItemsManagers([1], [user], [false], fromMinter),
          'onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          collectionContract.setItemsManagers(
            [1],
            [user],
            [false],
            fromManager
          ),
          'onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          collectionContract.setItemsManagers([1], [user], [false], fromHacker),
          'onlyCreator: CALLER_IS_NOT_CREATOR'
        )
      })

      it('reverts when not the creator trying to set a manager :: Relayed EIP721', async function () {
        const functionSignatureGlobal = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'address[]',
                name: '_managers',
                type: 'address[]',
              },
              {
                internalType: 'bool[]',
                name: '_values',
                type: 'bool[]',
              },
            ],
            name: 'setManagers',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [[manager], [false]]
        )

        const functionSignatureItem = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'uint256[]',
                name: '_itemIds',
                type: 'uint256[]',
              },
              {
                internalType: 'address[]',
                name: '_managers',
                type: 'address[]',
              },
              {
                internalType: 'bool[]',
                name: '_values',
                type: 'bool[]',
              },
            ],
            name: 'setItemsManagers',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [[0], [manager], [false]]
        )

        await collectionContract.setMinters([minter], [true], fromCreator)
        await collectionContract.setManagers([manager], [true], fromCreator)
        await collectionContract.setItemsMinters(
          [0],
          [minter],
          [1],
          fromCreator
        )
        await collectionContract.setItemsManagers(
          [0],
          [manager],
          [true],
          fromCreator
        )

        await assertRevert(
          sendMetaTx(
            collectionContract,
            functionSignatureGlobal,
            deployer,
            relayer
          ),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(
            collectionContract,
            functionSignatureGlobal,
            minter,
            relayer
          ),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(
            collectionContract,
            functionSignatureGlobal,
            manager,
            relayer
          ),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(
            collectionContract,
            functionSignatureGlobal,
            hacker,
            relayer
          ),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(
            collectionContract,
            functionSignatureItem,
            deployer,
            relayer
          ),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(
            collectionContract,
            functionSignatureItem,
            minter,
            relayer
          ),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(
            collectionContract,
            functionSignatureItem,
            manager,
            relayer
          ),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(
            collectionContract,
            functionSignatureItem,
            hacker,
            relayer
          ),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )
      })

      it('reverts when the using an invalid address', async function () {
        await assertRevert(
          collectionContract.setManagers([ZERO_ADDRESS], [true], fromCreator),
          'setManagers: INVALID_MANAGER_ADDRESS'
        )

        await assertRevert(
          collectionContract.setItemsManagers(
            [0],
            [ZERO_ADDRESS],
            [true],
            fromCreator
          ),
          'setItemsManagers: INVALID_MANAGER_ADDRESS'
        )
      })

      it('reverts when the itemId is invalid', async function () {
        await assertRevert(
          collectionContract.setItemsManagers(
            [items.length],
            [manager],
            [true],
            fromCreator
          ),
          'setItemsManagers: ITEM_DOES_NOT_EXIST'
        )
      })

      it('reverts when the value is the same', async function () {
        await collectionContract.setManagers([manager], [true], fromCreator)
        await collectionContract.setItemsManagers(
          [0],
          [manager],
          [true],
          fromCreator
        )

        await assertRevert(
          collectionContract.setManagers([manager], [true], fromCreator),
          'setManagers: VALUE_IS_THE_SAME'
        )

        await assertRevert(
          collectionContract.setManagers(
            [user, manager],
            [true, true],
            fromCreator
          ),
          'setManagers: VALUE_IS_THE_SAME'
        )

        await assertRevert(
          collectionContract.setItemsManagers(
            [0],
            [manager],
            [true],
            fromCreator
          ),
          'setItemsManagers: VALUE_IS_THE_SAME'
        )

        await assertRevert(
          collectionContract.setItemsManagers(
            [0, 1, 0],
            [user, manager, manager],
            [true, true, true],
            fromCreator
          ),
          'setItemsManagers: VALUE_IS_THE_SAME'
        )
      })
    })

    describe('addItem', function () {
      let contract
      beforeEach(async () => {
        // Create collection and set up wearables
        contract = await createContract(
          creator,
          false,
          true,
          true,
          creationParams
        )
      })

      it('should add an item', async function () {
        const newItem = [
          RARITIES.common.name,
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
        ]

        let itemLength = await contract.itemsCount()
        const { logs } = await contract.addItems([newItem], fromCreator)

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('AddItem')
        expect(logs[0].args._itemId).to.be.eq.BN(itemLength)
        expect(logs[0].args._item).to.be.eql([
          newItem[0],
          RARITIES[newItem[0]].value.toString(),
          '0',
          newItem[1].toString(),
          newItem[2],
          newItem[3],
          EMPTY_HASH,
        ])

        itemLength = await contract.itemsCount()

        const item = await contract.items(itemLength.sub(web3.utils.toBN(1)))
        expect([
          item.rarity,
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          newItem[0],
          RARITIES[newItem[0]].value.toString(),
          '0',
          newItem[1],
          newItem[2],
          newItem[3],
          EMPTY_HASH,
        ])
      })

      it('should add an item :: Relayed EIP721', async function () {
        const newItem = [
          RARITIES.common.name,
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
        ]

        let itemLength = await contract.itemsCount()

        const functionSignature = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'rarity',
                    type: 'string',
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
                ],
                internalType: 'struct BaseCollectionV2.ItemParam[]',
                name: '_items',
                type: 'tuple[]',
              },
            ],
            name: 'addItems',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [[newItem]]
        )

        const { logs } = await sendMetaTx(
          contract,
          functionSignature,
          creator,
          relayer
        )

        expect(logs.length).to.be.equal(2)

        expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
        expect(logs[0].args.userAddress).to.be.equal(creator)
        expect(logs[0].args.relayerAddress).to.be.equal(relayer)
        expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

        expect(logs[1].event).to.be.equal('AddItem')
        expect(logs[1].args._itemId).to.be.eq.BN(itemLength)
        expect(logs[1].args._item).to.be.eql([
          newItem[0],
          RARITIES[newItem[0]].value.toString(),
          '0',
          newItem[1].toString(),
          newItem[2],
          newItem[3],
          EMPTY_HASH,
        ])

        itemLength = await contract.itemsCount()

        const item = await contract.items(itemLength.sub(web3.utils.toBN(1)))
        expect([
          item.rarity.toString(),
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          newItem[0],
          RARITIES[newItem[0]].value.toString(),
          '0',
          newItem[1].toString(),
          newItem[2],
          newItem[3],
          EMPTY_HASH,
        ])
      })

      it('should add items', async function () {
        const newItem1 = [
          RARITIES.common.name,
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
        ]

        const newItem2 = [
          RARITIES.mythic.name,
          web3.utils.toWei('10'),
          beneficiary,
          '1:turtle_mask:hat:female,male',
        ]

        let itemLength = await contract.itemsCount()
        const { logs } = await contract.addItems(
          [newItem1, newItem2],
          fromCreator
        )

        expect(logs.length).to.be.equal(2)
        expect(logs[0].event).to.be.equal('AddItem')
        expect(logs[0].args._itemId).to.be.eq.BN(itemLength)
        expect(logs[0].args._item).to.be.eql([
          newItem1[0],
          RARITIES[newItem1[0]].value.toString(),
          '0',
          newItem1[1].toString(),
          newItem1[2],
          newItem1[3],
          EMPTY_HASH,
        ])

        expect(logs[1].event).to.be.equal('AddItem')
        expect(logs[1].args._itemId).to.be.eq.BN(
          itemLength.add(web3.utils.toBN(1))
        )
        expect(logs[1].args._item).to.be.eql([
          newItem2[0],
          RARITIES[newItem2[0]].value.toString(),
          '0',
          newItem2[1].toString(),
          newItem2[2],
          newItem2[3],
          EMPTY_HASH,
        ])

        itemLength = await contract.itemsCount()

        let item = await contract.items(itemLength.sub(web3.utils.toBN(2)))
        expect([
          item.rarity.toString(),
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          newItem1[0],
          RARITIES[newItem1[0]].value.toString(),
          '0',
          newItem1[1].toString(),
          newItem1[2],
          newItem1[3],
          EMPTY_HASH,
        ])

        item = await contract.items(itemLength.sub(web3.utils.toBN(1)))
        expect([
          item.rarity.toString(),
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          newItem2[0],
          RARITIES[newItem2[0]].value.toString(),
          '0',
          newItem2[1].toString(),
          newItem2[2],
          newItem2[3],
          EMPTY_HASH,
        ])
      })

      it('should add an item with price 0 and no beneficiary', async function () {
        let itemLength = await contract.itemsCount()
        const newItem = [
          RARITIES.common.name,
          '0',
          ZERO_ADDRESS,
          '1:crocodile_mask:hat:female,male',
        ]

        const { logs } = await contract.addItems([newItem], fromCreator)

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('AddItem')
        expect(logs[0].args._itemId).to.be.eq.BN(itemLength)
        expect(logs[0].args._item).to.be.eql([
          newItem[0],
          RARITIES[newItem[0]].value.toString(),
          '0',
          newItem[1].toString(),
          newItem[2],
          newItem[3],
          EMPTY_HASH,
        ])

        itemLength = await contract.itemsCount()

        const item = await contract.items(itemLength.sub(web3.utils.toBN(1)))
        expect([
          item.rarity.toString(),
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          newItem[0],
          RARITIES[newItem[0]].value.toString(),
          '0',
          newItem[1].toString(),
          newItem[2],
          newItem[3],
          EMPTY_HASH,
        ])
      })

      it('reverts when one of the item is invalid', async function () {
        const newItem1 = [
          RARITIES.common.name,
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
        ]

        const newItem2 = [
          'invalid', // invalid rarity
          web3.utils.toWei('10'),
          beneficiary,
          '1:turtle_mask:hat:female,male',
        ]

        await assertRevert(contract.addItems([newItem1, newItem2], fromCreator))
      })

      it('reverts when trying to add an item with invalid rarity', async function () {
        let newItem = [
          'invalid', // Invalid rarity
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
        ]

        await assertRevert(contract.addItems([newItem], fromCreator))
      })

      it('reverts when trying to add an item with price and no beneficiary', async function () {
        const newItem = [
          RARITIES.common.name,
          web3.utils.toWei('10'),
          ZERO_ADDRESS,
          '1:crocodile_mask:hat:female,male',
        ]
        await assertRevert(
          contract.addItems([newItem], fromCreator),
          '_addItem: INVALID_PRICE_AND_BENEFICIARY'
        )
      })

      it('reverts when trying to add an item without price but beneficiary', async function () {
        const newItem = [
          RARITIES.common.name,
          web3.utils.toWei('0'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
        ]
        await assertRevert(
          contract.addItems([newItem], fromCreator),
          '_addItem: INVALID_PRICE_AND_BENEFICIARY'
        )
      })

      it('reverts when trying to add an item without metadata', async function () {
        const newItem = [
          RARITIES.common.name,
          web3.utils.toWei('10'),
          beneficiary,
          '',
        ]
        await assertRevert(
          contract.addItems([newItem], fromCreator),
          '_addItem: EMPTY_METADATA'
        )
      })

      it('reverts when trying to add an item by not the creator', async function () {
        await contract.setMinters([minter], [true], fromCreator)
        await contract.setManagers([manager], [true], fromCreator)
        await contract.setItemsMinters([0], [minter], [1], fromCreator)
        await contract.setItemsManagers([0], [manager], [true], fromCreator)

        const newItem = [
          RARITIES.common.name,
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
        ]

        await assertRevert(
          contract.addItems([newItem], fromDeployer),
          'onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          contract.addItems([newItem], fromMinter),
          'onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          contract.addItems([newItem], fromManager),
          'onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          contract.addItems([newItem], fromHacker),
          'onlyCreator: CALLER_IS_NOT_CREATOR'
        )
      })

      it('reverts when trying to add an item by not the creator :: Relayed EIP721', async function () {
        await contract.setMinters([minter], [true], fromCreator)
        await contract.setManagers([manager], [true], fromCreator)
        await contract.setItemsMinters([0], [minter], [1], fromCreator)
        await contract.setItemsManagers([0], [manager], [true], fromCreator)

        const newItem = [
          RARITIES.common.name,
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
        ]

        const functionSignature = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'rarity',
                    type: 'string',
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
                ],
                internalType: 'struct BaseCollectionV2.ItemParam[]',
                name: '_items',
                type: 'tuple[]',
              },
            ],
            name: 'addItems',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [[newItem]]
        )

        await assertRevert(
          sendMetaTx(contract, functionSignature, deployer, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(contract, functionSignature, minter, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(contract, functionSignature, manager, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(contract, functionSignature, hacker, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )
      })

      it('reverts when trying to add an item to a completed collection', async function () {
        await contract.completeCollection(fromCreator)

        const newItem = [
          RARITIES.common.name,
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
        ]

        await assertRevert(
          contract.addItems([newItem], fromCreator),
          '_addItem: COLLECTION_COMPLETED'
        )
      })
    })

    describe('editItemsData', function () {
      const itemPrice0 = web3.utils.toWei('10')
      const itemPrice1 = web3.utils.toWei('100')
      const metadata0 = 'metadata:0'
      const metadata1 = 'metadata:1'

      let contract
      let itemId0
      let item0
      let itemBeneficiary0
      let itemId1
      let item1
      let itemBeneficiary1

      this.beforeEach(async () => {
        itemBeneficiary0 = beneficiary
        itemBeneficiary1 = beneficiary

        item0 = [RARITIES.common.name, itemPrice0, itemBeneficiary0, metadata0]

        item1 = [RARITIES.common.name, itemPrice1, itemBeneficiary1, metadata1]

        contract = await createContract(
          creator,
          false,
          true,
          true,
          creationParams
        )
        await contract.addItems([item0, item1], fromCreator)

        const itemLength = await contract.itemsCount()
        itemId0 = itemLength.sub(web3.utils.toBN(2))
        itemId1 = itemLength.sub(web3.utils.toBN(1))
      })

      it('should edit an item data', async function () {
        let item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          RARITIES[item0[0]].value.toString(),
          '0',
          item0[1].toString(),
          item0[2],
          item0[3],
          EMPTY_HASH,
        ])

        const newItemPrice0 = web3.utils.toWei('1000')
        const newItemBeneficiary0 = holder
        const newMetadata0 = 'new:metadata:0'
        const { logs } = await contract.editItemsData(
          [itemId0],
          [newItemPrice0],
          [newItemBeneficiary0],
          [newMetadata0],
          fromCreator
        )

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('UpdateItemData')
        expect(logs[0].args._itemId).to.be.eq.BN(itemId0)
        expect(logs[0].args._price).to.be.eq.BN(newItemPrice0)
        expect(logs[0].args._beneficiary).to.be.equal(newItemBeneficiary0)
        expect(logs[0].args._metadata).to.be.equal(newMetadata0)

        item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          RARITIES[item0[0]].value.toString(),
          '0',
          newItemPrice0.toString(),
          newItemBeneficiary0,
          newMetadata0,
          EMPTY_HASH,
        ])
      })

      it('should edit an item data :: Relayed EIP721', async function () {
        let item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          RARITIES[item0[0]].value.toString(),
          '0',
          item0[1].toString(),
          item0[2],
          item0[3],
          EMPTY_HASH,
        ])

        const newItemPrice0 = web3.utils.toWei('1000')
        const newItemBeneficiary0 = holder
        const newMetadata0 = 'new:metadata:0'

        const functionSignature = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'uint256[]',
                name: '_itemIds',
                type: 'uint256[]',
              },
              {
                internalType: 'uint256[]',
                name: '_prices',
                type: 'uint256[]',
              },
              {
                internalType: 'address[]',
                name: '_beneficiaries',
                type: 'address[]',
              },
              {
                internalType: 'string[]',
                name: '_metadatas',
                type: 'string[]',
              },
            ],
            name: 'editItemsData',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [
            [itemId0.toString()],
            [newItemPrice0],
            [newItemBeneficiary0],
            [newMetadata0],
          ]
        )

        const { logs } = await sendMetaTx(
          contract,
          functionSignature,
          creator,
          relayer
        )

        expect(logs.length).to.be.equal(2)

        expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
        expect(logs[0].args.userAddress).to.be.equal(creator)
        expect(logs[0].args.relayerAddress).to.be.equal(relayer)
        expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

        expect(logs[1].event).to.be.equal('UpdateItemData')
        expect(logs[1].args._itemId).to.be.eq.BN(itemId0)
        expect(logs[1].args._price).to.be.eq.BN(newItemPrice0)
        expect(logs[1].args._beneficiary).to.be.equal(newItemBeneficiary0)
        expect(logs[1].args._metadata).to.be.equal(newMetadata0)

        item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          RARITIES[item0[0]].value.toString(),
          '0',
          newItemPrice0.toString(),
          newItemBeneficiary0,
          newMetadata0,
          EMPTY_HASH,
        ])
      })

      it('should edit items data', async function () {
        let item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          RARITIES[item0[0]].value.toString(),
          '0',
          item0[1].toString(),
          item0[2],
          item0[3],
          EMPTY_HASH,
        ])

        item = await contract.items(itemId1)
        expect([
          item.rarity.toString(),
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item1[0],
          RARITIES[item1[0]].value.toString(),
          '0',
          item1[1].toString(),
          item1[2],
          item1[3],
          EMPTY_HASH,
        ])

        const newItemPrice0 = web3.utils.toWei('1000')
        const newItemBeneficiary0 = holder
        const newItemPrice1 = web3.utils.toWei('1')
        const newItemBeneficiary1 = anotherHolder
        const newMetadata0 = 'new:metadata:0'
        const newMetadata1 = 'new:metadata:1'

        const { logs } = await contract.editItemsData(
          [itemId0, itemId1],
          [newItemPrice0, newItemPrice1],
          [newItemBeneficiary0, newItemBeneficiary1],
          [newMetadata0, newMetadata1],
          fromCreator
        )

        expect(logs.length).to.be.equal(2)
        expect(logs[0].event).to.be.equal('UpdateItemData')
        expect(logs[0].args._itemId).to.be.eq.BN(itemId0)
        expect(logs[0].args._price).to.be.eq.BN(newItemPrice0)
        expect(logs[0].args._beneficiary).to.be.equal(newItemBeneficiary0)
        expect(logs[0].args._metadata).to.be.eq.BN(newMetadata0)

        expect(logs[1].event).to.be.equal('UpdateItemData')
        expect(logs[1].args._itemId).to.be.eq.BN(itemId1)
        expect(logs[1].args._price).to.be.eq.BN(newItemPrice1)
        expect(logs[1].args._beneficiary).to.be.equal(newItemBeneficiary1)
        expect(logs[1].args._metadata).to.be.eq.BN(newMetadata1)

        item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          RARITIES[item0[0]].value.toString(),
          '0',
          newItemPrice0.toString(),
          newItemBeneficiary0,
          newMetadata0,
          EMPTY_HASH,
        ])

        item = await contract.items(itemId1)
        expect([
          item.rarity.toString(),
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item1[0],
          RARITIES[item1[0]].value.toString(),
          '0',
          newItemPrice1.toString(),
          newItemBeneficiary1,
          newMetadata1,
          EMPTY_HASH,
        ])
      })

      it('should edit an item without price and beneficiary', async function () {
        let item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          RARITIES[item0[0]].value.toString(),
          '0',
          item0[1].toString(),
          item0[2],
          item0[3],
          EMPTY_HASH,
        ])

        const { logs } = await contract.editItemsData(
          [itemId0],
          [0],
          [ZERO_ADDRESS],
          [item0[3]],
          fromCreator
        )

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('UpdateItemData')
        expect(logs[0].args._itemId).to.be.eq.BN(itemId0)
        expect(logs[0].args._price).to.be.eq.BN(web3.utils.toBN(0))
        expect(logs[0].args._beneficiary).to.be.equal(ZERO_ADDRESS)
        expect(logs[0].args._metadata).to.be.equal(item0[3])

        item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          RARITIES[item0[0]].value.toString(),
          '0',
          '0',
          ZERO_ADDRESS,
          item0[3],
          EMPTY_HASH,
        ])
      })

      it('should edit an item with price and beneficiary', async function () {
        let item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          RARITIES[item0[0]].value.toString(),
          '0',
          item0[1].toString(),
          item0[2],
          item0[3],
          EMPTY_HASH,
        ])

        const newItemPrice0 = web3.utils.toWei('1')
        const newItemBeneficiary0 = anotherHolder
        const { logs } = await contract.editItemsData(
          [itemId0],
          [newItemPrice0],
          [newItemBeneficiary0],
          [item0[3]],
          fromCreator
        )

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('UpdateItemData')
        expect(logs[0].args._itemId).to.be.eq.BN(itemId0)
        expect(logs[0].args._price).to.be.eq.BN(newItemPrice0)
        expect(logs[0].args._beneficiary).to.be.equal(newItemBeneficiary0)
        expect(logs[0].args._metadata).to.be.equal(item0[3])

        item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          RARITIES[item0[0]].value.toString(),
          '0',
          newItemPrice0.toString(),
          newItemBeneficiary0,
          item0[3],
          EMPTY_HASH,
        ])
      })

      it('should allow managers to edit items data', async function () {
        await assertRevert(
          contract.editItemsData(
            [itemId0],
            [itemPrice0],
            [itemBeneficiary0],
            [metadata0],
            fromManager
          ),
          'editItemsData: CALLER_IS_NOT_CREATOR_OR_MANAGER'
        )

        // Set global Manager
        await contract.setManagers([manager], [true], fromCreator)
        await contract.editItemsData(
          [itemId0],
          [itemPrice0],
          [itemBeneficiary0],
          [metadata0],
          fromManager
        )

        await contract.setManagers([manager], [false], fromCreator)
        await assertRevert(
          contract.editItemsData(
            [itemId0],
            [itemPrice0],
            [itemBeneficiary0],
            [metadata0],
            fromManager
          ),
          'editItemsData: CALLER_IS_NOT_CREATOR_OR_MANAGER'
        )

        // Set item Manager
        await contract.setItemsManagers(
          [itemId0],
          [manager],
          [true],
          fromCreator
        )

        await contract.editItemsData(
          [itemId0],
          [itemPrice0],
          [itemBeneficiary0],
          [metadata0],
          fromManager
        )
      })

      it('should allow managers to edit items data :: Relayed EIP721', async function () {
        const functionSignature = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'uint256[]',
                name: '_itemIds',
                type: 'uint256[]',
              },
              {
                internalType: 'uint256[]',
                name: '_prices',
                type: 'uint256[]',
              },
              {
                internalType: 'address[]',
                name: '_beneficiaries',
                type: 'address[]',
              },
              {
                internalType: 'string[]',
                name: '_metadatas',
                type: 'string[]',
              },
            ],
            name: 'editItemsData',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [[itemId0.toString()], [itemPrice0], [itemBeneficiary0], [metadata0]]
        )

        await assertRevert(
          sendMetaTx(contract, functionSignature, manager, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        // Set global Manager
        await contract.setManagers([manager], [true], fromCreator)
        await sendMetaTx(contract, functionSignature, manager, relayer)

        await contract.setManagers([manager], [false], fromCreator)
        await assertRevert(
          sendMetaTx(contract, functionSignature, manager, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        // Set item Manager
        await contract.setItemsManagers(
          [itemId0],
          [manager],
          [true],
          fromCreator
        )

        await sendMetaTx(contract, functionSignature, manager, relayer)
      })

      it('should allow the creator to edit items data', async function () {
        await contract.editItemsData(
          [itemId0],
          [itemPrice0],
          [itemBeneficiary0],
          [metadata0],
          fromCreator
        )
      })

      it('reverts when passing different length parameters', async function () {
        await assertRevert(
          contract.editItemsData(
            [itemId0],
            [itemPrice0, itemPrice1],
            [itemBeneficiary0, itemBeneficiary1],
            [metadata0, metadata1],
            fromCreator
          ),
          'editItemsData: LENGTH_MISMATCH'
        )

        await assertRevert(
          contract.editItemsData(
            [itemId0, itemId1],
            [itemPrice1],
            [itemBeneficiary0, itemBeneficiary1],
            [metadata0, metadata1],
            fromCreator
          ),
          'editItemsData: LENGTH_MISMATCH'
        )

        await assertRevert(
          contract.editItemsData(
            [itemId0, itemId1],
            [itemPrice0, itemPrice1],
            [itemBeneficiary0],
            [metadata0, metadata1],
            fromCreator
          ),
          'editItemsData: LENGTH_MISMATCH'
        )

        await assertRevert(
          contract.editItemsData(
            [itemId0, itemId1],
            [itemPrice0, itemPrice1],
            [itemBeneficiary0, itemBeneficiary1],
            [metadata0],
            fromCreator
          ),
          'editItemsData: LENGTH_MISMATCH'
        )
      })

      it('reverts when trying to edit data by not the creator or manager', async function () {
        await contract.setMinters([minter], [true], fromCreator)
        await contract.setItemsMinters([0], [minter], [1], fromCreator)

        await assertRevert(
          contract.editItemsData(
            [itemId0],
            [itemPrice0],
            [itemBeneficiary0],
            [metadata0],
            fromDeployer
          ),
          'editItemsData: CALLER_IS_NOT_CREATOR_OR_MANAGER'
        )

        await assertRevert(
          contract.editItemsData(
            [itemId0],
            [itemPrice0],
            [itemBeneficiary0],
            [metadata0],
            fromMinter
          ),
          'editItemsData: CALLER_IS_NOT_CREATOR_OR_MANAGER'
        )

        await assertRevert(
          contract.editItemsData(
            [itemId0],
            [itemPrice0],
            [itemBeneficiary0],
            [metadata0],
            fromHacker
          ),
          'editItemsData: CALLER_IS_NOT_CREATOR_OR_MANAGER'
        )
      })

      it('reverts when trying to edit data by not the creator or manager :: Relayed EIP721', async function () {
        const functionSignature = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'uint256[]',
                name: '_itemIds',
                type: 'uint256[]',
              },
              {
                internalType: 'uint256[]',
                name: '_prices',
                type: 'uint256[]',
              },
              {
                internalType: 'address[]',
                name: '_beneficiaries',
                type: 'address[]',
              },
              {
                internalType: 'string[]',
                name: '_metadatas',
                type: 'string[]',
              },
            ],
            name: 'editItemsData',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [[itemId0.toString()], [itemPrice0], [itemBeneficiary0], [metadata0]]
        )

        await contract.setMinters([minter], [true], fromCreator)
        await contract.setItemsMinters([0], [minter], [1], fromCreator)

        await assertRevert(
          sendMetaTx(contract, functionSignature, deployer, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(contract, functionSignature, minter, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(contract, functionSignature, hacker, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )
      })

      it('reverts when trying to edit an invalid item data', async function () {
        const itemLength = await contract.itemsCount()
        await assertRevert(
          contract.editItemsData(
            [itemLength],
            [itemPrice0],
            [itemBeneficiary0],
            [metadata0],
            fromCreator
          ),
          'editItemsData: ITEM_DOES_NOT_EXIST'
        )
      })

      it('reverts when trying to edit an item with price and without beneficiary', async function () {
        await assertRevert(
          contract.editItemsData(
            [itemId0],
            [itemPrice0],
            [ZERO_ADDRESS],
            [metadata0],
            fromCreator
          ),
          'editItemsData: INVALID_PRICE_AND_BENEFICIARY'
        )
      })

      it('reverts when trying to edit an item without price but beneficiary', async function () {
        await assertRevert(
          contract.editItemsData(
            [itemId0],
            [0],
            [itemBeneficiary0],
            [metadata0],
            fromCreator
          ),
          'editItemsData: INVALID_PRICE_AND_BENEFICIARY'
        )
      })

      it('reverts when trying to edit an item without metadata', async function () {
        await assertRevert(
          contract.editItemsData(
            [itemId0],
            [itemPrice0],
            [itemBeneficiary0],
            [''],
            fromCreator
          ),
          'editItemsData: EMPTY_METADATA'
        )
      })
    })

    describe('rescueItems', function () {
      let contract
      let itemId0
      let item0
      let itemId1
      let item1

      this.beforeEach(async () => {
        item0 = [
          RARITIES.common.name,
          web3.utils.toBN(10).toString(),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
        ]

        item1 = [
          RARITIES.common.name,
          web3.utils.toBN(10).toString(),
          beneficiary,
          '1:turtle_mask:hat:female,male',
        ]

        contract = await createContract(
          creator,
          false,
          true,
          true,
          creationParams
        )
        await contract.addItems([item0, item1], fromCreator)

        const itemLength = await contract.itemsCount()

        itemId0 = itemLength.sub(web3.utils.toBN(2))
        itemId1 = itemLength.sub(web3.utils.toBN(1))
      })

      it('should rescue an item', async function () {
        const newContentHash = web3.utils.randomHex(32)
        const newMetadata = '1:crocodile_mask:earrings:female'

        let item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          RARITIES[item0[0]].value.toString(),
          '0',
          item0[1].toString(),
          item0[2],
          item0[3],
          EMPTY_HASH,
        ])

        const { logs } = await contract.rescueItems(
          [itemId0],
          [newContentHash],
          [newMetadata],
          fromDeployer
        )

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('RescueItem')
        expect(logs[0].args._itemId).to.be.eq.BN(itemId0)
        expect(logs[0].args._contentHash).to.be.equal(newContentHash)
        expect(logs[0].args._metadata).to.be.equal(newMetadata)

        item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          RARITIES[item0[0]].value.toString(),
          '0',
          item0[1].toString(),
          item0[2],
          newMetadata,
          newContentHash,
        ])
      })

      it('should rescue items', async function () {
        let item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          RARITIES[item0[0]].value.toString(),
          '0',
          item0[1].toString(),
          item0[2],
          item0[3],
          EMPTY_HASH,
        ])

        item = await contract.items(itemId1)
        expect([
          item.rarity.toString(),
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item1[0],
          RARITIES[item1[0]].value.toString(),
          '0',
          item1[1].toString(),
          item1[2],
          item1[3],
          EMPTY_HASH,
        ])

        const newContentHash0 = web3.utils.randomHex(32)
        const newMetadata0 = '1:crocodile_mask:earrings:female'
        const newContentHash1 = web3.utils.randomHex(32)
        const newMetadata1 = '1:turtle_mask:upper_body:female'

        const { logs } = await contract.rescueItems(
          [itemId0, itemId1],
          [newContentHash0, newContentHash1],
          [newMetadata0, newMetadata1],
          fromDeployer
        )

        expect(logs.length).to.be.equal(2)
        expect(logs[0].event).to.be.equal('RescueItem')
        expect(logs[0].args._itemId).to.be.eq.BN(itemId0)
        expect(logs[0].args._contentHash).to.be.equal(newContentHash0)
        expect(logs[0].args._metadata).to.be.equal(newMetadata0)

        expect(logs[1].event).to.be.equal('RescueItem')
        expect(logs[1].args._itemId).to.be.eq.BN(itemId1)
        expect(logs[1].args._contentHash).to.be.equal(newContentHash1)
        expect(logs[1].args._metadata).to.be.equal(newMetadata1)

        item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          RARITIES[item0[0]].value.toString(),
          '0',
          item0[1].toString(),
          item0[2],
          newMetadata0,
          newContentHash0,
        ])

        item = await contract.items(itemId1)
        expect([
          item.rarity.toString(),
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item1[0],
          RARITIES[item1[0]].value.toString(),
          '0',
          item1[1].toString(),
          item1[2],
          newMetadata1,
          newContentHash1,
        ])
      })

      it('should rescue an item :: Relayed EIP721', async function () {
        const newContentHash = web3.utils.randomHex(32)
        const newMetadata = '1:crocodile_mask:earrings:female'

        let item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          RARITIES[item0[0]].value.toString(),
          '0',
          item0[1].toString(),
          item0[2],
          item0[3],
          EMPTY_HASH,
        ])

        const functionSignature = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'uint256[]',
                name: '_itemIds',
                type: 'uint256[]',
              },
              {
                internalType: 'bytes32[]',
                name: '_contentHashes',
                type: 'bytes32[]',
              },
              {
                internalType: 'string[]',
                name: '_metadatas',
                type: 'string[]',
              },
            ],
            name: 'rescueItems',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [[itemId0.toString()], [newContentHash], [newMetadata]]
        )

        const { logs } = await sendMetaTx(
          contract,
          functionSignature,
          deployer,
          relayer
        )

        expect(logs.length).to.be.equal(2)

        expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
        expect(logs[0].args.userAddress).to.be.equal(deployer)
        expect(logs[0].args.relayerAddress).to.be.equal(relayer)
        expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

        expect(logs[1].event).to.be.equal('RescueItem')
        expect(logs[1].args._itemId).to.be.eq.BN(itemId0)
        expect(logs[1].args._contentHash).to.be.equal(newContentHash)
        expect(logs[1].args._metadata).to.be.equal(newMetadata)

        item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          RARITIES[item0[0]].value.toString(),
          '0',
          item0[1].toString(),
          item0[2],
          newMetadata,
          newContentHash,
        ])
      })

      it('should rescue an item without changings its metadata', async function () {
        let item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          RARITIES[item0[0]].value.toString(),
          '0',
          item0[1].toString(),
          item0[2],
          item0[3],
          EMPTY_HASH,
        ])

        const newContentHash0 = web3.utils.randomHex(32)
        const { logs } = await contract.rescueItems(
          [itemId0],
          [newContentHash0],
          [''],
          fromDeployer
        )

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('RescueItem')
        expect(logs[0].args._itemId).to.be.eq.BN(itemId0)
        expect(logs[0].args._contentHash).to.be.equal(newContentHash0)
        expect(logs[0].args._metadata).to.be.equal(item.metadata)

        item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          RARITIES[item0[0]].value.toString(),
          '0',
          item0[1].toString(),
          item0[2],
          item0[3],
          newContentHash0,
        ])
      })

      it('should rescue an item cleaning its content hash', async function () {
        let item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          RARITIES[item0[0]].value.toString(),
          '0',
          item0[1].toString(),
          item0[2],
          item0[3],
          EMPTY_HASH,
        ])

        const newContentHash0 = web3.utils.randomHex(32)
        await contract.rescueItems(
          [itemId0],
          [newContentHash0],
          [''],
          fromDeployer
        )

        item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          RARITIES[item0[0]].value.toString(),
          '0',
          item0[1].toString(),
          item0[2],
          item0[3],
          newContentHash0,
        ])

        await contract.rescueItems([itemId0], [EMPTY_HASH], [''], fromDeployer)

        item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          RARITIES[item0[0]].value.toString(),
          '0',
          item0[1].toString(),
          item0[2],
          item0[3],
          EMPTY_HASH,
        ])
      })

      it('reverts when passing different length parameters', async function () {
        await assertRevert(
          contract.rescueItems(
            [itemId0],
            [EMPTY_HASH, EMPTY_HASH],
            ['', ''],
            fromDeployer
          ),
          'rescueItems: LENGTH_MISMATCH'
        )

        await assertRevert(
          contract.rescueItems(
            [itemId0, itemId1],
            [EMPTY_HASH],
            ['', ''],
            fromDeployer
          ),
          'rescueItems: LENGTH_MISMATCH'
        )

        await assertRevert(
          contract.rescueItems(
            [itemId0, itemId1],
            [EMPTY_HASH, EMPTY_HASH],
            [''],
            fromDeployer
          ),
          'rescueItems: LENGTH_MISMATCH'
        )
      })

      it('reverts when trying to rescue by not the owner', async function () {
        await contract.setMinters([minter], [true], fromCreator)
        await contract.setManagers([manager], [true], fromCreator)
        await contract.setItemsMinters([0], [minter], [1], fromCreator)
        await contract.setItemsManagers([0], [manager], [true], fromCreator)

        await assertRevert(
          contract.rescueItems([itemId0], [EMPTY_HASH], [''], fromCreator),
          'Ownable: caller is not the owner'
        )

        await assertRevert(
          contract.rescueItems([itemId0], [EMPTY_HASH], [''], fromMinter),
          'Ownable: caller is not the owner'
        )

        await assertRevert(
          contract.rescueItems([itemId0], [EMPTY_HASH], [''], fromManager),
          'Ownable: caller is not the owner'
        )

        await assertRevert(
          contract.rescueItems([itemId0], [EMPTY_HASH], [''], fromHacker),
          'Ownable: caller is not the owner'
        )
      })

      it('reverts when trying to rescue by not the owner :: Relayed EIP721', async function () {
        await contract.setMinters([minter], [true], fromCreator)
        await contract.setManagers([manager], [true], fromCreator)
        await contract.setItemsMinters([0], [minter], [1], fromCreator)
        await contract.setItemsManagers([0], [manager], [true], fromCreator)

        const functionSignature = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'uint256[]',
                name: '_itemIds',
                type: 'uint256[]',
              },
              {
                internalType: 'bytes32[]',
                name: '_contentHashes',
                type: 'bytes32[]',
              },
              {
                internalType: 'string[]',
                name: '_metadatas',
                type: 'string[]',
              },
            ],
            name: 'rescueItems',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [[itemId0.toString()], [EMPTY_HASH], ['']]
        )

        await assertRevert(
          sendMetaTx(contract, functionSignature, creator, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(contract, functionSignature, minter, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(contract, functionSignature, manager, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(contract, functionSignature, hacker, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )
      })

      it('reverts when trying to rescue an invalid item', async function () {
        const itemLength = await contract.itemsCount()
        await assertRevert(
          contract.rescueItems([itemLength], [EMPTY_HASH], [''], fromDeployer),
          'rescueItems: ITEM_DOES_NOT_EXIST'
        )
      })
    })

    describe('issueTokens', function () {
      let contract
      let newItem
      let newItemId
      let anotherNewItem
      let anotherNewItemId

      beforeEach(async () => {
        newItem = [
          RARITIES.mythic.name,
          '1',
          beneficiary,
          '1:crocodile_mask:hat:female,male',
        ]

        anotherNewItem = [
          RARITIES.common.name,
          '1',
          beneficiary,
          '1:turtle_mask:hat:female,male',
        ]

        contract = await createContract(
          creator,
          false,
          true,
          true,
          creationParams
        )
        await contract.addItems([newItem, anotherNewItem], fromCreator)

        await contract.completeCollection(fromCreator)

        newItemId = (await contract.itemsCount()).sub(web3.utils.toBN(2))
        anotherNewItemId = (await contract.itemsCount()).sub(web3.utils.toBN(1))
      })

      it('should issue multiple tokens', async function () {
        let item = await contract.items(newItemId)
        expect(item.rarity).to.be.equal(newItem[0])

        expect(item.totalSupply).to.eq.BN(0)

        item = await contract.items(anotherNewItemId)
        expect(item.rarity).to.eq.BN(anotherNewItem[0])
        expect(item.totalSupply).to.eq.BN(0)

        const currentTotalSupply = await contract.totalSupply()

        const { logs } = await contract.issueTokens(
          [holder, anotherHolder],
          [newItemId, anotherNewItemId],
          fromCreator
        )

        // New Item
        // match issueance
        item = await contract.items(newItemId)
        expect(item.rarity).to.be.equal(newItem[0])

        expect(item.totalSupply).to.eq.BN(1)

        expect(logs.length).to.be.equal(4)

        const newItemTokenId = encodeTokenId(newItemId, 1)
        expect(logs[1].event).to.be.equal('Issue')
        expect(logs[1].args._beneficiary).to.be.equal(holder)
        expect(logs[1].args._tokenId).to.be.eq.BN(newItemTokenId)
        expect(logs[1].args._itemId).to.be.eq.BN(newItemId)
        expect(logs[1].args._issuedId).to.eq.BN(1)

        // match owner
        let owner = await contract.ownerOf(newItemTokenId)
        expect(owner).to.be.equal(holder)

        // match token id
        let uri = await contract.tokenURI(newItemTokenId)
        let uriArr = uri.split('/')
        expect(newItemId).to.be.eq.BN(uri.split('/')[uriArr.length - 2])
        expect(1).to.eq.BN(uri.split('/')[uriArr.length - 1])

        // Another new Item
        // match issued
        item = await contract.items(anotherNewItemId)
        expect(item.rarity).to.eq.BN(anotherNewItem[0])
        expect(item.totalSupply).to.eq.BN(1)

        const anotherNewItemTokenId = encodeTokenId(anotherNewItemId, 1)
        expect(logs[3].event).to.be.equal('Issue')
        expect(logs[3].args._beneficiary).to.be.equal(anotherHolder)
        expect(logs[3].args._tokenId).to.be.eq.BN(anotherNewItemTokenId)
        expect(logs[3].args._itemId).to.be.eq.BN(anotherNewItemId)
        expect(logs[3].args._issuedId).to.eq.BN(1)

        // match owner
        owner = await contract.ownerOf(anotherNewItemTokenId)
        expect(owner).to.be.equal(anotherHolder)

        // match token id
        uri = await contract.tokenURI(anotherNewItemTokenId)
        uriArr = uri.split('/')
        expect(anotherNewItemId).to.be.eq.BN(uri.split('/')[uriArr.length - 2])
        expect(1).to.eq.BN(uri.split('/')[uriArr.length - 1])

        // Match total supply
        const totalSupply = await contract.totalSupply()
        expect(totalSupply).to.eq.BN(currentTotalSupply.add(web3.utils.toBN(2)))
      })

      it('should issue multiple token :: Relayed EIP721', async function () {
        let item = await contract.items(newItemId)
        expect(item.rarity).to.be.equal(newItem[0])

        expect(item.totalSupply).to.eq.BN(0)

        item = await contract.items(anotherNewItemId)
        expect(item.rarity).to.eq.BN(anotherNewItem[0])
        expect(item.totalSupply).to.eq.BN(0)

        const currentTotalSupply = await contract.totalSupply()

        const functionSignature = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'address[]',
                name: '_beneficiaries',
                type: 'address[]',
              },
              {
                internalType: 'uint256[]',
                name: '_itemIds',
                type: 'uint256[]',
              },
            ],
            name: 'issueTokens',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [
            [holder, anotherHolder],
            [newItemId.toString(), anotherNewItemId.toString()],
          ]
        )

        const { logs } = await sendMetaTx(
          contract,
          functionSignature,
          creator,
          relayer
        )

        expect(logs.length).to.be.equal(5)

        expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
        expect(logs[0].args.userAddress).to.be.equal(creator)
        expect(logs[0].args.relayerAddress).to.be.equal(relayer)
        expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

        // New Item
        // match issueance
        item = await contract.items(newItemId)
        expect(item.rarity).to.be.equal(newItem[0])

        expect(item.totalSupply).to.eq.BN(1)

        const newItemTokenId = encodeTokenId(newItemId, 1)
        expect(logs[2].event).to.be.equal('Issue')
        expect(logs[2].args._beneficiary).to.be.equal(holder)
        expect(logs[2].args._tokenId).to.be.eq.BN(newItemTokenId)
        expect(logs[2].args._itemId).to.be.eq.BN(newItemId)
        expect(logs[2].args._issuedId).to.eq.BN(1)

        // match owner
        let owner = await contract.ownerOf(newItemTokenId)
        expect(owner).to.be.equal(holder)

        // match token id
        let uri = await contract.tokenURI(newItemTokenId)
        let uriArr = uri.split('/')
        expect(newItemId).to.be.eq.BN(uri.split('/')[uriArr.length - 2])
        expect(1).to.eq.BN(uri.split('/')[uriArr.length - 1])

        // Another new Item
        // match issued
        item = await contract.items(anotherNewItemId)
        expect(item.rarity).to.eq.BN(anotherNewItem[0])
        expect(item.totalSupply).to.eq.BN(1)

        const anotherNewItemTokenId = encodeTokenId(anotherNewItemId, 1)
        expect(logs[4].event).to.be.equal('Issue')
        expect(logs[4].args._beneficiary).to.be.equal(anotherHolder)
        expect(logs[4].args._tokenId).to.be.eq.BN(anotherNewItemTokenId)
        expect(logs[4].args._itemId).to.be.eq.BN(anotherNewItemId)
        expect(logs[4].args._issuedId).to.eq.BN(1)

        // match owner
        owner = await contract.ownerOf(anotherNewItemTokenId)
        expect(owner).to.be.equal(anotherHolder)

        // match token id
        uri = await contract.tokenURI(anotherNewItemTokenId)
        uriArr = uri.split('/')
        expect(anotherNewItemId).to.be.eq.BN(uri.split('/')[uriArr.length - 2])
        expect(1).to.eq.BN(uri.split('/')[uriArr.length - 1])

        // Match total supply
        const totalSupply = await contract.totalSupply()
        expect(totalSupply).to.eq.BN(currentTotalSupply.add(web3.utils.toBN(2)))
      })

      it('should issue multiple token for the same item id :: gas estimation', async function () {
        const itemsInTheSameTx = 70
        const beneficiaries = []
        const ids = []

        for (let i = 0; i < itemsInTheSameTx; i++) {
          ids.push(anotherNewItemId)
          beneficiaries.push(beneficiary)
        }

        const { receipt } = await contract.issueTokens(
          beneficiaries,
          ids,
          fromCreator
        )

        // match issueance
        const item = await contract.items(anotherNewItemId)
        expect(item.rarity).to.eq.BN(anotherNewItem[0])
        expect(item.totalSupply).to.eq.BN(itemsInTheSameTx)

        // User
        const balance = await contract.balanceOf(beneficiary)
        expect(balance).to.eq.BN(itemsInTheSameTx)

        console.log(`Gas used:: ${receipt.gasUsed}`)
      })

      it('should issue multiple tokens by minter', async function () {
        await assertRevert(
          contract.issueTokens([anotherHolder], [newItemId], fromMinter),
          '_issueToken: CALLER_CAN_NOT_MINT'
        )

        // Set global Minter
        await contract.setMinters([minter], [true], fromCreator)
        await contract.issueTokens([anotherHolder], [newItemId], fromMinter)

        await contract.setMinters([minter], [false], fromCreator)
        await assertRevert(
          contract.issueTokens([anotherHolder], [newItemId], fromMinter),
          '_issueToken: CALLER_CAN_NOT_MINT'
        )

        // Set item Minter
        await contract.setItemsMinters([newItemId], [minter], [1], fromCreator)

        await contract.issueTokens([anotherHolder], [newItemId], fromMinter)
      })

      it('should issue multiple tokens by minter :: Relayed EIP721', async function () {
        const functionSignature = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'address[]',
                name: '_beneficiaries',
                type: 'address[]',
              },
              {
                internalType: 'uint256[]',
                name: '_itemIds',
                type: 'uint256[]',
              },
            ],
            name: 'issueTokens',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [[anotherHolder], [newItemId.toString()]]
        )

        await assertRevert(
          sendMetaTx(contract, functionSignature, minter, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        // Set global Minter
        await contract.setMinters([minter], [true], fromCreator)
        await sendMetaTx(contract, functionSignature, minter, relayer)

        await contract.setMinters([minter], [false], fromCreator)
        await assertRevert(
          sendMetaTx(contract, functionSignature, minter, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        // Set item Minter
        await contract.setItemsMinters([newItemId], [minter], [1], fromCreator)

        await sendMetaTx(contract, functionSignature, minter, relayer)
      })

      it('should issue multiple tokens by minter and reduce the allowance', async function () {
        // Set items Minter
        await contract.setItemsMinters(
          [newItemId, anotherNewItemId],
          [minter, minter],
          [2, 2],
          fromCreator
        )

        let minterAllowance = await contract.itemMinters(newItemId, minter)
        expect(minterAllowance).to.be.eq.BN(2)

        minterAllowance = await contract.itemMinters(anotherNewItemId, minter)
        expect(minterAllowance).to.be.eq.BN(2)

        await contract.issueTokens(
          [anotherHolder, anotherHolder, anotherHolder],
          [newItemId, anotherNewItemId, newItemId],
          fromMinter
        )

        minterAllowance = await contract.itemMinters(newItemId, minter)
        expect(minterAllowance).to.be.eq.BN(0)

        minterAllowance = await contract.itemMinters(anotherNewItemId, minter)
        expect(minterAllowance).to.be.eq.BN(1)
      })

      it('should issue multiple tokens by minter and reduce the allowance :: Relayed EIP721', async function () {
        const functionSignature = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'address[]',
                name: '_beneficiaries',
                type: 'address[]',
              },
              {
                internalType: 'uint256[]',
                name: '_itemIds',
                type: 'uint256[]',
              },
            ],
            name: 'issueTokens',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [
            [anotherHolder, anotherHolder, anotherHolder],
            [
              newItemId.toString(),
              anotherNewItemId.toString(),
              newItemId.toString(),
            ],
          ]
        )

        // Set items Minter
        await contract.setItemsMinters(
          [newItemId, anotherNewItemId],
          [minter, minter],
          [2, 2],
          fromCreator
        )

        let minterAllowance = await contract.itemMinters(newItemId, minter)
        expect(minterAllowance).to.be.eq.BN(2)

        minterAllowance = await contract.itemMinters(anotherNewItemId, minter)
        expect(minterAllowance).to.be.eq.BN(2)

        await sendMetaTx(contract, functionSignature, minter, relayer)

        minterAllowance = await contract.itemMinters(newItemId, minter)
        expect(minterAllowance).to.be.eq.BN(0)

        minterAllowance = await contract.itemMinters(anotherNewItemId, minter)
        expect(minterAllowance).to.be.eq.BN(1)
      })

      it('should issue multiple tokens by minter and not reduce if allowance is infinity', async function () {
        // Set items Minter
        await contract.setItemsMinters(
          [newItemId, anotherNewItemId],
          [minter, minter],
          [MAX_UINT256, MAX_UINT256],
          fromCreator
        )

        let minterAllowance = await contract.itemMinters(newItemId, minter)
        expect(minterAllowance).to.be.eq.BN(MAX_UINT256)

        minterAllowance = await contract.itemMinters(anotherNewItemId, minter)
        expect(minterAllowance).to.be.eq.BN(MAX_UINT256)

        await contract.issueTokens(
          [anotherHolder, anotherHolder, anotherHolder],
          [newItemId, anotherNewItemId, newItemId],
          fromMinter
        )

        minterAllowance = await contract.itemMinters(newItemId, minter)
        expect(minterAllowance).to.be.eq.BN(MAX_UINT256)

        minterAllowance = await contract.itemMinters(anotherNewItemId, minter)
        expect(minterAllowance).to.be.eq.BN(MAX_UINT256)
      })

      it('reverts when issue multiple tokens by minter without allowance', async function () {
        // Set items Minter
        await contract.setItemsMinters(
          [newItemId, anotherNewItemId],
          [minter, minter],
          [2, 2],
          fromCreator
        )

        let minterAllowance = await contract.itemMinters(newItemId, minter)
        expect(minterAllowance).to.be.eq.BN(2)

        minterAllowance = await contract.itemMinters(anotherNewItemId, minter)
        expect(minterAllowance).to.be.eq.BN(2)

        await assertRevert(
          contract.issueTokens(
            [anotherHolder, anotherHolder, anotherHolder, anotherHolder],
            [newItemId, newItemId, anotherNewItemId, newItemId],
            fromMinter
          ),
          '_issueToken: CALLER_CAN_NOT_MINT'
        )
      })

      it('reverts when issuing a token by not allowed user', async function () {
        await contract.setMinters([minter], [true], fromCreator)
        await contract.setManagers([manager], [true], fromCreator)
        await contract.setItemsMinters([0], [minter], [1], fromCreator)
        await contract.setItemsManagers([0], [manager], [true], fromCreator)

        await assertRevert(
          contract.issueTokens(
            [holder, anotherHolder],
            [newItemId, anotherNewItemId],
            fromDeployer
          ),
          '_issueToken: CALLER_CAN_NOT_MINT'
        )

        await assertRevert(
          contract.issueTokens(
            [holder, anotherHolder],
            [newItemId, anotherNewItemId],
            fromManager
          ),
          '_issueToken: CALLER_CAN_NOT_MINT'
        )

        await assertRevert(
          contract.issueTokens(
            [holder, anotherHolder],
            [newItemId, anotherNewItemId],
            fromHacker
          ),
          '_issueToken: CALLER_CAN_NOT_MINT'
        )
      })

      it('reverts when issuing a token by not the creator or minter :: Relayed EIP721 ', async function () {
        await contract.setMinters([minter], [true], fromCreator)
        await contract.setManagers([manager], [true], fromCreator)
        await contract.setItemsMinters([0], [minter], [1], fromCreator)
        await contract.setItemsManagers([0], [manager], [true], fromCreator)

        let functionSignature = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'address[]',
                name: '_beneficiaries',
                type: 'address[]',
              },
              {
                internalType: 'uint256[]',
                name: '_itemIds',
                type: 'uint256[]',
              },
            ],
            name: 'issueTokens',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [
            [holder, anotherHolder],
            [newItemId.toString(), anotherNewItemId.toString()],
          ]
        )

        await assertRevert(
          sendMetaTx(contract, functionSignature, deployer, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(contract, functionSignature, manager, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(contract, functionSignature, hacker, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )
      })

      it('reverts if trying to issue tokens with invalid argument length', async function () {
        await assertRevert(
          contract.issueTokens([user], [newItemId, anotherNewItemId], fromUser),
          'issueTokens: LENGTH_MISMATCH'
        )

        await assertRevert(
          contract.issueTokens(
            [user, anotherUser],
            [anotherNewItemId],
            fromUser
          ),
          'issueTokens: LENGTH_MISMATCH'
        )
      })

      it('reverts when issuing a token to an invalid address', async function () {
        await assertRevert(
          contract.issueTokens(
            [anotherHolder, ZERO_ADDRESS],
            [newItemId, anotherNewItemId],
            fromCreator
          ),
          'ERC721: mint to the zero address'
        )
      })

      it('reverts when trying to issue an invalid item id', async function () {
        const length = await contract.itemsCount()
        await assertRevert(
          contract.issueTokens(
            [holder, anotherHolder],
            [length, newItemId],
            fromCreator
          ),
          '_issueToken: ITEM_DOES_NOT_EXIST'
        )
      })

      it('reverts when trying to issue an exhausted item', async function () {
        const itemsInTheSameTx = RARITIES.mythic.value

        const beneficiaries = []
        const ids = []

        for (let i = 0; i < itemsInTheSameTx + 1; i++) {
          beneficiaries.push(beneficiary)
          ids.push(newItemId)
        }

        await assertRevert(
          contract.issueTokens(beneficiaries, ids, fromCreator),
          '_issueToken: ITEM_EXHAUSTED'
        )

        await contract.issueTokens(
          beneficiaries.slice(1),
          ids.slice(1),
          fromCreator
        )

        await assertRevert(
          contract.issueTokens(
            [holder, anotherHolder],
            [newItemId, anotherNewItemId],
            fromCreator
          ),
          '_issueToken: ITEM_EXHAUSTED'
        )
      })

      it('reverts when trying to issue a token when the the collection is not approved', async function () {
        await contract.setApproved(false, fromDeployer)

        await assertRevert(
          contract.issueTokens(
            [anotherHolder, anotherHolder],
            [newItemId, anotherNewItemId],
            fromCreator
          ),
          'issueTokens: MINT_NOT_ALLOWED'
        )
      })

      it('reverts when trying to issue a token when the the collection is not completed', async function () {
        const newItem = [
          RARITIES.mythic.name,
          '1',
          beneficiary,
          '1:crocodile_mask:hat:female,male',
        ]

        const contract = await createContract(
          creator,
          false,
          true,
          true,
          creationParams
        )
        await contract.addItems([newItem], fromCreator)

        const newItemId = (await contract.itemsCount()).sub(web3.utils.toBN(1))

        await assertRevert(
          contract.issueTokens([anotherHolder], [newItemId], fromCreator),
          'issueTokens: MINT_NOT_ALLOWED'
        )
      })
    })

    describe('tokenURI', function () {
      it('should return the correct token URI', async function () {
        const newItem = [
          RARITIES.common.name,
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
        ]

        const contract = await createContract(
          creator,
          false,
          true,
          true,
          creationParams
        )

        await contract.addItems([newItem], fromCreator)

        await contract.completeCollection(fromCreator)

        const itemsLength = await contract.itemsCount()
        const itemId = itemsLength.sub(web3.utils.toBN(1))
        await contract.issueTokens([holder], [itemId], fromCreator)

        // match token id
        let uri = await contract.tokenURI(encodeTokenId(itemId.toString(), 1))
        let uriArr = uri.split('/') // [...]/8/1
        expect(itemId.toString()).to.eq.BN(uri.split('/')[uriArr.length - 2])
        expect('1').to.be.equal(uri.split('/')[uriArr.length - 1])
      })

      it('reverts if the token does not exist', async function () {
        await assertRevert(
          collectionContract.tokenURI(encodeTokenId(0, 100)),
          'tokenURI: INVALID_TOKEN_ID'
        )

        await assertRevert(
          collectionContract.tokenURI(encodeTokenId(100, 1)),
          'tokenURI: INVALID_TOKEN_ID'
        )
      })
    })

    describe('transferBatch', function () {
      it('should transfer in batch', async function () {
        let ownerToken1 = await collectionContract.ownerOf(token1)
        let ownerToken2 = await collectionContract.ownerOf(token2)
        expect(ownerToken1).to.be.equal(holder)
        expect(ownerToken2).to.be.equal(holder)

        const { logs } = await collectionContract.batchTransferFrom(
          holder,
          anotherHolder,
          [token1, token2],
          fromHolder
        )

        // 0.6 Zep contracts emits an approval before each Transfer event for cleaning allowances
        expect(logs.length).to.be.equal(4)
        expect(logs[1].event).to.be.equal('Transfer')
        expect(logs[1].args.from).to.be.equal(holder)
        expect(logs[1].args.to).to.be.equal(anotherHolder)
        expect(logs[1].args.tokenId).to.eq.BN(token1)

        expect(logs[3].event).to.be.equal('Transfer')
        expect(logs[3].args.from).to.be.equal(holder)
        expect(logs[3].args.to).to.be.equal(anotherHolder)
        expect(logs[3].args.tokenId).to.eq.BN(token2)

        ownerToken1 = await collectionContract.ownerOf(token1)
        ownerToken2 = await collectionContract.ownerOf(token2)
        expect(ownerToken1).to.be.equal(anotherHolder)
        expect(ownerToken2).to.be.equal(anotherHolder)
      })

      it('should transfer in batch :: Relayed EIP721', async function () {
        let ownerToken1 = await collectionContract.ownerOf(token1)
        let ownerToken2 = await collectionContract.ownerOf(token2)
        expect(ownerToken1).to.be.equal(holder)
        expect(ownerToken2).to.be.equal(holder)

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
            holder,
            anotherHolder,
            [token1.toString(), token2.toString()],
            EMPTY_HASH,
          ]
        )

        const { logs } = await sendMetaTx(
          collectionContract,
          functionSignature,
          holder,
          relayer
        )

        // 0.6 Zep contracts emits an approval before each Transfer event for cleaning allowances
        expect(logs.length).to.be.equal(5)

        expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
        expect(logs[0].args.userAddress).to.be.equal(holder)
        expect(logs[0].args.relayerAddress).to.be.equal(relayer)
        expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

        expect(logs[2].event).to.be.equal('Transfer')
        expect(logs[2].args.from).to.be.equal(holder)
        expect(logs[2].args.to).to.be.equal(anotherHolder)
        expect(logs[2].args.tokenId).to.eq.BN(token1)

        expect(logs[4].event).to.be.equal('Transfer')
        expect(logs[4].args.from).to.be.equal(holder)
        expect(logs[4].args.to).to.be.equal(anotherHolder)
        expect(logs[4].args.tokenId).to.eq.BN(token2)

        ownerToken1 = await collectionContract.ownerOf(token1)
        ownerToken2 = await collectionContract.ownerOf(token2)
        expect(ownerToken1).to.be.equal(anotherHolder)
        expect(ownerToken2).to.be.equal(anotherHolder)
      })

      it('should safe transfer in batch', async function () {
        let ownerToken1 = await collectionContract.ownerOf(token1)
        let ownerToken2 = await collectionContract.ownerOf(token2)
        expect(ownerToken1).to.be.equal(holder)
        expect(ownerToken2).to.be.equal(holder)

        const { logs } = await collectionContract.safeBatchTransferFrom(
          holder,
          anotherHolder,
          [token1, token2],
          EMPTY_HASH,
          fromHolder
        )

        // 0.6 Zep contracts emits an approval before each Transfer event for cleaning allowances
        expect(logs.length).to.be.equal(4)
        expect(logs[1].event).to.be.equal('Transfer')
        expect(logs[1].args.from).to.be.equal(holder)
        expect(logs[1].args.to).to.be.equal(anotherHolder)
        expect(logs[1].args.tokenId).to.eq.BN(token1)

        expect(logs[3].event).to.be.equal('Transfer')
        expect(logs[3].args.from).to.be.equal(holder)
        expect(logs[3].args.to).to.be.equal(anotherHolder)
        expect(logs[3].args.tokenId).to.eq.BN(token2)

        ownerToken1 = await collectionContract.ownerOf(token1)
        ownerToken2 = await collectionContract.ownerOf(token2)
        expect(ownerToken1).to.be.equal(anotherHolder)
        expect(ownerToken2).to.be.equal(anotherHolder)
      })

      it('should safe transfer in batch by operator', async function () {
        let ownerToken1 = await collectionContract.ownerOf(token1)
        let ownerToken2 = await collectionContract.ownerOf(token2)
        expect(ownerToken1).to.be.equal(holder)
        expect(ownerToken2).to.be.equal(holder)

        await collectionContract.approve(hacker, token1, fromHolder)
        await collectionContract.approve(hacker, token2, fromHolder)

        const { logs } = await collectionContract.safeBatchTransferFrom(
          holder,
          anotherHolder,
          [token1, token2],
          EMPTY_HASH,
          fromHacker
        )

        // 0.6 Zep contracts emits an approval before each Transfer event for cleaning allowances
        expect(logs.length).to.be.equal(4)
        expect(logs[1].event).to.be.equal('Transfer')
        expect(logs[1].args.from).to.be.equal(holder)
        expect(logs[1].args.to).to.be.equal(anotherHolder)
        expect(logs[1].args.tokenId).to.eq.BN(token1)

        expect(logs[3].event).to.be.equal('Transfer')
        expect(logs[3].args.from).to.be.equal(holder)
        expect(logs[3].args.to).to.be.equal(anotherHolder)
        expect(logs[3].args.tokenId).to.eq.BN(token2)

        ownerToken1 = await collectionContract.ownerOf(token1)
        ownerToken2 = await collectionContract.ownerOf(token2)
        expect(ownerToken1).to.be.equal(anotherHolder)
        expect(ownerToken2).to.be.equal(anotherHolder)
      })

      it('should safe transfer in batch by operator :: Relayed EIP721', async function () {
        let ownerToken1 = await collectionContract.ownerOf(token1)
        let ownerToken2 = await collectionContract.ownerOf(token2)
        expect(ownerToken1).to.be.equal(holder)
        expect(ownerToken2).to.be.equal(holder)

        await collectionContract.approve(operator, token1, fromHolder)
        await collectionContract.approve(operator, token2, fromHolder)

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
            holder,
            anotherHolder,
            [token1.toString(), token2.toString()],
            EMPTY_HASH,
          ]
        )

        const { logs } = await sendMetaTx(
          collectionContract,
          functionSignature,
          operator,
          relayer
        )

        // 0.6 Zep contracts emits an approval before each Transfer event for cleaning allowances
        expect(logs.length).to.be.equal(5)

        expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
        expect(logs[0].args.userAddress).to.be.equal(operator)
        expect(logs[0].args.relayerAddress).to.be.equal(relayer)
        expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

        expect(logs[2].event).to.be.equal('Transfer')
        expect(logs[2].args.from).to.be.equal(holder)
        expect(logs[2].args.to).to.be.equal(anotherHolder)
        expect(logs[2].args.tokenId).to.eq.BN(token1)

        expect(logs[4].event).to.be.equal('Transfer')
        expect(logs[4].args.from).to.be.equal(holder)
        expect(logs[4].args.to).to.be.equal(anotherHolder)
        expect(logs[4].args.tokenId).to.eq.BN(token2)

        ownerToken1 = await collectionContract.ownerOf(token1)
        ownerToken2 = await collectionContract.ownerOf(token2)
        expect(ownerToken1).to.be.equal(anotherHolder)
        expect(ownerToken2).to.be.equal(anotherHolder)
      })

      it('should safe transfer in batch by approval for all', async function () {
        let ownerToken1 = await collectionContract.ownerOf(token1)
        let ownerToken2 = await collectionContract.ownerOf(token2)
        expect(ownerToken1).to.be.equal(holder)
        expect(ownerToken2).to.be.equal(holder)

        await collectionContract.setApprovalForAll(
          approvedForAll,
          true,
          fromHolder
        )

        const { logs } = await collectionContract.safeBatchTransferFrom(
          holder,
          anotherHolder,
          [token1, token2],
          EMPTY_HASH,
          fromApprovedForAll
        )

        // 0.6 Zep contracts emits an approval before each Transfer event for cleaning allowances
        expect(logs.length).to.be.equal(4)
        expect(logs[1].event).to.be.equal('Transfer')
        expect(logs[1].args.from).to.be.equal(holder)
        expect(logs[1].args.to).to.be.equal(anotherHolder)
        expect(logs[1].args.tokenId).to.eq.BN(token1)

        expect(logs[3].event).to.be.equal('Transfer')
        expect(logs[3].args.from).to.be.equal(holder)
        expect(logs[3].args.to).to.be.equal(anotherHolder)
        expect(logs[3].args.tokenId).to.eq.BN(token2)

        ownerToken1 = await collectionContract.ownerOf(token1)
        ownerToken2 = await collectionContract.ownerOf(token2)
        expect(ownerToken1).to.be.equal(anotherHolder)
        expect(ownerToken2).to.be.equal(anotherHolder)
      })

      it('should safe transfer in batch by approval for all :: Relayed EIP721', async function () {
        let ownerToken1 = await collectionContract.ownerOf(token1)
        let ownerToken2 = await collectionContract.ownerOf(token2)
        expect(ownerToken1).to.be.equal(holder)
        expect(ownerToken2).to.be.equal(holder)

        await collectionContract.setApprovalForAll(
          approvedForAll,
          true,
          fromHolder
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
            holder,
            anotherHolder,
            [token1.toString(), token2.toString()],
            EMPTY_HASH,
          ]
        )

        const { logs } = await sendMetaTx(
          collectionContract,
          functionSignature,
          approvedForAll,
          relayer
        )

        // 0.6 Zep contracts emits an approval before each Transfer event for cleaning allowances
        expect(logs.length).to.be.equal(5)

        expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
        expect(logs[0].args.userAddress).to.be.equal(approvedForAll)
        expect(logs[0].args.relayerAddress).to.be.equal(relayer)
        expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

        expect(logs[2].event).to.be.equal('Transfer')
        expect(logs[2].args.from).to.be.equal(holder)
        expect(logs[2].args.to).to.be.equal(anotherHolder)
        expect(logs[2].args.tokenId).to.eq.BN(token1)

        expect(logs[4].event).to.be.equal('Transfer')
        expect(logs[4].args.from).to.be.equal(holder)
        expect(logs[4].args.to).to.be.equal(anotherHolder)
        expect(logs[4].args.tokenId).to.eq.BN(token2)

        ownerToken1 = await collectionContract.ownerOf(token1)
        ownerToken2 = await collectionContract.ownerOf(token2)
        expect(ownerToken1).to.be.equal(anotherHolder)
        expect(ownerToken2).to.be.equal(anotherHolder)
      })

      it('should tranfer tokens in batch when the collection does not allow minting', async function () {
        await collectionContract.setApproved(false, fromDeployer)

        await assertRevert(
          collectionContract.issueTokens([anotherHolder], [0], fromCreator),
          'issueTokens: MINT_NOT_ALLOWED'
        )

        let ownerToken1 = await collectionContract.ownerOf(token1)
        let ownerToken2 = await collectionContract.ownerOf(token2)
        expect(ownerToken1).to.be.equal(holder)
        expect(ownerToken2).to.be.equal(holder)

        await collectionContract.setApprovalForAll(hacker, true, fromHolder)

        const { logs } = await collectionContract.safeBatchTransferFrom(
          holder,
          anotherHolder,
          [token1, token2],
          EMPTY_HASH,
          fromHacker
        )

        // 0.6 Zep contracts emits an approval before each Transfer event for cleaning allowances
        expect(logs.length).to.be.equal(4)
        expect(logs[1].event).to.be.equal('Transfer')
        expect(logs[1].args.from).to.be.equal(holder)
        expect(logs[1].args.to).to.be.equal(anotherHolder)
        expect(logs[1].args.tokenId).to.eq.BN(token1)

        expect(logs[3].event).to.be.equal('Transfer')
        expect(logs[3].args.from).to.be.equal(holder)
        expect(logs[3].args.to).to.be.equal(anotherHolder)
        expect(logs[3].args.tokenId).to.eq.BN(token2)

        ownerToken1 = await collectionContract.ownerOf(token1)
        ownerToken2 = await collectionContract.ownerOf(token2)
        expect(ownerToken1).to.be.equal(anotherHolder)
        expect(ownerToken2).to.be.equal(anotherHolder)
      })

      it('reverts when transfer in batch by unuthorized user', async function () {
        let ownerToken1 = await collectionContract.ownerOf(token1)
        let ownerToken2 = await collectionContract.ownerOf(token2)
        expect(ownerToken1).to.be.equal(holder)
        expect(ownerToken2).to.be.equal(holder)

        await assertRevert(
          collectionContract.batchTransferFrom(
            holder,
            anotherHolder,
            [token1, token2],
            fromHacker
          ),
          'ERC721: transfer caller is not owner nor approved'
        )

        await assertRevert(
          collectionContract.batchTransferFrom(
            holder,
            anotherHolder,
            [token1, token2, token3],
            fromHolder
          ),
          'ERC721: transfer caller is not owner nor approved'
        )
      })

      it('reverts when transfer in batch by unuthorized user :: Relayed EIP721 ', async function () {
        let ownerToken1 = await collectionContract.ownerOf(token1)
        let ownerToken2 = await collectionContract.ownerOf(token2)
        expect(ownerToken1).to.be.equal(holder)
        expect(ownerToken2).to.be.equal(holder)

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
            holder,
            anotherHolder,
            [token1.toString(), token2.toString()],
            EMPTY_HASH,
          ]
        )

        await assertRevert(
          sendMetaTx(collectionContract, functionSignature, hacker, relayer),
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
            holder,
            anotherHolder,
            [token1.toString(), token2.toString(), token3.toString()],
            '0x',
          ]
        )

        await assertRevert(
          sendMetaTx(collectionContract, functionSignature, holder, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )
      })

      it('reverts when beneficiary is 0 address', async function () {
        await assertRevert(
          collectionContract.batchTransferFrom(
            holder,
            ZERO_ADDRESS,
            [token1, token2],
            fromHolder
          ),
          'ERC721: transfer to the zero address'
        )
      })
    })

    describe('setEditable', function () {
      it('should set editable', async function () {
        let isEditable = await collectionContract.isEditable()
        expect(isEditable).to.be.equal(true)

        const { logs } = await collectionContract.setEditable(
          false,
          fromDeployer
        )

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('SetEditable')
        expect(logs[0].args._previousValue).to.be.equal(true)
        expect(logs[0].args._newValue).to.be.equal(false)

        isEditable = await collectionContract.isEditable()
        expect(isEditable).to.be.equal(false)
      })

      it('should set editable :: Relayed EIP721', async function () {
        let isEditable = await collectionContract.isEditable()
        expect(isEditable).to.be.equal(true)
        const functionSignature = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'bool',
                name: '_value',
                type: 'bool',
              },
            ],
            name: 'setEditable',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [false]
        )

        const { logs } = await sendMetaTx(
          collectionContract,
          functionSignature,
          deployer,
          relayer
        )

        expect(logs.length).to.be.equal(2)

        expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
        expect(logs[0].args.userAddress).to.be.equal(deployer)
        expect(logs[0].args.relayerAddress).to.be.equal(relayer)
        expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

        expect(logs[1].event).to.be.equal('SetEditable')
        expect(logs[1].args._previousValue).to.be.equal(true)
        expect(logs[1].args._newValue).to.be.equal(false)

        isEditable = await collectionContract.isEditable()
        expect(isEditable).to.be.equal(false)
      })

      it('reverts when trying to change values by not the owner', async function () {
        await collectionContract.setMinters([minter], [true], fromCreator)
        await collectionContract.setManagers([manager], [true], fromCreator)
        await collectionContract.setItemsMinters(
          [0],
          [minter],
          [1],
          fromCreator
        )
        await collectionContract.setItemsManagers(
          [0],
          [manager],
          [true],
          fromCreator
        )

        await assertRevert(
          collectionContract.setEditable(false, fromCreator),
          'Ownable: caller is not the owner'
        )

        await assertRevert(
          collectionContract.setEditable(false, fromMinter),
          'Ownable: caller is not the owner'
        )

        await assertRevert(
          collectionContract.setEditable(false, fromManager),
          'Ownable: caller is not the owner'
        )

        await assertRevert(
          collectionContract.setEditable(false, fromHacker),
          'Ownable: caller is not the owner'
        )
      })

      it('reverts when trying to change values by not the owner :: Relayed EIP721', async function () {
        const functionSignature = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'bool',
                name: '_value',
                type: 'bool',
              },
            ],
            name: 'setEditable',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [false]
        )

        await collectionContract.setMinters([minter], [1], fromCreator)
        await collectionContract.setManagers([manager], [true], fromCreator)
        await collectionContract.setItemsMinters(
          [0],
          [minter],
          [1],
          fromCreator
        )
        await collectionContract.setItemsManagers(
          [0],
          [manager],
          [true],
          fromCreator
        )

        await assertRevert(
          sendMetaTx(collectionContract, functionSignature, creator, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(collectionContract, functionSignature, minter, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(collectionContract, functionSignature, manager, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(collectionContract, functionSignature, hacker, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )
      })

      it('reverts when trying to set the same value as before', async function () {
        await assertRevert(
          collectionContract.setEditable(true, fromDeployer),
          'setEditable: VALUE_IS_THE_SAME'
        )
      })
    })

    describe('setBaseURI', function () {
      it('should set Base URI', async function () {
        const newBaseURI = 'https://new-api.io/'

        let baseURI = await collectionContract.baseURI()
        expect(BASE_URI).to.be.equal(baseURI)

        const { logs } = await collectionContract.setBaseURI(
          newBaseURI,
          fromDeployer
        )

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('BaseURI')
        expect(logs[0].args._oldBaseURI).to.be.equal(BASE_URI)
        expect(logs[0].args._newBaseURI).to.be.equal(newBaseURI)

        baseURI = await collectionContract.baseURI()
        expect(newBaseURI).to.be.equal(baseURI)

        const uri = await collectionContract.tokenURI(token1)

        const [itemId, issuedId] = decodeTokenId(token1)

        expect(uri).to.be.equal(
          `${newBaseURI}${collectionContract.address.toLowerCase()}/${itemId.toString()}/${issuedId.toString()}`
        )
      })

      it('should set Base URI :: Relayed EIP721', async function () {
        const newBaseURI = 'https://new-api.io/'

        let baseURI = await collectionContract.baseURI()
        expect(BASE_URI).to.be.equal(baseURI)

        const functionSignature = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'string',
                name: '_baseURI',
                type: 'string',
              },
            ],
            name: 'setBaseURI',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [newBaseURI]
        )

        const { logs } = await sendMetaTx(
          collectionContract,
          functionSignature,
          deployer,
          relayer
        )

        expect(logs.length).to.be.equal(2)

        expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
        expect(logs[0].args.userAddress).to.be.equal(deployer)
        expect(logs[0].args.relayerAddress).to.be.equal(relayer)
        expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

        expect(logs[1].event).to.be.equal('BaseURI')
        expect(logs[1].args._oldBaseURI).to.be.equal(BASE_URI)
        expect(logs[1].args._newBaseURI).to.be.equal(newBaseURI)

        baseURI = await collectionContract.baseURI()
        expect(newBaseURI).to.be.equal(baseURI)

        const uri = await collectionContract.tokenURI(token1)

        const [itemId, issuedId] = decodeTokenId(token1)

        expect(uri).to.be.equal(
          `${newBaseURI}${collectionContract.address.toLowerCase()}/${itemId.toString()}/${issuedId.toString()}`
        )
      })

      it('reverts when trying to change values by hacker', async function () {
        await assertRevert(
          collectionContract.setBaseURI('', fromHacker),
          'Ownable: caller is not the owner'
        )
      })

      it('reverts when trying to change values by not the owner :: Relayed EIP721', async function () {
        await collectionContract.setMinters([minter], [true], fromCreator)
        await collectionContract.setManagers([manager], [true], fromCreator)
        await collectionContract.setItemsMinters(
          [0],
          [minter],
          [1],
          fromCreator
        )
        await collectionContract.setItemsManagers(
          [0],
          [manager],
          [true],
          fromCreator
        )

        const functionSignature = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'string',
                name: '_baseURI',
                type: 'string',
              },
            ],
            name: 'setBaseURI',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          ['']
        )

        await assertRevert(
          sendMetaTx(collectionContract, functionSignature, creator, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(collectionContract, functionSignature, minter, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(collectionContract, functionSignature, manager, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(collectionContract, functionSignature, hacker, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )
      })
    })

    describe('completeCollection', function () {
      let contract
      beforeEach(async () => {
        // Create collection and set up wearables
        contract = await createContract(
          creator,
          false,
          true,
          true,
          creationParams
        )
      })

      it('should complete collection', async function () {
        let isCompleted = await contract.isCompleted()
        expect(isCompleted).to.be.equal(false)

        const { logs } = await contract.completeCollection(fromCreator)

        expect(logs.length).to.equal(1)
        expect(logs[0].event).to.equal('Complete')

        isCompleted = await contract.isCompleted()
        expect(isCompleted).to.be.equal(true)
      })

      it('should complete collection :: Relayed EIP721', async function () {
        let isCompleted = await contract.isCompleted()
        expect(isCompleted).to.be.equal(false)

        const functionSignature = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [],
            name: 'completeCollection',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          []
        )

        const { logs } = await sendMetaTx(
          contract,
          functionSignature,
          creator,
          relayer
        )

        expect(logs.length).to.be.equal(2)

        expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
        expect(logs[0].args.userAddress).to.be.equal(creator)
        expect(logs[0].args.relayerAddress).to.be.equal(relayer)
        expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

        expect(logs[1].event).to.equal('Complete')

        isCompleted = await contract.isCompleted()
        expect(isCompleted).to.be.equal(true)
      })

      it('should issue tokens after complete the collection', async function () {
        await contract.completeCollection(fromCreator)

        await issueItem(contract, holder, 0, fromCreator)
        await issueItem(contract, anotherHolder, 0, fromCreator)
        await issueItem(contract, anotherHolder, 1, fromCreator)
      })

      it('reverts when trying to add an item after the collection is completed', async function () {
        let isCompleted = await contract.isCompleted()
        expect(isCompleted).to.be.equal(false)

        await contract.completeCollection(fromCreator)

        isCompleted = await contract.isCompleted()
        expect(isCompleted).to.be.equal(true)

        const newItem = [
          RARITIES.common.name,
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
        ]

        await assertRevert(
          contract.addItems([newItem], fromCreator),
          '_addItem: COLLECTION_COMPLETED'
        )
      })

      it('reverts when completing collection twice', async function () {
        await contract.completeCollection(fromCreator)

        await assertRevert(
          contract.completeCollection(fromCreator),
          'completeCollection: COLLECTION_ALREADY_COMPLETED'
        )
      })

      it('reverts when completing collection by other than the creator', async function () {
        await assertRevert(
          contract.completeCollection(fromDeployer),
          'onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          contract.completeCollection(fromManager),
          'onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          contract.completeCollection(fromMinter),
          'onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          contract.completeCollection(fromHacker),
          'onlyCreator: CALLER_IS_NOT_CREATOR'
        )
      })

      it('reverts when completing collection by other than the creator :: Relayed EIP721', async function () {
        await contract.setMinters([minter], [true], fromCreator)
        await contract.setManagers([manager], [true], fromCreator)
        await contract.setItemsMinters([0], [minter], [1], fromCreator)
        await contract.setItemsManagers([0], [manager], [true], fromCreator)

        const functionSignature = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [],
            name: 'completeCollection',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          []
        )
        await assertRevert(
          sendMetaTx(contract, functionSignature, deployer, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(contract, functionSignature, minter, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(contract, functionSignature, manager, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(contract, functionSignature, hacker, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )
      })
    })

    describe('transferCreatorship', function () {
      it('should transfer creator role by creator', async function () {
        let creator_ = await collectionContract.creator()
        expect(creator_).to.be.equal(creator)

        const { logs } = await collectionContract.transferCreatorship(
          user,
          fromCreator
        )

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('CreatorshipTransferred')
        expect(logs[0].args._previousCreator).to.be.equal(creator)
        expect(logs[0].args._newCreator).to.be.equal(user)

        creator_ = await collectionContract.creator()
        expect(creator_).to.be.equal(user)
      })

      it('should transfer creator role by creator :: Relayed EIP721', async function () {
        let creator_ = await collectionContract.creator()
        expect(creator_).to.be.equal(creator)

        const functionSignature = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'address',
                name: '_newCreator',
                type: 'address',
              },
            ],
            name: 'transferCreatorship',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [user]
        )

        const { logs } = await sendMetaTx(
          collectionContract,
          functionSignature,
          creator,
          relayer
        )

        expect(logs.length).to.be.equal(2)

        expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
        expect(logs[0].args.userAddress).to.be.equal(creator)
        expect(logs[0].args.relayerAddress).to.be.equal(relayer)
        expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

        expect(logs[1].event).to.be.equal('CreatorshipTransferred')
        expect(logs[1].args._previousCreator).to.be.equal(creator)
        expect(logs[1].args._newCreator).to.be.equal(user)

        creator_ = await collectionContract.creator()
        expect(creator_).to.be.equal(user)
      })

      it('should transfer creator role by owner', async function () {
        let creator_ = await collectionContract.creator()
        expect(creator_).to.be.equal(creator)

        const { logs } = await collectionContract.transferCreatorship(
          user,
          fromDeployer
        )

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('CreatorshipTransferred')
        expect(logs[0].args._previousCreator).to.be.equal(creator)
        expect(logs[0].args._newCreator).to.be.equal(user)

        creator_ = await collectionContract.creator()
        expect(creator_).to.be.equal(user)
      })

      it('should transfer creator role by owner :: Relayed EIP721', async function () {
        let creator_ = await collectionContract.creator()
        expect(creator_).to.be.equal(creator)

        const functionSignature = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'address',
                name: '_newCreator',
                type: 'address',
              },
            ],
            name: 'transferCreatorship',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [user]
        )

        const { logs } = await sendMetaTx(
          collectionContract,
          functionSignature,
          deployer,
          relayer
        )

        expect(logs.length).to.be.equal(2)

        expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
        expect(logs[0].args.userAddress).to.be.equal(deployer)
        expect(logs[0].args.relayerAddress).to.be.equal(relayer)
        expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

        expect(logs[1].event).to.be.equal('CreatorshipTransferred')
        expect(logs[1].args._previousCreator).to.be.equal(creator)
        expect(logs[1].args._newCreator).to.be.equal(user)

        creator_ = await collectionContract.creator()
        expect(creator_).to.be.equal(user)
      })

      it('reverts when trying to transfer creator role by not the owner or creator', async function () {
        await collectionContract.setMinters([minter], [true], fromCreator)
        await collectionContract.setManagers([manager], [true], fromCreator)
        await collectionContract.setItemsMinters(
          [0],
          [minter],
          [1],
          fromCreator
        )
        await collectionContract.setItemsManagers(
          [0],
          [manager],
          [true],
          fromCreator
        )

        await assertRevert(
          collectionContract.transferCreatorship(user, fromMinter),
          'transferCreatorship: CALLER_IS_NOT_OWNER_OR_CREATOR'
        )

        await assertRevert(
          collectionContract.transferCreatorship(user, fromManager),
          'transferCreatorship: CALLER_IS_NOT_OWNER_OR_CREATOR'
        )

        await assertRevert(
          collectionContract.transferCreatorship(user, fromHacker),
          'transferCreatorship: CALLER_IS_NOT_OWNER_OR_CREATOR'
        )
      })

      it('reverts when trying to transfer creator role by not the owner or creator :: Relayed EIP721', async function () {
        await collectionContract.setMinters([minter], [true], fromCreator)
        await collectionContract.setManagers([manager], [true], fromCreator)
        await collectionContract.setItemsMinters(
          [0],
          [minter],
          [1],
          fromCreator
        )
        await collectionContract.setItemsManagers(
          [0],
          [manager],
          [true],
          fromCreator
        )

        const functionSignature = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'address',
                name: '_newCreator',
                type: 'address',
              },
            ],
            name: 'transferCreatorship',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [user]
        )

        await assertRevert(
          sendMetaTx(collectionContract, functionSignature, minter, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(collectionContract, functionSignature, manager, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )

        await assertRevert(
          sendMetaTx(collectionContract, functionSignature, hacker, relayer),
          'NMT#executeMetaTransaction: CALL_FAILED'
        )
      })

      it('reverts when trying to transfer creator role to an invalid address', async function () {
        await assertRevert(
          collectionContract.transferCreatorship(ZERO_ADDRESS, fromDeployer),
          'transferCreatorship: INVALID_CREATOR_ADDRESS'
        )
      })
    })

    describe('encodeTokenId', function () {
      it('should encode a token id', async function () {
        let expectedId = await collectionContract.encodeTokenId(0, 1)
        let decoded = decodeTokenId(expectedId)
        expect(expectedId).to.eq.BN(encodeTokenId(0, 1))
        expect(0).to.eq.BN(decoded[0])
        expect(1).to.eq.BN(decoded[1])

        expectedId = await collectionContract.encodeTokenId(1, 0)
        decoded = decodeTokenId(expectedId)
        expect(expectedId).to.eq.BN(encodeTokenId(1, 0))
        expect(1).to.eq.BN(decoded[0])
        expect(0).to.eq.BN(decoded[1])

        expectedId = await collectionContract.encodeTokenId(
          11232232,
          1123123123
        )
        decoded = decodeTokenId(expectedId)
        expect(expectedId).to.eq.BN(encodeTokenId(11232232, 1123123123))
        expect(11232232).to.eq.BN(decoded[0])
        expect(1123123123).to.eq.BN(decoded[1])

        expectedId = await collectionContract.encodeTokenId(
          4569428193,
          90893249234
        )
        decoded = decodeTokenId(expectedId)
        expect(expectedId).to.eq.BN(encodeTokenId(4569428193, 90893249234))
        expect(4569428193).to.eq.BN(decoded[0])
        expect(90893249234).to.eq.BN(decoded[1])
      })

      it('revert when the first value is greater than 5 bytes', async function () {
        const max = web3.utils.toBN(web3.utils.padLeft('0xff', 10, 'f'))
        const one = web3.utils.toBN(1)

        const expectedId = await collectionContract.encodeTokenId(max, 0)
        expect(expectedId).to.eq.BN(encodeTokenId(max, 0))

        await assertRevert(
          collectionContract.encodeTokenId(max.add(one), 0),
          'encodeTokenId: INVALID_ITEM_ID'
        )
      })

      it('revert when the second value is greater than 27 bytes', async function () {
        const max = web3.utils.toBN(web3.utils.padLeft('0xff', 54, 'f'))
        const one = web3.utils.toBN(1)

        const expectedId = await collectionContract.encodeTokenId(0, max)
        expect(expectedId).to.eq.BN(encodeTokenId(0, max))

        await assertRevert(
          collectionContract.encodeTokenId(0, max.add(one)),
          'encodeTokenId: INVALID_ISSUED_ID'
        )
      })
    })

    describe('decodeTokenId', function () {
      it('should decode a token id', async function () {
        let expectedValues = await collectionContract.decodeTokenId(
          encodeTokenId(0, 1)
        )
        expect(expectedValues[0]).to.eq.BN(0)
        expect(expectedValues[1]).to.eq.BN(1)

        expectedValues = await collectionContract.decodeTokenId(
          encodeTokenId(1, 0)
        )
        expect(expectedValues[0]).to.eq.BN(1)
        expect(expectedValues[1]).to.eq.BN(0)

        expectedValues = await collectionContract.decodeTokenId(
          encodeTokenId(124, 123212)
        )
        expect(expectedValues[0]).to.eq.BN(124)
        expect(expectedValues[1]).to.eq.BN(123212)

        expectedValues = await collectionContract.decodeTokenId(
          encodeTokenId(4569428193, 90893249234)
        )
        expect(expectedValues[0]).to.eq.BN(4569428193)
        expect(expectedValues[1]).to.eq.BN(90893249234)
      })
    })

    describe('MetaTransaction', function () {
      it('should get the chain id', async function () {
        const expectedChainId = await web3.eth.net.getId()
        const contractChainId = await collectionContract.getChainId()
        expect(contractChainId).to.eq.BN(expectedChainId)
      })

      it('should get the domain separator', async function () {
        const expectedDomainSeparator = await getDomainSeparator(
          collectionContract
        )
        const domainSeparator = await collectionContract.domainSeparator()
        expect(expectedDomainSeparator).to.eq.BN(domainSeparator)
      })

      it('should get nonce', async function () {
        let nonce = await collectionContract.getNonce(deployer)
        expect(0).to.eq.BN(nonce)

        const functionSignature = web3.eth.abi.encodeFunctionCall(
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
        )

        await sendMetaTx(
          collectionContract,
          functionSignature,
          deployer,
          relayer
        )

        nonce = await collectionContract.getNonce(deployer)
        expect(1).to.eq.BN(nonce)
      })

      it('should send a tx ', async function () {
        let owner = await collectionContract.ownerOf(token1)
        expect(owner).to.be.equal(holder)

        const functionSignature = web3.eth.abi.encodeFunctionCall(
          {
            inputs: [
              {
                internalType: 'address',
                name: 'from',
                type: 'address',
              },
              {
                internalType: 'address',
                name: 'to',
                type: 'address',
              },
              {
                internalType: 'uint256',
                name: 'tokenId',
                type: 'uint256',
              },
            ],
            name: 'safeTransferFrom',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          [holder, anotherHolder, token1.toString()]
        )

        await sendMetaTx(collectionContract, functionSignature, holder, relayer)

        owner = await collectionContract.ownerOf(token1)
        expect(owner).to.be.equal(anotherHolder)
      })

      it('reverts when signature does not match with signer', async function () {
        const functionSignature = web3.eth.abi.encodeFunctionCall(
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
        )

        await assertRevert(
          sendMetaTx(
            collectionContract,
            functionSignature,
            deployer,
            relayer,
            hacker
          ),
          'NMT#executeMetaTransaction: SIGNER_AND_SIGNATURE_DO_NOT_MATCH'
        )
      })

      it('reverts when trying to replicate a tx', async function () {
        const functionSignature = web3.eth.abi.encodeFunctionCall(
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
        )

        const signature = await getSignature(
          collectionContract,
          functionSignature,
          deployer,
          null,
          DEFAULT_DOMAIN,
          DEFAULT_VERSION
        )

        const r = '0x' + signature.substring(0, 64)
        const s = '0x' + signature.substring(64, 128)
        const v = '0x' + signature.substring(128, 130)

        await collectionContract.executeMetaTransaction(
          deployer,
          functionSignature,
          r,
          s,
          v,
          {
            from: relayer,
          }
        )

        await assertRevert(
          collectionContract.executeMetaTransaction(
            deployer,
            functionSignature,
            r,
            s,
            v,
            {
              from: relayer,
            }
          ),
          'NMT#executeMetaTransaction: SIGNER_AND_SIGNATURE_DO_NOT_MATCH'
        )
      })

      it('reverts when trying to impersonate a tx', async function () {
        const functionSignature = web3.eth.abi.encodeFunctionCall(
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
        )

        const signature = await getSignature(
          collectionContract,
          functionSignature,
          hacker,
          null,
          DEFAULT_DOMAIN,
          DEFAULT_VERSION
        )

        const r = '0x' + signature.substring(0, 64)
        const s = '0x' + signature.substring(64, 128)
        const v = '0x' + signature.substring(128, 130)

        await assertRevert(
          collectionContract.executeMetaTransaction(
            deployer,
            functionSignature,
            r,
            s,
            v,
            {
              from: relayer,
            }
          ),
          'NMT#executeMetaTransaction: SIGNER_AND_SIGNATURE_DO_NOT_MATCH'
        )
      })
    })
  })
}
