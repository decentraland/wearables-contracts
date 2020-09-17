import assertRevert from './assertRevert'
import {
  EMPTY_HASH,
  ZERO_ADDRESS,
  BASE_URI,
  RARITIES,
  decodeTokenId,
  encodeTokenId,
} from './collectionV2'

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
    let fromUser
    let fromHolder
    let fromHacker
    let fromDeployer
    let fromCreator
    let fromManager
    let fromMinter

    // Contracts
    let collectionContract

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
      fromUser = { from: user }
      fromHolder = { from: holder }
      fromHacker = { from: hacker }
      fromCreator = { from: creator }
      fromManager = { from: manager }
      fromMinter = { from: minter }

      fromDeployer = { from: deployer }

      creationParams = {
        ...fromDeployer,
        gas: 6e6,
        gasPrice: 21e9,
      }

      // Create collection and set up wearables
      collectionContract = await createContract(creator, true, creationParams)

      // Approve the collection to mint items
      await collectionContract.approveCollection(fromDeployer)

      // Issue some tokens
      await issueItem(collectionContract, holder, 0, fromCreator)
      await issueItem(collectionContract, holder, 0, fromCreator)
      await issueItem(collectionContract, anotherHolder, 1, fromCreator)
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
          user,
          false,
          BASE_URI,
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

        expect(baseURI_).to.be.equal(BASE_URI)
        expect(creator_).to.be.equal(user)
        expect(owner_).to.be.equal(deployer)
        expect(name_).to.be.equal(contractName)
        expect(symbol_).to.be.equal(contractSymbol)
        expect(isInitialized_).to.be.equal(true)
        expect(isApproved_).to.be.equal(false)
        expect(isCompleted_).to.be.equal(false)
        expect(isEditable_).to.be.equal(true)

        const itemLength = await contract.itemsCount()

        expect(items.length).to.be.eq.BN(itemLength)

        for (let i = 0; i < items.length; i++) {
          const {
            rarity,
            totalSupply,
            price,
            beneficiary,
            metadata,
            contentHash,
          } = await contract.items(i)

          expect(rarity).to.be.eq.BN(items[i][0])
          expect(totalSupply).to.be.eq.BN(items[i][1])
          expect(price).to.be.eq.BN(items[i][2])
          expect(beneficiary.toLowerCase()).to.be.equal(
            items[i][3].toLowerCase()
          )
          expect(metadata).to.be.equal(items[i][4])
          expect(contentHash).to.be.equal(items[i][5])
        }
      })

      it('should be initialized without items', async function () {
        const contract = await Contract.new()
        await contract.initialize(
          contractName,
          contractSymbol,
          user,
          false,
          BASE_URI,
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

        expect(baseURI_).to.be.equal(BASE_URI)
        expect(creator_).to.be.equal(user)
        expect(owner_).to.be.equal(deployer)
        expect(name_).to.be.equal(contractName)
        expect(symbol_).to.be.equal(contractSymbol)
        expect(isInitialized_).to.be.equal(true)
        expect(isApproved_).to.be.equal(false)
        expect(isCompleted_).to.be.equal(false)
        expect(isEditable_).to.be.equal(true)

        const itemLength = await contract.itemsCount()

        expect(0).to.be.eq.BN(itemLength)
      })

      it('should be initialized and completed', async function () {
        const contract = await Contract.new()
        await contract.initialize(
          contractName,
          contractSymbol,
          user,
          true,
          BASE_URI,
          [],
          creationParams
        )

        const isCompleted_ = await contract.isCompleted()
        expect(isCompleted_).to.be.equal(true)
      })

      it('reverts when trying to initialize more than once', async function () {
        const contract = await Contract.new()
        await contract.initialize(
          contractName,
          contractSymbol,
          user,
          true,
          BASE_URI,
          [],
          creationParams
        )

        await assertRevert(
          contract.initialize(
            contractName,
            contractSymbol,
            user,
            true,
            BASE_URI,
            [],
            creationParams
          ),
          'ERC721BaseCollectionV2#whenNotInitialized: ALREADY_INITIALIZED'
        )
      })
    })

    describe('approveCollection', function () {
      let contract
      beforeEach(async () => {
        contract = await Contract.new()
        await contract.initialize(
          contractName,
          contractSymbol,
          creator,
          true,
          BASE_URI,
          items,
          creationParams
        )
      })
      it('should approve a collection', async function () {
        let isApproved = await contract.isApproved()
        expect(isApproved).to.be.equal(false)

        const { logs } = await contract.approveCollection(fromDeployer)

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('Approve')

        isApproved = await contract.isApproved()
        expect(isApproved).to.be.equal(true)
      })

      it('reverts when trying to approve a collection by not the owner', async function () {
        await contract.setMinters([minter], [true], fromCreator)
        await contract.setManagers([manager], [true], fromCreator)
        await contract.setItemsMinters([0], [minter], [true], fromCreator)
        await contract.setItemsManagers([0], [manager], [true], fromCreator)

        await assertRevert(
          contract.approveCollection(fromCreator),
          'Ownable: caller is not the owner'
        )

        await assertRevert(
          contract.approveCollection(fromMinter),
          'Ownable: caller is not the owner'
        )

        await assertRevert(
          contract.approveCollection(fromManager),
          'Ownable: caller is not the owner'
        )

        await assertRevert(
          contract.approveCollection(fromHacker),
          'Ownable: caller is not the owner'
        )
      })

      it('reverts when trying to approve a not completed collection', async function () {
        const notCompletedCollection = await Contract.new()
        await notCompletedCollection.initialize(
          contractName,
          contractSymbol,
          creator,
          false,
          BASE_URI,
          items,
          creationParams
        )

        await assertRevert(
          notCompletedCollection.approveCollection(fromDeployer),
          'ERC721BaseCollectionV2#approveCollection: NOT_COMPLETED'
        )
      })

      it('reverts when trying to approve the collection more than once', async function () {
        await contract.approveCollection(fromDeployer)

        await assertRevert(
          contract.approveCollection(fromDeployer),
          'ERC721BaseCollectionV2#approveCollection: ALREADY_APPROVED'
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
        let isMinter = await collectionContract.itemMinters(0, minter)
        expect(isMinter).to.be.equal(false)

        const { logs } = await collectionContract.setItemsMinters(
          [0],
          [minter],
          [true],
          fromCreator
        )
        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('SetItemMinter')
        expect(logs[0].args._itemId).to.be.eq.BN(0)
        expect(logs[0].args._minter).to.be.equal(minter)
        expect(logs[0].args._value).to.be.equal(true)

        isMinter = await collectionContract.itemMinters(0, minter)
        expect(isMinter).to.be.equal(true)

        await collectionContract.setItemsMinters(
          [0],
          [minter],
          [false],
          fromCreator
        )
        isMinter = await collectionContract.itemMinters(0, minter)
        expect(isMinter).to.be.equal(false)
      })

      it('should add items minters in batch', async function () {
        let isMinter = await collectionContract.itemMinters(1, minter)
        expect(isMinter).to.be.equal(false)

        isMinter = await collectionContract.itemMinters(1, user)
        expect(isMinter).to.be.equal(false)

        let res = await collectionContract.setItemsMinters(
          [1, 1],
          [minter, user],
          [true, true],
          fromCreator
        )
        let logs = res.logs

        expect(logs.length).to.be.equal(2)
        expect(logs[0].event).to.be.equal('SetItemMinter')
        expect(logs[0].args._itemId).to.be.eq.BN(1)
        expect(logs[0].args._minter).to.be.equal(minter)
        expect(logs[0].args._value).to.be.equal(true)

        expect(logs[1].event).to.be.equal('SetItemMinter')
        expect(logs[1].args._itemId).to.be.eq.BN(1)
        expect(logs[1].args._minter).to.be.equal(user)
        expect(logs[1].args._value).to.be.equal(true)

        res = await collectionContract.setItemsMinters(
          [1, 1, 1],
          [minter, anotherUser, user],
          [false, true, false],
          fromCreator
        )
        logs = res.logs

        expect(logs.length).to.be.equal(3)
        expect(logs[0].event).to.be.equal('SetItemMinter')
        expect(logs[0].args._itemId).to.be.eq.BN(1)
        expect(logs[0].args._minter).to.be.equal(minter)
        expect(logs[0].args._value).to.be.equal(false)

        expect(logs[1].event).to.be.equal('SetItemMinter')
        expect(logs[1].args._itemId).to.be.eq.BN(1)
        expect(logs[1].args._minter).to.be.equal(anotherUser)
        expect(logs[1].args._value).to.be.equal(true)

        expect(logs[2].event).to.be.equal('SetItemMinter')
        expect(logs[2].args._itemId).to.be.eq.BN(1)
        expect(logs[2].args._minter).to.be.equal(user)
        expect(logs[2].args._value).to.be.equal(false)

        isMinter = await collectionContract.itemMinters(1, minter)
        expect(isMinter).to.be.equal(false)

        isMinter = await collectionContract.itemMinters(1, user)
        expect(isMinter).to.be.equal(false)

        isMinter = await collectionContract.itemMinters(1, anotherUser)
        expect(isMinter).to.be.equal(true)
      })

      it("reverts when params' length missmath", async function () {
        await assertRevert(
          collectionContract.setMinters([minter], [true, false], fromCreator),
          'ERC721BaseCollectionV2#setMinters: LENGTH_MISMATCH'
        )

        await assertRevert(
          collectionContract.setMinters([minter, user], [true], fromCreator),
          'ERC721BaseCollectionV2#setMinters: LENGTH_MISMATCH'
        )

        await assertRevert(
          collectionContract.setItemsMinters(
            [0, 0],
            [minter],
            [true],
            fromCreator
          ),
          'ERC721BaseCollectionV2#setItemsMinters: LENGTH_MISMATCH'
        )

        await assertRevert(
          collectionContract.setItemsMinters(
            [0],
            [minter, user],
            [true],
            fromCreator
          ),
          'ERC721BaseCollectionV2#setItemsMinters: LENGTH_MISMATCH'
        )

        await assertRevert(
          collectionContract.setItemsMinters(
            [0],
            [minter],
            [true, false],
            fromCreator
          ),
          'ERC721BaseCollectionV2#setItemsMinters: LENGTH_MISMATCH'
        )
      })

      it('reverts when not the creator trying to set a minter', async function () {
        await collectionContract.setMinters([minter], [true], fromCreator)
        await collectionContract.setManagers([manager], [true], fromCreator)
        await collectionContract.setItemsMinters(
          [0],
          [minter],
          [true],
          fromCreator
        )
        await collectionContract.setItemsManagers(
          [0],
          [manager],
          [true],
          fromCreator
        )

        await assertRevert(
          collectionContract.setMinters([user], [false], fromDeployer),
          'ERC721BaseCollectionV2#onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          collectionContract.setMinters([user], [false], fromManager),
          'ERC721BaseCollectionV2#onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          collectionContract.setMinters([user], [false], fromMinter),
          'ERC721BaseCollectionV2#onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          collectionContract.setMinters([user], [false], fromHacker),
          'ERC721BaseCollectionV2#onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          collectionContract.setItemsMinters(
            [1],
            [user],
            [false],
            fromDeployer
          ),
          'ERC721BaseCollectionV2#onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          collectionContract.setItemsMinters([1], [user], [false], fromMinter),
          'ERC721BaseCollectionV2#onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          collectionContract.setItemsMinters([1], [user], [false], fromManager),
          'ERC721BaseCollectionV2#onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          collectionContract.setItemsMinters([1], [user], [false], fromHacker),
          'ERC721BaseCollectionV2#onlyCreator: CALLER_IS_NOT_CREATOR'
        )
      })

      it('reverts when the using an invalid address', async function () {
        await assertRevert(
          collectionContract.setMinters([ZERO_ADDRESS], [true], fromCreator),
          'ERC721BaseCollectionV2#setMinters: INVALID_MINTER_ADDRESS'
        )

        await assertRevert(
          collectionContract.setItemsMinters(
            [0],
            [ZERO_ADDRESS],
            [true],
            fromCreator
          ),
          'ERC721BaseCollectionV2#setItemsMinters: INVALID_MINTER_ADDRESS'
        )
      })

      it('reverts when the itemId is invalid', async function () {
        await assertRevert(
          collectionContract.setItemsMinters(
            [items.length],
            [minter],
            [true],
            fromCreator
          ),
          'ERC721BaseCollectionV2#setItemsMinters: ITEM_DOES_NOT_EXIST'
        )
      })

      it('reverts when the value is the same', async function () {
        await collectionContract.setMinters([minter], [true], fromCreator)
        await collectionContract.setItemsMinters(
          [0],
          [minter],
          [true],
          fromCreator
        )

        await assertRevert(
          collectionContract.setMinters([minter], [true], fromCreator),
          'ERC721BaseCollectionV2#setMinters: VALUE_IS_THE_SAME'
        )

        await assertRevert(
          collectionContract.setMinters(
            [user, minter],
            [true, true],
            fromCreator
          ),
          'ERC721BaseCollectionV2#setMinters: VALUE_IS_THE_SAME'
        )

        await assertRevert(
          collectionContract.setItemsMinters(
            [0],
            [minter],
            [true],
            fromCreator
          ),
          'ERC721BaseCollectionV2#setItemsMinters: VALUE_IS_THE_SAME'
        )

        await assertRevert(
          collectionContract.setItemsMinters(
            [0, 1, 0],
            [user, minter, minter],
            [true, true, true],
            fromCreator
          ),
          'ERC721BaseCollectionV2#setItemsMinters: VALUE_IS_THE_SAME'
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

      it("reverts when params' length missmath", async function () {
        await assertRevert(
          collectionContract.setManagers([manager], [true, false], fromCreator),
          'ERC721BaseCollectionV2#setManagers: LENGTH_MISMATCH'
        )

        await assertRevert(
          collectionContract.setManagers([manager, user], [true], fromCreator),
          'ERC721BaseCollectionV2#setManagers: LENGTH_MISMATCH'
        )

        await assertRevert(
          collectionContract.setItemsManagers(
            [0, 0],
            [manager],
            [true],
            fromCreator
          ),
          'ERC721BaseCollectionV2#setItemsManagers: LENGTH_MISMATCH'
        )

        await assertRevert(
          collectionContract.setItemsManagers(
            [0],
            [manager, user],
            [true],
            fromCreator
          ),
          'ERC721BaseCollectionV2#setItemsManagers: LENGTH_MISMATCH'
        )

        await assertRevert(
          collectionContract.setItemsManagers(
            [0],
            [manager],
            [true, false],
            fromCreator
          ),
          'ERC721BaseCollectionV2#setItemsManagers: LENGTH_MISMATCH'
        )
      })

      it('reverts when not the creator trying to set a manager', async function () {
        await collectionContract.setMinters([minter], [true], fromCreator)
        await collectionContract.setManagers([manager], [true], fromCreator)
        await collectionContract.setItemsMinters(
          [0],
          [minter],
          [true],
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
          'ERC721BaseCollectionV2#onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          collectionContract.setManagers([user], [false], fromManager),
          'ERC721BaseCollectionV2#onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          collectionContract.setManagers([user], [false], fromMinter),
          'ERC721BaseCollectionV2#onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          collectionContract.setManagers([user], [false], fromHacker),
          'ERC721BaseCollectionV2#onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          collectionContract.setItemsManagers(
            [1],
            [user],
            [false],
            fromDeployer
          ),
          'ERC721BaseCollectionV2#onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          collectionContract.setItemsManagers([1], [user], [false], fromMinter),
          'ERC721BaseCollectionV2#onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          collectionContract.setItemsManagers(
            [1],
            [user],
            [false],
            fromManager
          ),
          'ERC721BaseCollectionV2#onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          collectionContract.setItemsManagers([1], [user], [false], fromHacker),
          'ERC721BaseCollectionV2#onlyCreator: CALLER_IS_NOT_CREATOR'
        )
      })

      it('reverts when the using an invalid address', async function () {
        await assertRevert(
          collectionContract.setManagers([ZERO_ADDRESS], [true], fromCreator),
          'ERC721BaseCollectionV2#setManagers: INVALID_MANAGER_ADDRESS'
        )

        await assertRevert(
          collectionContract.setItemsManagers(
            [0],
            [ZERO_ADDRESS],
            [true],
            fromCreator
          ),
          'ERC721BaseCollectionV2#setItemsManagers: INVALID_MANAGER_ADDRESS'
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
          'ERC721BaseCollectionV2#setItemsManagers: ITEM_DOES_NOT_EXIST'
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
          'ERC721BaseCollectionV2#setManagers: VALUE_IS_THE_SAME'
        )

        await assertRevert(
          collectionContract.setManagers(
            [user, manager],
            [true, true],
            fromCreator
          ),
          'ERC721BaseCollectionV2#setManagers: VALUE_IS_THE_SAME'
        )

        await assertRevert(
          collectionContract.setItemsManagers(
            [0],
            [manager],
            [true],
            fromCreator
          ),
          'ERC721BaseCollectionV2#setItemsManagers: VALUE_IS_THE_SAME'
        )

        await assertRevert(
          collectionContract.setItemsManagers(
            [0, 1, 0],
            [user, manager, manager],
            [true, true, true],
            fromCreator
          ),
          'ERC721BaseCollectionV2#setItemsManagers: VALUE_IS_THE_SAME'
        )
      })
    })

    describe('addItem', function () {
      let contract
      beforeEach(async () => {
        // Create collection and set up wearables
        contract = await createContract(creator, false, creationParams)
      })

      it('should add an item', async function () {
        const newItem = [
          RARITIES.common.index.toString(),
          '0',
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]
        let itemLength = await contract.itemsCount()
        const { logs } = await contract.addItems([newItem], fromCreator)

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('AddItem')
        expect(logs[0].args._itemId).to.be.eq.BN(itemLength)
        expect(logs[0].args._item).to.be.eql(newItem)

        itemLength = await contract.itemsCount()

        const item = await contract.items(itemLength.sub(web3.utils.toBN(1)))
        expect([
          item.rarity.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql(newItem)
      })

      it('should add items', async function () {
        const newItem1 = [
          RARITIES.common.index.toString(),
          '0',
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]

        const newItem2 = [
          RARITIES.common.index.toString(),
          '0',
          web3.utils.toWei('10'),
          beneficiary,
          '1:turtle_mask:hat:female,male',
          EMPTY_HASH,
        ]

        let itemLength = await contract.itemsCount()
        const { logs } = await contract.addItems(
          [newItem1, newItem2],
          fromCreator
        )

        expect(logs.length).to.be.equal(2)
        expect(logs[0].event).to.be.equal('AddItem')
        expect(logs[0].args._itemId).to.be.eq.BN(itemLength)
        expect(logs[0].args._item).to.be.eql(newItem1)

        expect(logs[1].event).to.be.equal('AddItem')
        expect(logs[1].args._itemId).to.be.eq.BN(
          itemLength.add(web3.utils.toBN(1))
        )
        expect(logs[1].args._item).to.be.eql(newItem2)

        itemLength = await contract.itemsCount()

        let item = await contract.items(itemLength.sub(web3.utils.toBN(2)))
        expect([
          item.rarity.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql(newItem1)

        item = await contract.items(itemLength.sub(web3.utils.toBN(1)))
        expect([
          item.rarity.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql(newItem2)
      })

      it('should add an item with price 0 and no beneficiary', async function () {
        let itemLength = await contract.itemsCount()
        const newItem = [
          RARITIES.common.index.toString(),
          '0',
          '0',
          ZERO_ADDRESS,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]

        const { logs } = await contract.addItems([newItem], fromCreator)

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('AddItem')
        expect(logs[0].args._itemId).to.be.eq.BN(itemLength)
        expect(logs[0].args._item).to.be.eql(newItem)

        itemLength = await contract.itemsCount()

        const item = await contract.items(itemLength.sub(web3.utils.toBN(1)))
        expect([
          item.rarity.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql(newItem)
      })

      it('reverts when one of the item is invalid', async function () {
        const newItem1 = [
          RARITIES.common.index.toString(),
          '0',
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]

        const newItem2 = [
          Object.values(RARITIES).length, // invalid rarity
          '0',
          web3.utils.toWei('10'),
          beneficiary,
          '1:turtle_mask:hat:female,male',
          EMPTY_HASH,
        ]

        await assertRevert(contract.addItems([newItem1, newItem2], fromCreator))
      })

      it('reverts when trying to add an item with current supply > 0', async function () {
        const newItem = [
          RARITIES.common.index.toString(),
          '1',
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]
        await assertRevert(
          contract.addItems([newItem], fromCreator),
          'ERC721BaseCollectionV2#_addItem: INVALID_TOTAL_SUPPLY'
        )
      })

      it('reverts when trying to add an item with invalid rarity', async function () {
        let newItem = [
          Object.values(RARITIES).length, // Invalid rarity
          '0',
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]

        await assertRevert(contract.addItems([newItem], fromCreator))
      })

      it('reverts when trying to add an item with price and no beneficiary', async function () {
        const newItem = [
          RARITIES.common.index.toString(),
          '0',
          web3.utils.toWei('10'),
          ZERO_ADDRESS,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]
        await assertRevert(
          contract.addItems([newItem], fromCreator),
          'ERC721BaseCollectionV2#_addItem: INVALID_PRICE_AND_BENEFICIARY'
        )
      })

      it('reverts when trying to add an item without price but beneficiary', async function () {
        const newItem = [
          RARITIES.common.index.toString(),
          '0',
          web3.utils.toWei('0'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]
        await assertRevert(
          contract.addItems([newItem], fromCreator),
          'ERC721BaseCollectionV2#_addItem: INVALID_PRICE_AND_BENEFICIARY'
        )
      })

      it('reverts when trying to add an item without metadata', async function () {
        const newItem = [
          RARITIES.common.index.toString(),
          '0',
          web3.utils.toWei('10'),
          beneficiary,
          '',
          EMPTY_HASH,
        ]
        await assertRevert(
          contract.addItems([newItem], fromCreator),
          'ERC721BaseCollectionV2#_addItem: EMPTY_METADATA'
        )
      })

      it('reverts when trying to add an item with content hash', async function () {
        const newItem = [
          RARITIES.common.index.toString(),
          '0',
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
          '0x01',
        ]
        await assertRevert(
          contract.addItems([newItem], fromCreator),
          'ERC721BaseCollectionV2#_addItem: CONTENT_HASH_SHOULD_BE_EMPTY'
        )
      })

      it('reverts when trying to add an item by not the creator', async function () {
        await contract.setMinters([minter], [true], fromCreator)
        await contract.setManagers([manager], [true], fromCreator)
        await contract.setItemsMinters([0], [minter], [true], fromCreator)
        await contract.setItemsManagers([0], [manager], [true], fromCreator)

        const newItem = [
          RARITIES.common.index.toString(),
          '0',
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]

        await assertRevert(
          contract.addItems([newItem], fromDeployer),
          'ERC721BaseCollectionV2#onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          contract.addItems([newItem], fromMinter),
          'ERC721BaseCollectionV2#onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          contract.addItems([newItem], fromManager),
          'ERC721BaseCollectionV2#onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          contract.addItems([newItem], fromHacker),
          'ERC721BaseCollectionV2#onlyCreator: CALLER_IS_NOT_CREATOR'
        )
      })

      it('reverts when trying to add an item to a completed collection', async function () {
        await contract.completeCollection(fromCreator)

        const newItem = [
          RARITIES.common.index.toString(),
          '0',
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]

        await assertRevert(
          contract.addItems([newItem], fromCreator),
          'ERC721BaseCollectionV2#_addItem: COLLECTION_COMPLETED'
        )
      })
    })

    describe('editItemsSalesData', function () {
      const itemPrice0 = web3.utils.toWei('10')
      const itemPrice1 = web3.utils.toWei('100')

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

        item0 = [
          RARITIES.common.index.toString(),
          '0',
          itemPrice0,
          itemBeneficiary0,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]

        item1 = [
          RARITIES.common.index.toString(),
          '0',
          itemPrice1,
          itemBeneficiary1,
          '1:turtle_mask:hat:female,male',
          EMPTY_HASH,
        ]

        contract = await createContract(creator, false, creationParams)
        await contract.addItems([item0, item1], fromCreator)

        const itemLength = await contract.itemsCount()
        itemId0 = itemLength.sub(web3.utils.toBN(2))
        itemId1 = itemLength.sub(web3.utils.toBN(1))
      })

      it('should edit an item sales data', async function () {
        let item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql(item0)

        const newItemPrice0 = web3.utils.toWei('1000')
        const newItemBeneficiary0 = holder
        const { logs } = await contract.editItemsSalesData(
          [itemId0],
          [newItemPrice0],
          [newItemBeneficiary0],
          fromCreator
        )

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('UpdateItemSalesData')
        expect(logs[0].args._itemId).to.be.eq.BN(itemId0)
        expect(logs[0].args._price).to.be.eq.BN(newItemPrice0)
        expect(logs[0].args._beneficiary).to.be.equal(newItemBeneficiary0)

        item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          item0[1],
          newItemPrice0.toString(),
          newItemBeneficiary0,
          item0[4],
          item0[5],
        ])
      })

      it('should edit items sales data', async function () {
        let item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql(item0)

        item = await contract.items(itemId1)
        expect([
          item.rarity.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql(item1)

        const newItemPrice0 = web3.utils.toWei('1000')
        const newItemBeneficiary0 = holder
        const newItemPrice1 = web3.utils.toWei('1')
        const newItemBeneficiary1 = anotherHolder

        const { logs } = await contract.editItemsSalesData(
          [itemId0, itemId1],
          [newItemPrice0, newItemPrice1],
          [newItemBeneficiary0, newItemBeneficiary1],
          fromCreator
        )

        expect(logs.length).to.be.equal(2)
        expect(logs[0].event).to.be.equal('UpdateItemSalesData')
        expect(logs[0].args._itemId).to.be.eq.BN(itemId0)
        expect(logs[0].args._price).to.be.eq.BN(newItemPrice0)
        expect(logs[0].args._beneficiary).to.be.equal(newItemBeneficiary0)

        expect(logs[1].event).to.be.equal('UpdateItemSalesData')
        expect(logs[1].args._itemId).to.be.eq.BN(itemId1)
        expect(logs[1].args._price).to.be.eq.BN(newItemPrice1)
        expect(logs[1].args._beneficiary).to.be.equal(newItemBeneficiary1)

        item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          item0[1],
          newItemPrice0.toString(),
          newItemBeneficiary0,
          item0[4],
          item0[5],
        ])

        item = await contract.items(itemId1)
        expect([
          item.rarity.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item1[0],
          item1[1],
          newItemPrice1.toString(),
          newItemBeneficiary1,
          item1[4],
          item1[5],
        ])
      })

      it('should edit an item with price and beneficiary', async function () {
        let item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql(item0)

        const { logs } = await contract.editItemsSalesData(
          [itemId0],
          [0],
          [ZERO_ADDRESS],
          fromCreator
        )

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('UpdateItemSalesData')
        expect(logs[0].args._itemId).to.be.eq.BN(itemId0)
        expect(logs[0].args._price).to.be.eq.BN(web3.utils.toBN(0))
        expect(logs[0].args._beneficiary).to.be.equal(ZERO_ADDRESS)

        item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          item0[1],
          '0',
          ZERO_ADDRESS,
          item0[4],
          item0[5],
        ])
      })

      it('should edit an item without price and beneficiary', async function () {
        let item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql(item0)

        const newItemPrice0 = web3.utils.toWei('1')
        const newItemBeneficiary0 = anotherHolder
        const { logs } = await contract.editItemsSalesData(
          [itemId0],
          [newItemPrice0],
          [newItemBeneficiary0],
          fromCreator
        )

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('UpdateItemSalesData')
        expect(logs[0].args._itemId).to.be.eq.BN(itemId0)
        expect(logs[0].args._price).to.be.eq.BN(newItemPrice0)
        expect(logs[0].args._beneficiary).to.be.equal(newItemBeneficiary0)

        item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          item0[1],
          newItemPrice0,
          newItemBeneficiary0,
          item0[4],
          item0[5],
        ])
      })

      it('should allow managers to edit items sales data', async function () {
        await assertRevert(
          contract.editItemsSalesData(
            [itemId0],
            [itemPrice0],
            [itemBeneficiary0],
            fromManager
          ),
          'ERC721BaseCollectionV2#editItemsSalesData: CALLER_IS_NOT_CREATOR_OR_MANAGER'
        )

        // Set global Manager
        await contract.setManagers([manager], [true], fromCreator)
        await contract.editItemsSalesData(
          [itemId0],
          [itemPrice0],
          [itemBeneficiary0],
          fromManager
        )

        await contract.setManagers([manager], [false], fromCreator)
        await assertRevert(
          contract.editItemsSalesData(
            [itemId0],
            [itemPrice0],
            [itemBeneficiary0],
            fromManager
          ),
          'ERC721BaseCollectionV2#editItemsSalesData: CALLER_IS_NOT_CREATOR_OR_MANAGER'
        )

        // Set item Manager
        await contract.setItemsManagers(
          [itemId0],
          [manager],
          [true],
          fromCreator
        )

        await contract.editItemsSalesData(
          [itemId0],
          [itemPrice0],
          [itemBeneficiary0],
          fromManager
        )
      })

      it('should allow the creator to edit items sales data', async function () {
        await contract.editItemsSalesData(
          [itemId0],
          [itemPrice0],
          [itemBeneficiary0],
          fromCreator
        )
      })

      it('reverts when passing different length parameters', async function () {
        await assertRevert(
          contract.editItemsSalesData(
            [itemId0],
            [itemPrice0, itemPrice1],
            [itemBeneficiary0, itemBeneficiary1],
            fromCreator
          ),
          'ERC721BaseCollectionV2#editItemsSalesData: LENGTH_MISMATCH'
        )

        await assertRevert(
          contract.editItemsSalesData(
            [itemId0, itemId1],
            [itemPrice1],
            [itemBeneficiary0, itemBeneficiary1],
            fromCreator
          ),
          'ERC721BaseCollectionV2#editItemsSalesData: LENGTH_MISMATCH'
        )

        await assertRevert(
          contract.editItemsSalesData(
            [itemId0, itemId1],
            [itemPrice0, itemPrice1],
            [itemBeneficiary0],
            fromCreator
          ),
          'ERC721BaseCollectionV2#editItemsSalesData: LENGTH_MISMATCH'
        )
      })

      it('reverts when trying to edit sales data by not the creator or manager', async function () {
        await contract.setMinters([minter], [true], fromCreator)
        await contract.setItemsMinters([0], [minter], [true], fromCreator)

        await assertRevert(
          contract.editItemsSalesData(
            [itemId0],
            [itemPrice0],
            [itemBeneficiary0],
            fromDeployer
          ),
          'ERC721BaseCollectionV2#editItemsSalesData: CALLER_IS_NOT_CREATOR_OR_MANAGER'
        )

        await assertRevert(
          contract.editItemsSalesData(
            [itemId0],
            [itemPrice0],
            [itemBeneficiary0],
            fromMinter
          ),
          'ERC721BaseCollectionV2#editItemsSalesData: CALLER_IS_NOT_CREATOR_OR_MANAGER'
        )

        await assertRevert(
          contract.editItemsSalesData(
            [itemId0],
            [itemPrice0],
            [itemBeneficiary0],
            fromHacker
          ),
          'ERC721BaseCollectionV2#editItemsSalesData: CALLER_IS_NOT_CREATOR_OR_MANAGER'
        )
      })

      it('reverts when trying to edit an invalid item sales data', async function () {
        const itemLength = await contract.itemsCount()
        await assertRevert(
          contract.editItemsSalesData(
            [itemLength],
            [itemPrice0],
            [itemBeneficiary0],
            fromCreator
          ),
          'ERC721BaseCollectionV2#editItemsSalesData: ITEM_DOES_NOT_EXIST'
        )
      })

      it('reverts when trying to edit an item with price 0 and without beneficiary', async function () {
        await assertRevert(
          contract.editItemsSalesData(
            [itemId0],
            [itemPrice0],
            [ZERO_ADDRESS],
            fromCreator
          ),
          'ERC721BaseCollectionV2#editItemsSalesData: INVALID_PRICE_AND_BENEFICIARY'
        )
      })

      it('reverts when trying to edit an item without price but beneficiary', async function () {
        await assertRevert(
          contract.editItemsSalesData(
            [itemId0],
            [0],
            [itemBeneficiary0],
            fromCreator
          ),
          'ERC721BaseCollectionV2#editItemsSalesData: INVALID_PRICE_AND_BENEFICIARY'
        )
      })
    })

    describe('editItemsMetadata', function () {
      const metadata0 = 'metadata:0'
      const metadata1 = 'metadata:1'

      let contract
      let itemId0
      let item0
      let itemId1
      let item1

      this.beforeEach(async () => {
        item0 = [
          RARITIES.common.index.toString(),
          '0',
          web3.utils.toBN(10).toString(),
          beneficiary,
          metadata0,
          EMPTY_HASH,
        ]

        item1 = [
          RARITIES.common.index.toString(),
          '0',
          web3.utils.toBN(10).toString(),
          beneficiary,
          metadata1,
          EMPTY_HASH,
        ]

        contract = await createContract(creator, false, creationParams)
        await contract.addItems([item0, item1], fromCreator)

        const itemLength = await contract.itemsCount()
        itemId0 = itemLength.sub(web3.utils.toBN(2))
        itemId1 = itemLength.sub(web3.utils.toBN(1))
      })

      it('should edit an item metadata', async function () {
        let item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql(item0)

        const newMetadata0 = 'new:metadata:0'
        const { logs } = await contract.editItemsMetadata(
          [itemId0],
          [newMetadata0],
          fromCreator
        )

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('UpdateItemMetadata')
        expect(logs[0].args._itemId).to.be.eq.BN(itemId0)
        expect(logs[0].args._metadata).to.be.eq.BN(newMetadata0)

        item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          item0[1],
          item0[2],
          item0[3],
          newMetadata0,
          item0[5],
        ])
      })

      it('should edit items metadata', async function () {
        let item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql(item0)

        item = await contract.items(itemId1)
        expect([
          item.rarity.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql(item1)

        const newMetadata0 = 'new:metadata:0'
        const newMetadata1 = 'new:metadata:1'

        const { logs } = await contract.editItemsMetadata(
          [itemId0, itemId1],
          [newMetadata0, newMetadata1],
          fromCreator
        )

        expect(logs.length).to.be.equal(2)
        expect(logs[0].event).to.be.equal('UpdateItemMetadata')
        expect(logs[0].args._itemId).to.be.eq.BN(itemId0)
        expect(logs[0].args._metadata).to.be.eq.BN(newMetadata0)

        expect(logs[1].event).to.be.equal('UpdateItemMetadata')
        expect(logs[1].args._itemId).to.be.eq.BN(itemId1)
        expect(logs[1].args._metadata).to.be.eq.BN(newMetadata1)

        item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          item0[1],
          item0[2],
          item0[3],
          newMetadata0,
          item0[5],
        ])

        item = await contract.items(itemId1)
        expect([
          item.rarity.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item1[0],
          item1[1],
          item1[2],
          item1[3],
          newMetadata1,
          item1[5],
        ])
      })

      it('should allow managers to edit items metadata', async function () {
        await assertRevert(
          contract.editItemsMetadata([itemId0], [metadata0], fromManager),
          'ERC721BaseCollectionV2#editItemsMetadata: CALLER_IS_NOT_CREATOR_OR_MANAGER'
        )

        // Set global Manager
        await contract.setManagers([manager], [true], fromCreator)
        await contract.editItemsMetadata([itemId0], [metadata0], fromManager)

        await contract.setManagers([manager], [false], fromCreator)
        await assertRevert(
          contract.editItemsMetadata([itemId0], [metadata0], fromManager),
          'ERC721BaseCollectionV2#editItemsMetadata: CALLER_IS_NOT_CREATOR_OR_MANAGER'
        )

        // Set item Manager
        await contract.setItemsManagers(
          [itemId0],
          [manager],
          [true],
          fromCreator
        )

        await contract.editItemsMetadata([itemId0], [metadata0], fromManager)
      })

      it('should allow the creator to edit items', async function () {
        await contract.editItemsMetadata([itemId0], [metadata0], fromCreator)
      })

      it('reverts when passing different length parameters', async function () {
        await assertRevert(
          contract.editItemsMetadata(
            [itemId0],
            [metadata0, metadata1],
            fromCreator
          ),
          'ERC721BaseCollectionV2#editItemsMetadata: LENGTH_MISMATCH'
        )

        await assertRevert(
          contract.editItemsMetadata(
            [itemId0, itemId1],
            [metadata0],
            fromCreator
          ),
          'ERC721BaseCollectionV2#editItemsMetadata: LENGTH_MISMATCH'
        )
      })

      it('reverts when trying to edit metadata by not the creator or manager', async function () {
        await contract.setMinters([minter], [true], fromCreator)
        await contract.setItemsMinters([0], [minter], [true], fromCreator)

        await assertRevert(
          contract.editItemsMetadata([itemId0], [metadata0], fromDeployer),
          'ERC721BaseCollectionV2#editItemsMetadata: CALLER_IS_NOT_CREATOR_OR_MANAGER'
        )

        await assertRevert(
          contract.editItemsMetadata([itemId0], [metadata0], fromMinter),
          'ERC721BaseCollectionV2#editItemsMetadata: CALLER_IS_NOT_CREATOR_OR_MANAGER'
        )

        await assertRevert(
          contract.editItemsMetadata([itemId0], [metadata0], fromHacker),
          'ERC721BaseCollectionV2#editItemsMetadata: CALLER_IS_NOT_CREATOR_OR_MANAGER'
        )
      })

      it('reverts when trying to edit an invalid item metadata', async function () {
        const itemLength = await contract.itemsCount()
        await assertRevert(
          contract.editItemsMetadata([itemLength], [metadata0], fromCreator),
          'ERC721BaseCollectionV2#editItemsMetadata: ITEM_DOES_NOT_EXIST'
        )
      })

      it('reverts when trying to edit an item with empty metadata', async function () {
        await assertRevert(
          contract.editItemsMetadata([itemId0], [''], fromCreator),
          'ERC721BaseCollectionV2#editItemsMetadata: EMPTY_METADATA'
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
          RARITIES.common.index.toString(),
          '0',
          web3.utils.toBN(10).toString(),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]

        item1 = [
          RARITIES.common.index.toString(),
          '0',
          web3.utils.toBN(10).toString(),
          beneficiary,
          '1:turtle_mask:hat:female,male',
          EMPTY_HASH,
        ]

        contract = await createContract(creator, false, creationParams)
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
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql(item0)

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
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          item0[1],
          item0[2],
          item0[3],
          newMetadata,
          newContentHash,
        ])
      })

      it('should rescue items', async function () {
        let item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql(item0)

        item = await contract.items(itemId1)
        expect([
          item.rarity.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql(item1)

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
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          item0[1],
          item0[2],
          item0[3],
          newMetadata0,
          newContentHash0,
        ])

        item = await contract.items(itemId1)
        expect([
          item.rarity.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item1[0],
          item1[1],
          item1[2],
          item1[3],
          newMetadata1,
          newContentHash1,
        ])
      })

      it('should rescue an item without changings its metadata', async function () {
        let item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql(item0)

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
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          item0[1],
          item0[2],
          item0[3],
          item0[4],
          newContentHash0,
        ])
      })

      it('should rescue an item cleaning its content hash', async function () {
        let item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql(item0)

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
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          item0[1],
          item0[2],
          item0[3],
          item0[4],
          newContentHash0,
        ])

        await contract.rescueItems([itemId0], [EMPTY_HASH], [''], fromDeployer)

        item = await contract.items(itemId0)
        expect([
          item.rarity.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql([
          item0[0],
          item0[1],
          item0[2],
          item0[3],
          item0[4],
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
          'ERC721BaseCollectionV2#rescueItems: LENGTH_MISMATCH'
        )

        await assertRevert(
          contract.rescueItems(
            [itemId0, itemId1],
            [EMPTY_HASH],
            ['', ''],
            fromDeployer
          ),
          'ERC721BaseCollectionV2#rescueItems: LENGTH_MISMATCH'
        )

        await assertRevert(
          contract.rescueItems(
            [itemId0, itemId1],
            [EMPTY_HASH, EMPTY_HASH],
            [''],
            fromDeployer
          ),
          'ERC721BaseCollectionV2#rescueItems: LENGTH_MISMATCH'
        )
      })

      it('reverts when trying to rescue by not the owner', async function () {
        await contract.setMinters([minter], [true], fromCreator)
        await contract.setManagers([manager], [true], fromCreator)
        await contract.setItemsMinters([0], [minter], [true], fromCreator)
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

      it('reverts when trying to rescue an invalid item', async function () {
        const itemLength = await contract.itemsCount()
        await assertRevert(
          contract.rescueItems([itemLength], [EMPTY_HASH], [''], fromDeployer),
          'ERC721BaseCollectionV2#rescueItems: ITEM_DOES_NOT_EXIST'
        )
      })
    })

    describe('issueToken', function () {
      let contract
      let newItem
      let newItemId

      beforeEach(async () => {
        newItem = [
          RARITIES.mythic.index,
          '0',
          '1',
          beneficiary,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]

        contract = await createContract(creator, false, creationParams)
        await contract.addItems([newItem], fromCreator)

        await contract.completeCollection(fromCreator)
        await contract.approveCollection(fromDeployer)

        newItemId = (await contract.itemsCount()).sub(web3.utils.toBN(1))
      })

      it('should issue a token', async function () {
        let item = await contract.items(newItemId)
        expect(item.rarity).to.eq.BN(newItem[0])
        expect(item.totalSupply).to.eq.BN(0)

        const currentTotalSupply = await contract.totalSupply()

        const { logs } = await contract.issueToken(
          anotherHolder,
          newItemId,
          fromCreator
        )

        const tokenId = encodeTokenId(newItemId, 1)

        // match issuance
        item = await contract.items(newItemId)
        expect(item.rarity).to.eq.BN(newItem[0])
        expect(item.totalSupply).to.eq.BN(1)

        expect(logs.length).to.be.equal(2)
        expect(logs[1].event).to.be.equal('Issue')
        expect(logs[1].args._beneficiary).to.be.equal(anotherHolder)
        expect(logs[1].args._tokenId).to.be.eq.BN(tokenId)
        expect(logs[1].args._itemId).to.be.eq.BN(newItemId)
        expect(logs[1].args._issuedId).to.eq.BN(1)

        // match total supply
        const totalSupply = await contract.totalSupply()
        expect(totalSupply).to.eq.BN(currentTotalSupply.add(web3.utils.toBN(1)))

        // match owner
        const owner = await contract.ownerOf(tokenId)
        expect(owner).to.be.equal(anotherHolder)

        // match URI
        const uri = await contract.tokenURI(tokenId)
        const uriArr = uri.split('/')
        expect(newItemId).to.eq.BN(uri.split('/')[uriArr.length - 2])
        expect(1).to.eq.BN(uri.split('/')[uriArr.length - 1])
      })

      it('should issue a token and increase item total supply', async function () {
        let item = await contract.items(newItemId)
        expect(item.rarity).to.eq.BN(newItem[0])
        expect(item.totalSupply).to.eq.BN(0)

        const currentTotalSupply = await contract.totalSupply()

        await contract.issueToken(anotherHolder, newItemId, fromCreator)

        // match issuance
        item = await contract.items(newItemId)
        expect(item.rarity).to.eq.BN(newItem[0])
        expect(item.totalSupply).to.eq.BN(1)

        // match URI
        let tokenId = encodeTokenId(newItemId, 1)
        let uri = await contract.tokenURI(tokenId)
        let uriArr = uri.split('/')
        expect(newItemId).to.eq.BN(uri.split('/')[uriArr.length - 2])
        expect(1).to.eq.BN(uri.split('/')[uriArr.length - 1])

        await Promise.all([
          contract.issueToken(anotherHolder, newItemId, fromCreator),
          contract.issueToken(anotherHolder, newItemId, fromCreator),
          contract.issueToken(anotherHolder, newItemId, fromCreator),
        ])

        // match issuance
        item = await contract.items(newItemId)
        expect(item.rarity).to.eq.BN(newItem[0])
        expect(item.totalSupply).to.eq.BN(4)

        // match URI
        tokenId = encodeTokenId(newItemId, 3)
        uri = await contract.tokenURI(tokenId)
        uriArr = uri.split('/')
        expect(newItemId).to.eq.BN(uri.split('/')[uriArr.length - 2])
        expect(3).to.eq.BN(uri.split('/')[uriArr.length - 1])

        const totalSupply = await contract.totalSupply()
        expect(totalSupply).to.eq.BN(currentTotalSupply.add(web3.utils.toBN(4)))
      })

      it('should issue a token by minter', async function () {
        await assertRevert(
          contract.issueToken(anotherHolder, newItemId, fromMinter),
          'ERC721BaseCollectionV2#canMint: CALLER_CAN_NOT_MINT'
        )

        // Set global Minter
        await contract.setMinters([minter], [true], fromCreator)
        await contract.issueToken(anotherHolder, newItemId, fromMinter)

        await contract.setMinters([minter], [false], fromCreator)
        await assertRevert(
          contract.issueToken(anotherHolder, newItemId, fromMinter),
          'ERC721BaseCollectionV2#canMint: CALLER_CAN_NOT_MINT'
        )

        // Set item Minter
        await contract.setItemsMinters(
          [newItemId],
          [minter],
          [true],
          fromCreator
        )

        await contract.issueToken(anotherHolder, newItemId, fromMinter)
      })

      it('reverts when issuing a token by not the creator or minter', async function () {
        await assertRevert(
          contract.issueToken(anotherHolder, newItemId, fromDeployer),
          'ERC721BaseCollectionV2#canMint: CALLER_CAN_NOT_MINT'
        )

        await assertRevert(
          contract.issueToken(anotherHolder, newItemId, fromManager),
          'ERC721BaseCollectionV2#canMint: CALLER_CAN_NOT_MINT'
        )

        await assertRevert(
          contract.issueToken(anotherHolder, newItemId, fromHacker),
          'ERC721BaseCollectionV2#canMint: CALLER_CAN_NOT_MINT'
        )
      })

      it('reverts when issuing a token to an invalid address', async function () {
        await assertRevert(
          contract.issueToken(ZERO_ADDRESS, newItemId, fromCreator),
          'ERC721: mint to the zero address'
        )
      })

      it('reverts when trying to issue an invalid item option id', async function () {
        const length = await contract.itemsCount()
        await assertRevert(
          contract.issueToken(holder, length, fromCreator),
          'ERC721BaseCollectionV2#_issueToken: ITEM_DOES_NOT_EXIST'
        )
      })

      it('reverts when trying to issue an exhausted item', async function () {
        for (let i = 0; i < RARITIES.mythic.value; i++) {
          await contract.issueToken(anotherHolder, newItemId, fromCreator)
        }
        await assertRevert(
          contract.issueToken(holder, newItemId, fromCreator),
          'ERC721BaseCollectionV2#_issueToken: ITEM_EXHAUSTED'
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
          RARITIES.mythic.index.toString(),
          '0',
          '1',
          beneficiary,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]

        anotherNewItem = [
          RARITIES.common.index.toString(),
          '0',
          '1',
          beneficiary,
          '1:turtle_mask:hat:female,male',
          EMPTY_HASH,
        ]

        contract = await createContract(creator, false, creationParams)
        await contract.addItems([newItem, anotherNewItem], fromCreator)

        await contract.completeCollection(fromCreator)
        await contract.approveCollection(fromDeployer)

        newItemId = (await contract.itemsCount()).sub(web3.utils.toBN(2))
        anotherNewItemId = (await contract.itemsCount()).sub(web3.utils.toBN(1))
      })

      it('should issue multiple token', async function () {
        let item = await contract.items(newItemId)
        expect(item.rarity).to.eq.BN(newItem[0])
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
        expect(item.rarity).to.eq.BN(newItem[0])
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

      it('should issue multiple token for the same item id :: gas estimation', async function () {
        const itemsInTheSameTx = 70
        const beneficiaries = []
        const ids = []

        for (let i = 0; i < itemsInTheSameTx; i++) {
          ids.push(anotherNewItemId)
          beneficiaries.push(beneficiary)
        }

        await contract.issueTokens(beneficiaries, ids, fromCreator)

        // match issueance
        const item = await contract.items(anotherNewItemId)
        expect(item.rarity).to.eq.BN(anotherNewItem[0])
        expect(item.totalSupply).to.eq.BN(itemsInTheSameTx)

        // User
        const balance = await contract.balanceOf(beneficiary)
        expect(balance).to.eq.BN(itemsInTheSameTx)
      })

      it('should issue multiple tokens by minter', async function () {
        await assertRevert(
          contract.issueTokens([anotherHolder], [newItemId], fromMinter),
          'ERC721BaseCollectionV2#canMint: CALLER_CAN_NOT_MINT'
        )

        // Set global Minter
        await contract.setMinters([minter], [true], fromCreator)
        await contract.issueTokens([anotherHolder], [newItemId], fromMinter)

        await contract.setMinters([minter], [false], fromCreator)
        await assertRevert(
          contract.issueTokens([anotherHolder], [newItemId], fromMinter),
          'ERC721BaseCollectionV2#canMint: CALLER_CAN_NOT_MINT'
        )

        // Set item Minter
        await contract.setItemsMinters(
          [newItemId],
          [minter],
          [true],
          fromCreator
        )

        await contract.issueTokens([anotherHolder], [newItemId], fromMinter)
      })

      it('reverts when issuing a token by not allowed user', async function () {
        await assertRevert(
          contract.issueTokens(
            [holder, anotherHolder],
            [newItemId, anotherNewItemId],
            fromDeployer
          ),
          'ERC721BaseCollectionV2#canMint: CALLER_CAN_NOT_MINT'
        )

        await assertRevert(
          contract.issueTokens(
            [holder, anotherHolder],
            [newItemId, anotherNewItemId],
            fromManager
          ),
          'ERC721BaseCollectionV2#canMint: CALLER_CAN_NOT_MINT'
        )

        await assertRevert(
          contract.issueTokens(
            [holder, anotherHolder],
            [newItemId, anotherNewItemId],
            fromHacker
          ),
          'ERC721BaseCollectionV2#canMint: CALLER_CAN_NOT_MINT'
        )
      })

      it('reverts if trying to issue tokens with invalid argument length', async function () {
        await assertRevert(
          contract.issueTokens([user], [newItemId, anotherNewItemId], fromUser),
          'ERC721BaseCollectionV2#issueTokens: LENGTH_MISMATCH'
        )

        await assertRevert(
          contract.issueTokens(
            [user, anotherUser],
            [anotherNewItemId],
            fromUser
          ),
          'ERC721BaseCollectionV2#issueTokens: LENGTH_MISMATCH'
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
          'ERC721BaseCollectionV2#_issueToken: ITEM_DOES_NOT_EXIST'
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
          'ERC721BaseCollectionV2#_issueToken: ITEM_EXHAUSTED'
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
          'ERC721BaseCollectionV2#_issueToken: ITEM_EXHAUSTED'
        )
      })
    })

    describe('tokenURI', function () {
      it('should return the correct token URI', async function () {
        const newItem = [
          RARITIES.common.index.toString(),
          '0',
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]

        const contract = await createContract(creator, false, creationParams)

        await contract.addItems([newItem], fromCreator)

        await contract.completeCollection(fromCreator)
        await contract.approveCollection(fromDeployer)

        const itemsLength = await contract.itemsCount()
        const itemId = itemsLength.sub(web3.utils.toBN(1))
        await contract.issueToken(holder, itemId, fromCreator)

        // match token id
        let uri = await contract.tokenURI(encodeTokenId(itemId.toString(), 1))
        let uriArr = uri.split('/') // [...]/8/1
        expect(itemId.toString()).to.eq.BN(uri.split('/')[uriArr.length - 2])
        expect('1').to.be.equal(uri.split('/')[uriArr.length - 1])
      })

      it('reverts if the token does not exist', async function () {
        await assertRevert(
          collectionContract.tokenURI(encodeTokenId(0, 100)),
          'ERC721Metadata: received a URI query for a nonexistent token'
        )

        await assertRevert(
          collectionContract.tokenURI(encodeTokenId(100, 1)),
          'ERC721Metadata: received a URI query for a nonexistent token'
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

      it('should safe transfer in batch', async function () {
        let ownerToken1 = await collectionContract.ownerOf(token1)
        let ownerToken2 = await collectionContract.ownerOf(token2)
        expect(ownerToken1).to.be.equal(holder)
        expect(ownerToken2).to.be.equal(holder)

        const { logs } = await collectionContract.safeBatchTransferFrom(
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

      it('should safe transfer in batch by approval for all', async function () {
        let ownerToken1 = await collectionContract.ownerOf(token1)
        let ownerToken2 = await collectionContract.ownerOf(token2)
        expect(ownerToken1).to.be.equal(holder)
        expect(ownerToken2).to.be.equal(holder)

        await collectionContract.setApprovalForAll(hacker, true, fromHolder)

        const { logs } = await collectionContract.safeBatchTransferFrom(
          holder,
          anotherHolder,
          [token1, token2],
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

      it('reverts when trying to change values by not the owner', async function () {
        await collectionContract.setMinters([minter], [true], fromCreator)
        await collectionContract.setManagers([manager], [true], fromCreator)
        await collectionContract.setItemsMinters(
          [0],
          [minter],
          [true],
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

      it('reverts when trying to set the same value as before', async function () {
        await assertRevert(
          collectionContract.setEditable(true, fromDeployer),
          'ERC721BaseCollectionV2#setEditable: VALUE_IS_THE_SAME'
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

      it('reverts when trying to change values by hacker', async function () {
        await assertRevert(
          collectionContract.setBaseURI('', fromHacker),
          'Ownable: caller is not the owner'
        )
      })
    })

    describe('completeCollection', function () {
      let contract
      beforeEach(async () => {
        // Create collection and set up wearables
        contract = await createContract(creator, false, creationParams)
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

      it('should issue tokens after complete the collection', async function () {
        await contract.completeCollection(fromCreator)
        await contract.approveCollection(fromDeployer)

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
          RARITIES.common.index.toString(),
          '0',
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]
        await assertRevert(
          contract.addItems([newItem], fromCreator),
          'ERC721BaseCollectionV2#_addItem: COLLECTION_COMPLETED'
        )
      })

      it('reverts when completing collection twice', async function () {
        await contract.completeCollection(fromCreator)

        await assertRevert(
          contract.completeCollection(fromCreator),
          'ERC721BaseCollectionV2#completeCollection: COLLECTION_ALREADY_COMPLETED'
        )
      })

      it('reverts when completing collection by other than the creator', async function () {
        await assertRevert(
          contract.completeCollection(fromDeployer),
          'ERC721BaseCollectionV2#onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          contract.completeCollection(fromManager),
          'ERC721BaseCollectionV2#onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          contract.completeCollection(fromMinter),
          'ERC721BaseCollectionV2#onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          contract.completeCollection(fromHacker),
          'ERC721BaseCollectionV2#onlyCreator: CALLER_IS_NOT_CREATOR'
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

      it('reverts when trying to transfer creator role by not the owner or creator', async function () {
        await collectionContract.setMinters([minter], [true], fromCreator)
        await collectionContract.setManagers([manager], [true], fromCreator)
        await collectionContract.setItemsMinters(
          [0],
          [minter],
          [true],
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
          'ERC721BaseCollectionV2#transferCreatorship: CALLER_IS_NOT_OWNER_OR_CREATOR'
        )

        await assertRevert(
          collectionContract.transferCreatorship(user, fromManager),
          'ERC721BaseCollectionV2#transferCreatorship: CALLER_IS_NOT_OWNER_OR_CREATOR'
        )

        await assertRevert(
          collectionContract.transferCreatorship(user, fromHacker),
          'ERC721BaseCollectionV2#transferCreatorship: CALLER_IS_NOT_OWNER_OR_CREATOR'
        )
      })

      it('reverts when trying to transfer creator role to an invalid address', async function () {
        await assertRevert(
          collectionContract.transferCreatorship(ZERO_ADDRESS, fromDeployer),
          'ERC721BaseCollectionV2#transferCreatorship: INVALID_CREATOR_ADDRESS'
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
          'ERC721BaseCollectionV2#encodeTokenId: INVALID_ITEM_ID'
        )
      })

      it('revert when the second value is greater than 27 bytes', async function () {
        const max = web3.utils.toBN(web3.utils.padLeft('0xff', 54, 'f'))
        const one = web3.utils.toBN(1)

        const expectedId = await collectionContract.encodeTokenId(0, max)
        expect(expectedId).to.eq.BN(encodeTokenId(0, max))

        await assertRevert(
          collectionContract.encodeTokenId(0, max.add(one)),
          'ERC721BaseCollectionV2#encodeTokenId: INVALID_ISSUED_ID'
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

    describe('rarity', function () {
      it('should get rarity values', async function () {
        const values = Object.values(RARITIES)

        for (let rarity of values) {
          let expectedValue = await collectionContract.getRarityValue(
            rarity.index
          )
          expect(expectedValue).to.eq.BN(rarity.value)
        }
      })

      it('should get rarity names', async function () {
        const values = Object.values(RARITIES)

        for (let rarity of values) {
          let expectedValue = await collectionContract.getRarityName(
            rarity.index
          )
          expect(expectedValue).to.eq.BN(rarity.name)
        }
      })

      it('reverts when rarity is invalid', async function () {
        const values = Object.values(RARITIES)
        await assertRevert(collectionContract.getRarityValue(values.length))

        await assertRevert(collectionContract.getRarityName(values.length))
      })
    })
  })
}
