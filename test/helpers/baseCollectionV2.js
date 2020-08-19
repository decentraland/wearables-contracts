import assertRevert from './assertRevert'
import { setupWearables, ZERO_ADDRESS, BASE_URI as URI } from './collection'

const BN = web3.utils.BN
const expect = require('chai').use(require('bn-chai')(BN)).expect

let BASE_URI = URI

export function doTest(
  Contract,
  contractName,
  contractSymbol,
  wearables,
  issueWearable,
  afterEach = () => ({}),
  tokenIds = [0, 1, 2]
) {
  describe('Base Collection', function () {
    this.timeout(100000)

    let creationParams

    //wearable
    const wearable0 = wearables[0].name
    const wearable1 = wearables[1].name
    const wearable2 = wearables[2].name
    const wearable0Hash = web3.utils.soliditySha3(wearable0)
    const wearable1Hash = web3.utils.soliditySha3(wearable1)
    const wearable2Hash = web3.utils.soliditySha3(wearable2)
    const issuance1 = 10
    const newWearable1 = 'new_exclusive_wearable_1'
    const issuance2 = 10
    const newWearable2 = 'new_exclusive_wearable_2'
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
    let fromUser
    let fromHolder
    let fromHacker
    let fromDeployer

    // Contracts
    let contractInstance

    BASE_URI += `${contractName}/wearables/`

    beforeEach(async function () {
      // Create Listing environment
      accounts = await web3.eth.getAccounts()
      deployer = accounts[0]
      user = accounts[1]
      holder = accounts[2]
      anotherHolder = accounts[3]
      anotherUser = accounts[4]
      hacker = accounts[5]
      fromUser = { from: user }
      fromHolder = { from: holder }
      fromHacker = { from: hacker }

      fromDeployer = { from: deployer }

      creationParams = {
        ...fromDeployer,
        gas: 6e6,
        gasPrice: 21e9,
      }

      contractInstance = await Contract.new(
        contractName,
        contractSymbol,
        user,
        BASE_URI,
        creationParams
      )

      await setupWearables(contractInstance, wearables)

      await issueWearable(contractInstance, holder, 0, fromUser)
      await issueWearable(contractInstance, holder, 0, fromUser)
      await issueWearable(contractInstance, anotherHolder, 1, fromUser)
    })

    this.afterEach(async () => {
      afterEach()
    })

    describe('Constructor', function () {
      it('should be depoyed with valid arguments', async function () {
        const contract = await Contract.new(
          contractName,
          contractSymbol,
          user,
          BASE_URI,
          creationParams
        )

        const baseURI = await contract.baseURI()
        const allowed = await contract.allowed(user)
        const owner = await contract.owner()
        const name = await contract.name()
        const symbol = await contract.symbol()

        expect(BASE_URI).to.be.equal(baseURI)
        expect(allowed).to.be.equal(true)
        expect(owner).to.be.equal(deployer)
        expect(name).to.be.equal(contractName)
        expect(symbol).to.be.equal(contractSymbol)

        await setupWearables(contract)
        const wearableLength = await contract.wearablesCount()

        expect(wearables.length).to.be.eq.BN(wearableLength)

        for (let i = 0; i < wearableLength; i++) {
          const wearableId = await contract.wearables(i)
          const hash = await contract.getWearableKey(wearableId)
          const max = await contract.maxIssuance(hash)

          expect(wearables[i].name).to.be.equal(wearableId)
          expect(wearables[i].max).to.be.eq.BN(max)
        }
      })
    })

    describe('AddWearable', function () {
      it('should add wearable', async function () {
        const { logs } = await contractInstance.addWearable(
          newWearable1,
          issuance1
        )

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('AddWearable')
        expect(logs[0].args._wearableIdKey).to.be.equal(
          web3.utils.soliditySha3(newWearable1)
        )
        expect(logs[0].args._wearableId).to.be.equal(newWearable1)
        expect(logs[0].args._maxIssuance).to.be.eq.BN(issuance1)

        const totalWearables = await contractInstance.wearablesCount()

        const wearableId = await contractInstance.wearables(totalWearables - 1)
        const max = await contractInstance.maxIssuance(
          web3.utils.soliditySha3(wearableId)
        )
        expect(newWearable1).to.be.equal(wearableId)
        expect(issuance1).to.be.eq.BN(max)
      })

      it('should add a long wearable id', async function () {
        const { logs } = await contractInstance.addWearable(
          newLongWearable1,
          issuance1
        )

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('AddWearable')
        expect(logs[0].args._wearableIdKey).to.be.equal(
          web3.utils.soliditySha3(newLongWearable1)
        )
        expect(logs[0].args._wearableId).to.be.equal(newLongWearable1)
        expect(logs[0].args._maxIssuance).to.be.eq.BN(issuance1)
      })

      it('reverts if trying to modify an existing wearable', async function () {
        await assertRevert(
          contractInstance.addWearable(wearables[0].name, 10),
          'Can not modify an existing wearable'
        )
      })

      it('reverts if trying to add wearables with issuance of 0', async function () {
        await assertRevert(
          contractInstance.addWearable(newWearable1, 0),
          'Max issuance should be greater than 0'
        )
      })

      it('reverts if trying to add wearables by hacker', async function () {
        await assertRevert(
          contractInstance.addWearable(newWearable1, issuance1, fromHacker),
          'Ownable: caller is not the owner'
        )
      })
    })

    describe('AddWearables', function () {
      it('should add wearables', async function () {
        const { logs } = await contractInstance.addWearables(
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

        const totalWearables = await contractInstance.wearablesCount()

        let wearableId = await contractInstance.wearables(totalWearables - 2)
        let max = await contractInstance.maxIssuance(
          web3.utils.soliditySha3(wearableId)
        )
        expect(newWearable1).to.be.equal(wearableId)
        expect(issuance1).to.be.eq.BN(max)

        wearableId = await contractInstance.wearables(totalWearables - 1)
        max = await contractInstance.maxIssuance(
          web3.utils.soliditySha3(wearableId)
        )
        expect(newWearable2).to.be.equal(wearableId)
        expect(issuance2).to.be.eq.BN(max)
      })

      it('reverts if trying to modify an existing wearable', async function () {
        await assertRevert(
          contractInstance.addWearables(
            [web3.utils.fromAscii(wearables[0].name)],
            [10]
          ),
          'Can not modify an existing wearable'
        )
      })

      it('reverts if trying to add wearables with invalid argument length', async function () {
        await assertRevert(
          contractInstance.addWearables(
            [
              web3.utils.fromAscii(wearables[0].name),
              web3.utils.fromAscii(wearables[1].name),
            ],
            [10]
          ),
          'Parameters should have the same length'
        )

        await assertRevert(
          contractInstance.addWearables(
            [web3.utils.fromAscii(wearables[0].name)],
            [10, 20]
          ),
          'Parameters should have the same length'
        )
      })

      it('reverts if trying to add wearables with issuance of 0', async function () {
        await assertRevert(
          contractInstance.addWearables(
            [
              web3.utils.fromAscii(newWearable1),
              web3.utils.fromAscii(newWearable2),
            ],
            [0, 10]
          ),
          'Max issuance should be greater than 0'
        )

        await assertRevert(
          contractInstance.addWearables(
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
          contractInstance.addWearables(
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

    describe('TransferBatch', function () {
      it('should transfer in batch', async function () {
        let ownerToken1 = await contractInstance.ownerOf(token1)
        let ownerToken2 = await contractInstance.ownerOf(token2)
        expect(ownerToken1).to.be.equal(holder)
        expect(ownerToken2).to.be.equal(holder)

        const { logs } = await contractInstance.batchTransferFrom(
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

        ownerToken1 = await contractInstance.ownerOf(token1)
        ownerToken2 = await contractInstance.ownerOf(token2)
        expect(ownerToken1).to.be.equal(anotherHolder)
        expect(ownerToken2).to.be.equal(anotherHolder)
      })

      it('should safe transfer in batch', async function () {
        let ownerToken1 = await contractInstance.ownerOf(token1)
        let ownerToken2 = await contractInstance.ownerOf(token2)
        expect(ownerToken1).to.be.equal(holder)
        expect(ownerToken2).to.be.equal(holder)

        const { logs } = await contractInstance.safeBatchTransferFrom(
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

        ownerToken1 = await contractInstance.ownerOf(token1)
        ownerToken2 = await contractInstance.ownerOf(token2)
        expect(ownerToken1).to.be.equal(anotherHolder)
        expect(ownerToken2).to.be.equal(anotherHolder)
      })

      it('should safe transfer in batch by operator', async function () {
        let ownerToken1 = await contractInstance.ownerOf(token1)
        let ownerToken2 = await contractInstance.ownerOf(token2)
        expect(ownerToken1).to.be.equal(holder)
        expect(ownerToken2).to.be.equal(holder)

        await contractInstance.approve(hacker, token1, fromHolder)
        await contractInstance.approve(hacker, token2, fromHolder)

        const { logs } = await contractInstance.safeBatchTransferFrom(
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

        ownerToken1 = await contractInstance.ownerOf(token1)
        ownerToken2 = await contractInstance.ownerOf(token2)
        expect(ownerToken1).to.be.equal(anotherHolder)
        expect(ownerToken2).to.be.equal(anotherHolder)
      })

      it('should safe transfer in batch by approval for all', async function () {
        let ownerToken1 = await contractInstance.ownerOf(token1)
        let ownerToken2 = await contractInstance.ownerOf(token2)
        expect(ownerToken1).to.be.equal(holder)
        expect(ownerToken2).to.be.equal(holder)

        await contractInstance.setApprovalForAll(hacker, true, fromHolder)

        const { logs } = await contractInstance.safeBatchTransferFrom(
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

        ownerToken1 = await contractInstance.ownerOf(token1)
        ownerToken2 = await contractInstance.ownerOf(token2)
        expect(ownerToken1).to.be.equal(anotherHolder)
        expect(ownerToken2).to.be.equal(anotherHolder)
      })

      it('reverts when transfer in batch by unuthorized user', async function () {
        let ownerToken1 = await contractInstance.ownerOf(token1)
        let ownerToken2 = await contractInstance.ownerOf(token2)
        expect(ownerToken1).to.be.equal(holder)
        expect(ownerToken2).to.be.equal(holder)

        await assertRevert(
          contractInstance.batchTransferFrom(
            holder,
            anotherHolder,
            [token1, token2],
            fromHacker
          ),
          'ERC721: transfer caller is not owner nor approved'
        )

        await assertRevert(
          contractInstance.batchTransferFrom(
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
          contractInstance.batchTransferFrom(
            holder,
            ZERO_ADDRESS,
            [token1, token2],
            fromHolder
          ),
          'ERC721: transfer to the zero address'
        )
      })
    })

    describe('Owner', function () {
      it('should set Allowed user', async function () {
        let allowed = await contractInstance.allowed(user)
        expect(allowed).to.be.equal(true)

        const { logs } = await contractInstance.setAllowed(
          anotherUser,
          true,
          fromDeployer
        )

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('Allowed')
        expect(logs[0].args._operator).to.be.equal(anotherUser)
        expect(logs[0].args._allowed).to.be.equal(true)

        allowed = await contractInstance.allowed(anotherUser)
        expect(allowed).to.be.equal(true)
      })

      it('should remove Allowed user', async function () {
        let allowed = await contractInstance.allowed(user)
        expect(allowed).to.be.equal(true)

        const { logs } = await contractInstance.setAllowed(
          user,
          false,
          fromDeployer
        )

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('Allowed')
        expect(logs[0].args._operator).to.be.equal(user)
        expect(logs[0].args._allowed).to.be.equal(false)

        allowed = await contractInstance.allowed(user)
        expect(allowed).to.be.equal(false)
      })

      it('should set Base Uri user', async function () {
        const newBaseURI = 'https'

        let baseURI = await contractInstance.baseURI()
        expect(BASE_URI).to.be.equal(baseURI)

        const { logs } = await contractInstance.setBaseURI(
          newBaseURI,
          fromDeployer
        )

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('BaseURI')
        expect(logs[0].args._oldBaseURI).to.be.equal(BASE_URI)
        expect(logs[0].args._newBaseURI).to.be.equal(newBaseURI)

        baseURI = await contractInstance.baseURI()
        expect(newBaseURI).to.be.equal(baseURI)

        const uri = await contractInstance.tokenURI(token1)

        const wearableId = uri.split('/').pop()

        expect(uri).to.be.equal(`${newBaseURI}${wearable0}/${wearableId}`)
      })

      it('reverts when trying to change values by hacker', async function () {
        await assertRevert(
          contractInstance.setAllowed(user, true, fromHacker),
          'Ownable: caller is not the owner'
        )

        await assertRevert(
          contractInstance.setBaseURI('', fromHacker),
          'Ownable: caller is not the owner'
        )
      })

      it('reverts when trying to set an already allowed or not allowed user', async function () {
        await assertRevert(
          contractInstance.setAllowed(user, true, fromDeployer),
          'You should set a different value'
        )

        await assertRevert(
          contractInstance.setAllowed(anotherUser, false, fromDeployer),
          'You should set a different value'
        )
      })

      it('reverts when trying to set an already allowed or not allowed user', async function () {
        await assertRevert(
          contractInstance.setAllowed(ZERO_ADDRESS, true, fromDeployer),
          'Invalid address'
        )
      })
    })

    describe('Issuances', function () {
      it('should manage wearable', async function () {
        let issued = await contractInstance.issued(wearable0Hash)
        expect(issued).to.eq.BN(2)

        issued = await contractInstance.issued(wearable1Hash)
        expect(issued).to.eq.BN(1)
      })

      it('should reach wearable limit', async function () {
        const maxKind = await contractInstance.maxIssuance(wearable2Hash)

        for (let i = 0; i < maxKind.toNumber(); i++) {
          await issueWearable(contractInstance, holder, 2, fromUser)
        }

        const issued = await contractInstance.issued(wearable2Hash)

        expect(issued).to.eq.BN(maxKind)
      })

      it('should be issued with correct wearables and maximum', async function () {
        for (let { name, max } of wearables) {
          const maxKind = await contractInstance.maxIssuance(
            web3.utils.soliditySha3(name)
          )

          expect(maxKind).to.eq.BN(max)
        }
      })
    })

    describe('URI', function () {
      it('should issue tokens with correct URI', async function () {
        const uri = await contractInstance.tokenURI(token1)
        const owner = await contractInstance.ownerOf(token1)

        const wearableId = uri.split('/').pop()

        expect(uri).to.be.equal(`${BASE_URI}${wearable0}/${wearableId}`)
        expect(owner).to.be.equal(holder)
      })
    })

    describe('completeCollection', function () {
      it('should complete collection', async function () {
        let isComplete = await contractInstance.isComplete()
        expect(isComplete).to.be.equal(false)

        const { logs } = await contractInstance.completeCollection()

        expect(logs.length).to.equal(1)
        expect(logs[0].event).to.equal('Complete')

        isComplete = await contractInstance.isComplete()
        expect(isComplete).to.be.equal(true)
      })

      it('should issue tokens after complete the collection', async function () {
        await contractInstance.completeCollection()

        await issueWearable(contractInstance, holder, 0, fromUser)
        await issueWearable(contractInstance, anotherHolder, 0, fromUser)
        await issueWearable(contractInstance, anotherHolder, 1, fromUser)
      })

      it('reverts when trying to add a wearable after the collection is completed', async function () {
        let isComplete = await contractInstance.isComplete()
        expect(isComplete).to.be.equal(false)

        await contractInstance.addWearable(newWearable1, issuance1)

        await contractInstance.completeCollection()

        isComplete = await contractInstance.isComplete()
        expect(isComplete).to.be.equal(true)

        await assertRevert(
          contractInstance.addWearable(newWearable2, issuance2),
          'The collection is complete'
        )

        await assertRevert(
          contractInstance.addWearables(
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
        await contractInstance.completeCollection()

        await assertRevert(
          contractInstance.completeCollection(),
          'The collection is already completed'
        )
      })

      it('reverts when completing collection by hacker', async function () {
        await contractInstance.completeCollection()

        await assertRevert(
          contractInstance.completeCollection(fromUser),
          'Ownable: caller is not the owner'
        )

        await assertRevert(
          contractInstance.completeCollection(fromHacker),
          'Ownable: caller is not the owner'
        )
      })
    })
  })
}
