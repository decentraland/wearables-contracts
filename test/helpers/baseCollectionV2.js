import assertRevert from './assertRevert'
import {
  EMPTY_HASH,
  ZERO_ADDRESS,
  BASE_URI,
  decodeTokenId,
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
  xdescribe('Base Collection', function () {
    this.timeout(100000)

    let creationParams

    //wearable
    const item0 = items[0]
    const item1 = items[1]
    const item2 = items[2]

    const issuance1 = 10
    const newItem1 = 'new_exclusive_wearable_1'
    const issuance2 = 10
    const newItem2 = 'new_exclusive_wearable_2'
    const newLongWearable1 = 'new_exclusive_wearable_1_super_super_long'

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

      collectionContract = await createContract(creator, creationParams)

      await issueItem(collectionContract, holder, 0, fromCreator)
      await issueItem(collectionContract, holder, 0, fromCreator)
      await issueItem(collectionContract, anotherHolder, 1, fromCreator)
    })

    this.afterEach(async () => {
      afterEach()
    })

    xdescribe('initialize', function () {
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
        const isComplete_ = await contract.isComplete()

        expect(baseURI_).to.be.equal(BASE_URI)
        expect(creator_).to.be.equal(user)
        expect(owner_).to.be.equal(deployer)
        expect(name_).to.be.equal(contractName)
        expect(symbol_).to.be.equal(contractSymbol)
        expect(isComplete_).to.be.equal(false)

        const itemLength = await contract.itemsCount()

        expect(items.length).to.be.eq.BN(itemLength)

        for (let i = 0; i < items.length; i++) {
          const {
            maxSupply,
            totalSupply,
            price,
            beneficiary,
            metadata,
            contentHash,
          } = await contract.items(i)

          expect(maxSupply).to.be.eq.BN(items[i][0])
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
        const isComplete_ = await contract.isComplete()

        expect(baseURI_).to.be.equal(BASE_URI)
        expect(creator_).to.be.equal(user)
        expect(owner_).to.be.equal(deployer)
        expect(name_).to.be.equal(contractName)
        expect(symbol_).to.be.equal(contractSymbol)
        expect(isComplete_).to.be.equal(false)

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

        const isComplete_ = await contract.isComplete()
        expect(isComplete_).to.be.equal(true)
      })
    })

    xdescribe('addItem', function () {
      it('should add an item', async function () {
        const newItem = [
          '10',
          '0',
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]
        let itemLength = await collectionContract.itemsCount()
        const { logs } = await collectionContract.addItems(
          [newItem],
          fromCreator
        )

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('AddItem')
        expect(logs[0].args._itemId).to.be.eq.BN(itemLength)
        expect(logs[0].args._item).to.be.eql(newItem)

        itemLength = await collectionContract.itemsCount()

        const item = await collectionContract.items(
          itemLength.sub(web3.utils.toBN(1))
        )
        expect([
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql(newItem)
      })

      it('should add items', async function () {
        const newItem1 = [
          '10',
          '0',
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]

        const newItem2 = [
          '10',
          '0',
          web3.utils.toWei('10'),
          beneficiary,
          '1:turtle_mask:hat:female,male',
          EMPTY_HASH,
        ]

        let itemLength = await collectionContract.itemsCount()
        const { logs } = await collectionContract.addItems(
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

        itemLength = await collectionContract.itemsCount()

        let item = await collectionContract.items(
          itemLength.sub(web3.utils.toBN(2))
        )
        expect([
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql(newItem1)

        item = await collectionContract.items(
          itemLength.sub(web3.utils.toBN(1))
        )
        expect([
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql(newItem2)
      })

      it('should add an item with price 0 and no beneficiary', async function () {
        let itemLength = await collectionContract.itemsCount()
        const newItem = [
          '10',
          '0',
          '0',
          ZERO_ADDRESS,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]

        const { logs } = await collectionContract.addItems(
          [newItem],
          fromCreator
        )

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('AddItem')
        expect(logs[0].args._itemId).to.be.eq.BN(itemLength)
        expect(logs[0].args._item).to.be.eql(newItem)

        itemLength = await collectionContract.itemsCount()

        const item = await collectionContract.items(
          itemLength.sub(web3.utils.toBN(1))
        )
        expect([
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql(newItem)
      })

      it('reverts when one of the item is invalid', async function () {
        const newItem1 = [
          '10',
          '0',
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]

        const newItem2 = [
          '0',
          '0',
          web3.utils.toWei('10'),
          beneficiary,
          '1:turtle_mask:hat:female,male',
          EMPTY_HASH,
        ]

        await assertRevert(
          collectionContract.addItems([newItem1, newItem2], fromCreator),
          'ERC721BaseCollectionV2#_addItem: INVALID_MAX_SUPPLY'
        )
      })

      it('reverts when trying to add an item with current supply > 0', async function () {
        const newItem = [
          '10',
          '1',
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]
        await assertRevert(
          collectionContract.addItems([newItem], fromCreator),
          'ERC721BaseCollectionV2#_addItem: INVALID_TOTAL_SUPPLY'
        )
      })

      it('reverts when trying to add an item with max supply = 0 or greather than MAX_SUPPLY', async function () {
        let newItem = [
          '0',
          '0',
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]

        await assertRevert(
          collectionContract.addItems([newItem], fromCreator),
          'ERC721BaseCollectionV2#_addItem: INVALID_MAX_SUPPLY'
        )

        const maxSupply = web3.utils.toBN(web3.utils.padLeft('0xff', 54, 'f'))
        newItem = [
          maxSupply.add(web3.utils.toBN(1)),
          '0',
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]

        await assertRevert(
          collectionContract.addItems([newItem], fromCreator),
          'ERC721BaseCollectionV2#_addItem: INVALID_MAX_SUPPLY'
        )
      })

      it('reverts when trying to add an item with price and no beneficiary', async function () {
        const newItem = [
          '10',
          '0',
          web3.utils.toWei('10'),
          ZERO_ADDRESS,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]
        await assertRevert(
          collectionContract.addItems([newItem], fromCreator),
          'ERC721BaseCollectionV2#_addItem: INVALID_PRICE_AND_BENEFICIARY'
        )
      })

      it('reverts when trying to add an item without price but beneficiary', async function () {
        const newItem = [
          '10',
          '0',
          web3.utils.toWei('0'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]
        await assertRevert(
          collectionContract.addItems([newItem], fromCreator),
          'ERC721BaseCollectionV2#_addItem: INVALID_PRICE_AND_BENEFICIARY'
        )
      })

      it('reverts when trying to add an item without metadata', async function () {
        const newItem = [
          '10',
          '0',
          web3.utils.toWei('10'),
          beneficiary,
          '',
          EMPTY_HASH,
        ]
        await assertRevert(
          collectionContract.addItems([newItem], fromCreator),
          'ERC721BaseCollectionV2#_addItem: EMPTY_METADATA'
        )
      })

      it('reverts when trying to add an item with content hash', async function () {
        const newItem = [
          '10',
          '0',
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
          '0x01',
        ]
        await assertRevert(
          collectionContract.addItems([newItem], fromCreator),
          'ERC721BaseCollectionV2#_addItem: CONTENT_HASH_SHOULD_BE_EMPTY'
        )
      })

      it('reverts when trying to add an item by hacker', async function () {
        const newItem = [
          '10',
          '0',
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]

        await assertRevert(
          collectionContract.addItems([newItem], fromHacker),
          'ERC721BaseCollectionV2#onlyCreator: CALLER_IS_NOT_CREATOR'
        )
      })

      it('reverts when trying to add an item to a completed collection', async function () {
        await collectionContract.completeCollection(fromCreator)

        const newItem = [
          '10',
          '0',
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]

        await assertRevert(
          collectionContract.addItems([newItem], fromCreator),
          'ERC721BaseCollectionV2#_addItem: COLLECTION_COMPLETED'
        )
      })
    })

    xdescribe('editItems', function () {
      const itemPrice0 = web3.utils.toWei('10')
      const itemPrice1 = web3.utils.toWei('100')

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
          '10',
          '0',
          itemPrice0,
          itemBeneficiary0,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]

        item1 = [
          '10',
          '0',
          itemPrice1,
          itemBeneficiary1,
          '1:turtle_mask:hat:female,male',
          EMPTY_HASH,
        ]
        await collectionContract.addItems([item0, item1], fromCreator)

        const itemLength = await collectionContract.itemsCount()
        itemId0 = itemLength.sub(web3.utils.toBN(2))
        itemId1 = itemLength.sub(web3.utils.toBN(1))
      })

      it('should edit an item', async function () {
        let item = await collectionContract.items(itemId0)
        expect([
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql(item0)

        const newItemPrice0 = web3.utils.toWei('1000')
        const newItemBeneficiary0 = holder
        const { logs } = await collectionContract.editItems(
          [itemId0],
          [newItemPrice0],
          [newItemBeneficiary0],
          fromCreator
        )

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('UpdateItem')
        expect(logs[0].args._itemId).to.be.eq.BN(itemId0)
        expect(logs[0].args._price).to.be.eq.BN(newItemPrice0)
        expect(logs[0].args._beneficiary).to.be.equal(newItemBeneficiary0)

        item = await collectionContract.items(itemId0)
        expect([
          item.maxSupply.toString(),
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

      it('should edit items', async function () {
        let item = await collectionContract.items(itemId0)
        expect([
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql(item0)

        item = await collectionContract.items(itemId1)
        expect([
          item.maxSupply.toString(),
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

        const { logs } = await collectionContract.editItems(
          [itemId0, itemId1],
          [newItemPrice0, newItemPrice1],
          [newItemBeneficiary0, newItemBeneficiary1],
          fromCreator
        )

        expect(logs.length).to.be.equal(2)
        expect(logs[0].event).to.be.equal('UpdateItem')
        expect(logs[0].args._itemId).to.be.eq.BN(itemId0)
        expect(logs[0].args._price).to.be.eq.BN(newItemPrice0)
        expect(logs[0].args._beneficiary).to.be.equal(newItemBeneficiary0)

        expect(logs[1].event).to.be.equal('UpdateItem')
        expect(logs[1].args._itemId).to.be.eq.BN(itemId1)
        expect(logs[1].args._price).to.be.eq.BN(newItemPrice1)
        expect(logs[1].args._beneficiary).to.be.equal(newItemBeneficiary1)

        item = await collectionContract.items(itemId0)
        expect([
          item.maxSupply.toString(),
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

        item = await collectionContract.items(itemId1)
        expect([
          item.maxSupply.toString(),
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
        let item = await collectionContract.items(itemId0)
        expect([
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql(item0)

        const { logs } = await collectionContract.editItems(
          [itemId0],
          [0],
          [ZERO_ADDRESS],
          fromCreator
        )

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('UpdateItem')
        expect(logs[0].args._itemId).to.be.eq.BN(itemId0)
        expect(logs[0].args._price).to.be.eq.BN(web3.utils.toBN(0))
        expect(logs[0].args._beneficiary).to.be.equal(ZERO_ADDRESS)

        item = await collectionContract.items(itemId0)
        expect([
          item.maxSupply.toString(),
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
        let item = await collectionContract.items(itemId0)
        expect([
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql(item0)

        const newItemPrice0 = web3.utils.toWei('1')
        const newItemBeneficiary0 = anotherHolder
        const { logs } = await collectionContract.editItems(
          [itemId0],
          [newItemPrice0],
          [newItemBeneficiary0],
          fromCreator
        )

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('UpdateItem')
        expect(logs[0].args._itemId).to.be.eq.BN(itemId0)
        expect(logs[0].args._price).to.be.eq.BN(newItemPrice0)
        expect(logs[0].args._beneficiary).to.be.equal(newItemBeneficiary0)

        item = await collectionContract.items(itemId0)
        expect([
          item.maxSupply.toString(),
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

      it('should allow managers to edit items', async function () {
        await collectionContract.setManagers([manager], [true], fromCreator)

        await collectionContract.editItems(
          [itemId0],
          [itemPrice0],
          [itemBeneficiary0],
          fromManager
        )
      })

      it('should allow the creator to edit items', async function () {
        await collectionContract.editItems(
          [itemId0],
          [itemPrice0],
          [itemBeneficiary0],
          fromCreator
        )
      })

      it('reverts when passing different length parameters', async function () {
        await assertRevert(
          collectionContract.editItems(
            [itemId0],
            [itemPrice0, itemPrice1],
            [itemBeneficiary0, itemBeneficiary1],
            fromCreator
          ),
          'ERC721BaseCollectionV2#editItems: LENGTH_MISSMATCH'
        )

        await assertRevert(
          collectionContract.editItems(
            [itemId0, itemId1],
            [itemPrice1],
            [itemBeneficiary0, itemBeneficiary1],
            fromCreator
          ),
          'ERC721BaseCollectionV2#editItems: LENGTH_MISSMATCH'
        )

        await assertRevert(
          collectionContract.editItems(
            [itemId0, itemId1],
            [itemPrice0, itemPrice1],
            [itemBeneficiary0],
            fromCreator
          ),
          'ERC721BaseCollectionV2#editItems: LENGTH_MISSMATCH'
        )
      })

      it('reverts when trying to edit by hacker', async function () {
        await assertRevert(
          collectionContract.editItems(
            [itemId0],
            [itemPrice0],
            [itemBeneficiary0],
            fromHacker
          ),
          'ERC721BaseCollectionV2#editItems: CALLER_IS_NOT_CREATOR_OR_MANAGER'
        )
      })

      it('reverts when trying to edit an invalid item', async function () {
        const itemLength = await collectionContract.itemsCount()
        await assertRevert(
          collectionContract.editItems(
            [itemLength],
            [itemPrice0],
            [itemBeneficiary0],
            fromCreator
          ),
          'ERC721BaseCollectionV2#editItems: ITEM_DOES_NOT_EXIST'
        )
      })

      it('reverts when trying to edit an item with price 0 and without beneficiary', async function () {
        const itemLength = await collectionContract.itemsCount()
        await assertRevert(
          collectionContract.editItems(
            [itemId0],
            [itemPrice0],
            [ZERO_ADDRESS],
            fromCreator
          ),
          'ERC721BaseCollectionV2#editItems: INVALID_PRICE_AND_BENEFICIARY'
        )
      })

      it('reverts when trying to edit an item without price but beneficiary', async function () {
        const itemLength = await collectionContract.itemsCount()
        await assertRevert(
          collectionContract.editItems(
            [itemId0],
            [0],
            [itemBeneficiary0],
            fromCreator
          ),
          'ERC721BaseCollectionV2#editItems: INVALID_PRICE_AND_BENEFICIARY'
        )
      })
    })

    xdescribe('rescueItems', function () {
      let itemId0
      let item0
      let itemId1
      let item1

      this.beforeEach(async () => {
        item0 = [
          '10',
          '0',
          web3.utils.toBN(10).toString(),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]

        item1 = [
          '10',
          '0',
          web3.utils.toBN(10).toString(),
          beneficiary,
          '1:turtle_mask:hat:female,male',
          EMPTY_HASH,
        ]
        await collectionContract.addItems([item0, item1], fromCreator)

        const itemLength = await collectionContract.itemsCount()

        itemId0 = itemLength.sub(web3.utils.toBN(2))
        itemId1 = itemLength.sub(web3.utils.toBN(1))
      })

      it('should rescue an item', async function () {
        const newContentHash = web3.utils.randomHex(32)
        const newMetadata = '1:crocodile_mask:earrings:female'

        let item = await collectionContract.items(itemId0)
        expect([
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql(item0)

        const { logs } = await collectionContract.rescueItems(
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

        item = await collectionContract.items(itemId0)
        expect([
          item.maxSupply.toString(),
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
        let item = await collectionContract.items(itemId0)
        expect([
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql(item0)

        item = await collectionContract.items(itemId1)
        expect([
          item.maxSupply.toString(),
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

        const { logs } = await collectionContract.rescueItems(
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

        item = await collectionContract.items(itemId0)
        expect([
          item.maxSupply.toString(),
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

        item = await collectionContract.items(itemId1)
        expect([
          item.maxSupply.toString(),
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
        let item = await collectionContract.items(itemId0)
        expect([
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql(item0)

        const newContentHash0 = web3.utils.randomHex(32)
        const { logs } = await collectionContract.rescueItems(
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

        item = await collectionContract.items(itemId0)
        expect([
          item.maxSupply.toString(),
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
        let item = await collectionContract.items(itemId0)
        expect([
          item.maxSupply.toString(),
          item.totalSupply.toString(),
          item.price.toString(),
          item.beneficiary,
          item.metadata,
          item.contentHash,
        ]).to.be.eql(item0)

        const newContentHash0 = web3.utils.randomHex(32)
        await collectionContract.rescueItems(
          [itemId0],
          [newContentHash0],
          [''],
          fromDeployer
        )

        item = await collectionContract.items(itemId0)
        expect([
          item.maxSupply.toString(),
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

        await collectionContract.rescueItems(
          [itemId0],
          [EMPTY_HASH],
          [''],
          fromDeployer
        )

        item = await collectionContract.items(itemId0)
        expect([
          item.maxSupply.toString(),
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
          collectionContract.rescueItems(
            [itemId0],
            [EMPTY_HASH, EMPTY_HASH],
            ['', ''],
            fromDeployer
          ),
          'ERC721BaseCollectionV2#rescueItems: LENGTH_MISSMATCH'
        )

        await assertRevert(
          collectionContract.rescueItems(
            [itemId0, itemId1],
            [EMPTY_HASH],
            ['', ''],
            fromDeployer
          ),
          'ERC721BaseCollectionV2#rescueItems: LENGTH_MISSMATCH'
        )

        await assertRevert(
          collectionContract.rescueItems(
            [itemId0, itemId1],
            [EMPTY_HASH, EMPTY_HASH],
            [''],
            fromDeployer
          ),
          'ERC721BaseCollectionV2#rescueItems: LENGTH_MISSMATCH'
        )
      })

      it('reverts when trying to edit by hacker', async function () {
        await assertRevert(
          collectionContract.rescueItems(
            [itemId0],
            [EMPTY_HASH],
            [''],
            fromHacker
          ),
          'Ownable: caller is not the owner'
        )
      })

      it('reverts when trying to edit an invalid item', async function () {
        const itemLength = await collectionContract.itemsCount()
        await assertRevert(
          collectionContract.rescueItems(
            [itemLength],
            [EMPTY_HASH],
            [''],
            fromDeployer
          ),
          'ERC721BaseCollectionV2#rescueItems: ITEM_DOES_NOT_EXIST'
        )
      })
    })

    xdescribe('issueToken', function () {})

    xdescribe('transferBatch', function () {
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

    xdescribe('setEditable', function () {
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

      it('reverts when trying to change values by hacker', async function () {
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

    xdescribe('setBaseURI', function () {
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

    xdescribe('completeCollection', function () {
      it('should complete collection', async function () {
        let isComplete = await collectionContract.isComplete()
        expect(isComplete).to.be.equal(false)

        const { logs } = await collectionContract.completeCollection(
          fromCreator
        )

        expect(logs.length).to.equal(1)
        expect(logs[0].event).to.equal('Complete')

        isComplete = await collectionContract.isComplete()
        expect(isComplete).to.be.equal(true)
      })

      it('should issue tokens after complete the collection', async function () {
        await collectionContract.completeCollection(fromCreator)

        await issueItem(collectionContract, holder, 0, fromCreator)
        await issueItem(collectionContract, anotherHolder, 0, fromCreator)
        await issueItem(collectionContract, anotherHolder, 1, fromCreator)
      })

      it('reverts when trying to add an item after the collection is completed', async function () {
        let isComplete = await collectionContract.isComplete()
        expect(isComplete).to.be.equal(false)

        await collectionContract.completeCollection(fromCreator)

        isComplete = await collectionContract.isComplete()
        expect(isComplete).to.be.equal(true)

        const newItem = [
          '10',
          '0',
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]
        await assertRevert(
          collectionContract.addItems([newItem], fromCreator),
          'ERC721BaseCollectionV2#_addItem: COLLECTION_COMPLETED'
        )
      })

      it('reverts when completing collection twice', async function () {
        await collectionContract.completeCollection(fromCreator)

        await assertRevert(
          collectionContract.completeCollection(fromCreator),
          'ERC721BaseCollectionV2#completeCollection: COLLECTION_ALREADY_COMPLETED'
        )
      })

      it('reverts when completing collection by other than the creator', async function () {
        await assertRevert(
          collectionContract.completeCollection(fromDeployer),
          'ERC721BaseCollectionV2#onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          collectionContract.completeCollection(fromManager),
          'ERC721BaseCollectionV2#onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          collectionContract.completeCollection(fromMinter),
          'ERC721BaseCollectionV2#onlyCreator: CALLER_IS_NOT_CREATOR'
        )

        await assertRevert(
          collectionContract.completeCollection(fromHacker),
          'ERC721BaseCollectionV2#onlyCreator: CALLER_IS_NOT_CREATOR'
        )
      })
    })
  })
}
