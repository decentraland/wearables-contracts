import assertRevert from './assertRevert'
import { EMPTY_HASH, ZERO_ADDRESS, BASE_URI as URI } from './collectionV2'

const BN = web3.utils.BN
const expect = require('chai').use(require('bn-chai')(BN)).expect

let BASE_URI = URI

export function doTest(
  Contract,
  createContract,
  contractName,
  contractSymbol,
  items,
  issueWearable,
  afterEach = () => ({}),
  tokenIds = [0, 1, 2]
) {
  describe('Base Collection', function () {
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
    let fromUser
    let fromHolder
    let fromHacker
    let fromDeployer
    let fromCreator

    // Contracts
    let collectionContract

    BASE_URI += `${contractName}/items/`

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
      fromUser = { from: user }
      fromHolder = { from: holder }
      fromHacker = { from: hacker }
      fromCreator = { from: creator }

      fromDeployer = { from: deployer }

      creationParams = {
        ...fromDeployer,
        gas: 6e6,
        gasPrice: 21e9,
      }

      collectionContract = await createContract(creator, creationParams)
      //collectionContract.setMinter(minter, true, from)
    })

    this.afterEach(async () => {
      afterEach()
    })

    describe('Initialize', function () {
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

    describe('AddItem', function () {
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
        const { logs } = await collectionContract.addItem(newItem, fromCreator)

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

      it('reverts if trying to add an item with current supply > 0', async function () {
        const newItem = [
          '10',
          '1',
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]
        await assertRevert(
          collectionContract.addItem(newItem, fromCreator),
          'ERC721BaseCollectionV2#addItem: INVALID_TOTAL_SUPPLY'
        )
      })

      it('reverts if trying to add an item with max supply = 0 or greather than MAX_SUPPLY', async function () {
        let newItem = [
          '0',
          '0',
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]

        await assertRevert(
          collectionContract.addItem(newItem, fromCreator),
          'ERC721BaseCollectionV2#addItem: INVALID_MAX_SUPPLY'
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
          collectionContract.addItem(newItem, fromCreator),
          'ERC721BaseCollectionV2#addItem: INVALID_MAX_SUPPLY'
        )
      })

      it('reverts if trying to add an item with price and no beneficiary', async function () {
        const newItem = [
          '10',
          '0',
          web3.utils.toWei('10'),
          ZERO_ADDRESS,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]
        await assertRevert(
          collectionContract.addItem(newItem, fromCreator),
          'ERC721BaseCollectionV2#addItem: MISSING_BENEFICIARY'
        )
      })

      it('reverts if trying to add an item by hacker', async function () {
        const newItem = [
          '10',
          '0',
          web3.utils.toWei('10'),
          beneficiary,
          '1:crocodile_mask:hat:female,male',
          EMPTY_HASH,
        ]

        await assertRevert(
          collectionContract.addItem(newItem, fromHacker),
          'ERC721BaseCollectionV2#onlyMinter: CALLER_IS_NOT_CREATOR'
        )
      })
    })

    xdescribe('AddWearables', function () {
      it('should add wearables', async function () {
        const { logs } = await collectionContract.addWearables(
          [
            web3.utils.fromAscii(newWearable1),
            web3.utils.fromAscii(newWearable2),
          ],
          [issuance1, issuance2]
        )

        expect(logs.length).to.be.equal(2)
        expect(logs[0].event).to.be.equal('AddWearable')
        expect(logs[0].args._wearableIdKey).to.be.equal(
          web3.utils.soliditySha3(newWearable1)
        )
        expect(logs[0].args._wearableId).to.be.equal(newWearable1)
        expect(logs[0].args._maxIssuance).to.be.eq.BN(issuance1)

        expect(logs[1].event).to.be.equal('AddWearable')
        expect(logs[1].args._wearableIdKey).to.be.equal(
          web3.utils.soliditySha3(newWearable2)
        )
        expect(logs[1].args._wearableId).to.be.equal(newWearable2)
        expect(logs[1].args._maxIssuance).to.be.eq.BN(issuance2)

        const totalWearables = await collectionContract.wearablesCount()

        let wearableId = await collectionContract.wearables(totalWearables - 2)
        let max = await collectionContract.maxIssuance(
          web3.utils.soliditySha3(wearableId)
        )
        expect(newWearable1).to.be.equal(wearableId)
        expect(issuance1).to.be.eq.BN(max)

        wearableId = await collectionContract.wearables(totalWearables - 1)
        max = await collectionContract.maxIssuance(
          web3.utils.soliditySha3(wearableId)
        )
        expect(newWearable2).to.be.equal(wearableId)
        expect(issuance2).to.be.eq.BN(max)
      })

      it('reverts if trying to modify an existing wearable', async function () {
        await assertRevert(
          collectionContract.addWearables(
            [web3.utils.fromAscii(wearables[0].name)],
            [10]
          ),
          'Can not modify an existing wearable'
        )
      })

      it('reverts if trying to add wearables with invalid argument length', async function () {
        await assertRevert(
          collectionContract.addWearables(
            [
              web3.utils.fromAscii(wearables[0].name),
              web3.utils.fromAscii(wearables[1].name),
            ],
            [10]
          ),
          'Parameters should have the same length'
        )

        await assertRevert(
          collectionContract.addWearables(
            [web3.utils.fromAscii(wearables[0].name)],
            [10, 20]
          ),
          'Parameters should have the same length'
        )
      })

      it('reverts if trying to add wearables with issuance of 0', async function () {
        await assertRevert(
          collectionContract.addWearables(
            [
              web3.utils.fromAscii(newWearable1),
              web3.utils.fromAscii(newWearable2),
            ],
            [0, 10]
          ),
          'Max issuance should be greater than 0'
        )

        await assertRevert(
          collectionContract.addWearables(
            [
              web3.utils.fromAscii(newWearable1),
              web3.utils.fromAscii(newWearable2),
            ],
            [10, 0]
          ),
          'Max issuance should be greater than 0'
        )
      })

      it('reverts if trying to add wearables by hacker', async function () {
        await assertRevert(
          collectionContract.addWearables(
            [
              web3.utils.fromAscii(newWearable1),
              web3.utils.fromAscii(newWearable2),
            ],
            [issuance1, issuance2],
            fromHacker
          ),
          'Ownable: caller is not the owner'
        )
      })
    })

    xdescribe('TransferBatch', function () {
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

    xdescribe('Owner', function () {
      it('should set Allowed user', async function () {
        let allowed = await collectionContract.allowed(user)
        expect(allowed).to.be.equal(true)

        const { logs } = await collectionContract.setAllowed(
          anotherUser,
          true,
          fromDeployer
        )

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('Allowed')
        expect(logs[0].args._operator).to.be.equal(anotherUser)
        expect(logs[0].args._allowed).to.be.equal(true)

        allowed = await collectionContract.allowed(anotherUser)
        expect(allowed).to.be.equal(true)
      })

      it('should remove Allowed user', async function () {
        let allowed = await collectionContract.allowed(user)
        expect(allowed).to.be.equal(true)

        const { logs } = await collectionContract.setAllowed(
          user,
          false,
          fromDeployer
        )

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('Allowed')
        expect(logs[0].args._operator).to.be.equal(user)
        expect(logs[0].args._allowed).to.be.equal(false)

        allowed = await collectionContract.allowed(user)
        expect(allowed).to.be.equal(false)
      })

      it('should set Base Uri user', async function () {
        const newBaseURI = 'https'

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

        const wearableId = uri.split('/').pop()

        expect(uri).to.be.equal(`${newBaseURI}${wearable0}/${wearableId}`)
      })

      it('reverts when trying to change values by hacker', async function () {
        await assertRevert(
          collectionContract.setAllowed(user, true, fromHacker),
          'Ownable: caller is not the owner'
        )

        await assertRevert(
          collectionContract.setBaseURI('', fromHacker),
          'Ownable: caller is not the owner'
        )
      })

      it('reverts when trying to set an already allowed or not allowed user', async function () {
        await assertRevert(
          collectionContract.setAllowed(user, true, fromDeployer),
          'You should set a different value'
        )

        await assertRevert(
          collectionContract.setAllowed(anotherUser, false, fromDeployer),
          'You should set a different value'
        )
      })

      it('reverts when trying to set an already allowed or not allowed user', async function () {
        await assertRevert(
          collectionContract.setAllowed(ZERO_ADDRESS, true, fromDeployer),
          'Invalid address'
        )
      })
    })

    xdescribe('Issuances', function () {
      it('should manage wearable', async function () {
        let issued = await collectionContract.issued(wearable0Hash)
        expect(issued).to.eq.BN(2)

        issued = await collectionContract.issued(wearable1Hash)
        expect(issued).to.eq.BN(1)
      })

      it('should reach wearable limit', async function () {
        const maxKind = await collectionContract.maxIssuance(wearable2Hash)

        for (let i = 0; i < maxKind.toNumber(); i++) {
          await issueWearable(collectionContract, holder, 2, fromUser)
        }

        const issued = await collectionContract.issued(wearable2Hash)

        expect(issued).to.eq.BN(maxKind)
      })

      it('should be issued with correct wearables and maximum', async function () {
        for (let { name, max } of wearables) {
          const maxKind = await collectionContract.maxIssuance(
            web3.utils.soliditySha3(name)
          )

          expect(maxKind).to.eq.BN(max)
        }
      })
    })

    xdescribe('URI', function () {
      it('should issue tokens with correct URI', async function () {
        const uri = await collectionContract.tokenURI(token1)
        const owner = await collectionContract.ownerOf(token1)

        const wearableId = uri.split('/').pop()

        expect(uri).to.be.equal(`${BASE_URI}${wearable0}/${wearableId}`)
        expect(owner).to.be.equal(holder)
      })
    })

    xdescribe('completeCollection', function () {
      it('should complete collection', async function () {
        let isComplete = await collectionContract.isComplete()
        expect(isComplete).to.be.equal(false)

        const { logs } = await collectionContract.completeCollection()

        expect(logs.length).to.equal(1)
        expect(logs[0].event).to.equal('Complete')

        isComplete = await collectionContract.isComplete()
        expect(isComplete).to.be.equal(true)
      })

      it('should issue tokens after complete the collection', async function () {
        await collectionContract.completeCollection()

        await issueWearable(collectionContract, holder, 0, fromUser)
        await issueWearable(collectionContract, anotherHolder, 0, fromUser)
        await issueWearable(collectionContract, anotherHolder, 1, fromUser)
      })

      it('reverts when trying to add a wearable after the collection is completed', async function () {
        let isComplete = await collectionContract.isComplete()
        expect(isComplete).to.be.equal(false)

        await collectionContract.addWearable(newWearable1, issuance1)

        await collectionContract.completeCollection()

        isComplete = await collectionContract.isComplete()
        expect(isComplete).to.be.equal(true)

        await assertRevert(
          collectionContract.addWearable(newWearable2, issuance2),
          'The collection is complete'
        )

        await assertRevert(
          collectionContract.addWearables(
            [
              web3.utils.fromAscii(newWearable1),
              web3.utils.fromAscii(newWearable2),
            ],
            [issuance1, issuance2]
          ),
          'The collection is complete'
        )
      })

      it('reverts when completing collection twice', async function () {
        await collectionContract.completeCollection()

        await assertRevert(
          collectionContract.completeCollection(),
          'The collection is already completed'
        )
      })

      it('reverts when completing collection by hacker', async function () {
        await collectionContract.completeCollection()

        await assertRevert(
          collectionContract.completeCollection(fromUser),
          'Ownable: caller is not the owner'
        )

        await assertRevert(
          collectionContract.completeCollection(fromHacker),
          'Ownable: caller is not the owner'
        )
      })
    })
  })
}
