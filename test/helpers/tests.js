import assertRevert from './assertRevert'

const BN = web3.utils.BN
const expect = require('chai').use(require('bn-chai')(BN)).expect

let BASE_URI = 'https://api-wearables.decentraland.org/v1/collections/'

export function testContract(Contract, contractName, contractSymbol, kinds) {
  describe('ExclusiveTokens', function() {
    this.timeout(100000)

    let creationParams

    //kind
    const kind1 = kinds[0].name
    const kind2 = kinds[1].name
    const kind3 = kinds[2].name
    const kind1Hash = web3.utils.soliditySha3(kind1)
    const kind2Hash = web3.utils.soliditySha3(kind2)
    const kind3Hash = web3.utils.soliditySha3(kind3)

    // tokens
    const token1 = 0
    const token2 = 1
    const token3 = 2

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

    beforeEach(async function() {
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
        gasPrice: 21e9
      }

      contractInstance = await Contract.new(user, BASE_URI, creationParams)

      await contractInstance.issueToken(holder, kind1, fromUser)
      await contractInstance.issueToken(holder, kind1, fromUser)
      await contractInstance.issueToken(anotherHolder, kind2, fromUser)
    })

    describe('Constructor', function() {
      it('should be depoyed with valid arguments', async function() {
        const contract = await Contract.new(user, BASE_URI, creationParams)

        const baseURI = await contract.baseURI()
        const allowed = await contract.allowed()
        const owner = await contract.owner()
        const name = await contract.name()
        const symbol = await contract.symbol()

        expect(BASE_URI).to.be.equal(baseURI)
        expect(user).to.be.equal(allowed)
        expect(owner).to.be.equal(deployer)
        expect(name).to.be.equal(contractName)
        expect(symbol).to.be.equal(contractSymbol)
      })
    })

    describe('Create', function() {
      it('should create a token', async function() {
        const { logs } = await contractInstance.issueToken(
          anotherHolder,
          kind3,
          fromUser
        )

        // match issued
        const issued = await contractInstance.issued(kind3Hash)
        expect(issued).to.eq.BN(1)

        const totalSupply = await contractInstance.totalSupply()

        expect(logs.length).to.be.equal(2)
        expect(logs[1].event).to.be.equal('Issue')
        expect(logs[1].args._beneficiary).to.be.equal(anotherHolder)
        expect(logs[1].args._tokenId).to.be.eq.BN(totalSupply.toNumber() - 1)
        expect(logs[1].args._wearableId).to.be.equal(kind3Hash)
        expect(logs[1].args._issuedId).to.eq.BN(issued)

        // match owner
        const owner = await contractInstance.ownerOf(totalSupply.toNumber() - 1)

        expect(owner).to.be.equal(anotherHolder)

        // match kind id
        const uri = await contractInstance.tokenURI(totalSupply.toNumber() - 1)
        expect(issued).to.eq.BN(uri.split('/').pop())
      })

      it('reverts when creating a token by not allowed user', async function() {
        await assertRevert(
          contractInstance.issueToken(anotherHolder, kind3, fromHacker),
          'Only the `allowed` address can create tokens'
        )
      })
    })

    describe('TransferBatch', function() {
      it('should transfer in batch', async function() {
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

        expect(logs.length).to.be.equal(2)
        expect(logs[0].event).to.be.equal('Transfer')
        expect(logs[0].args.from).to.be.equal(holder)
        expect(logs[0].args.to).to.be.equal(anotherHolder)
        expect(logs[0].args.tokenId).to.eq.BN(token1)

        expect(logs[1].event).to.be.equal('Transfer')
        expect(logs[1].args.from).to.be.equal(holder)
        expect(logs[1].args.to).to.be.equal(anotherHolder)
        expect(logs[1].args.tokenId).to.eq.BN(token2)

        ownerToken1 = await contractInstance.ownerOf(token1)
        ownerToken2 = await contractInstance.ownerOf(token2)
        expect(ownerToken1).to.be.equal(anotherHolder)
        expect(ownerToken2).to.be.equal(anotherHolder)
      })

      it('should safe transfer in batch', async function() {
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

        expect(logs.length).to.be.equal(2)
        expect(logs[0].event).to.be.equal('Transfer')
        expect(logs[0].args.from).to.be.equal(holder)
        expect(logs[0].args.to).to.be.equal(anotherHolder)
        expect(logs[0].args.tokenId).to.eq.BN(token1)

        expect(logs[1].event).to.be.equal('Transfer')
        expect(logs[1].args.from).to.be.equal(holder)
        expect(logs[1].args.to).to.be.equal(anotherHolder)
        expect(logs[1].args.tokenId).to.eq.BN(token2)

        ownerToken1 = await contractInstance.ownerOf(token1)
        ownerToken2 = await contractInstance.ownerOf(token2)
        expect(ownerToken1).to.be.equal(anotherHolder)
        expect(ownerToken2).to.be.equal(anotherHolder)
      })

      it('should safe transfer in batch by operator', async function() {
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

        expect(logs.length).to.be.equal(2)
        expect(logs[0].event).to.be.equal('Transfer')
        expect(logs[0].args.from).to.be.equal(holder)
        expect(logs[0].args.to).to.be.equal(anotherHolder)
        expect(logs[0].args.tokenId).to.eq.BN(token1)

        expect(logs[1].event).to.be.equal('Transfer')
        expect(logs[1].args.from).to.be.equal(holder)
        expect(logs[1].args.to).to.be.equal(anotherHolder)
        expect(logs[1].args.tokenId).to.eq.BN(token2)

        ownerToken1 = await contractInstance.ownerOf(token1)
        ownerToken2 = await contractInstance.ownerOf(token2)
        expect(ownerToken1).to.be.equal(anotherHolder)
        expect(ownerToken2).to.be.equal(anotherHolder)
      })

      it('should safe transfer in batch by approval for all', async function() {
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

        expect(logs.length).to.be.equal(2)
        expect(logs[0].event).to.be.equal('Transfer')
        expect(logs[0].args.from).to.be.equal(holder)
        expect(logs[0].args.to).to.be.equal(anotherHolder)
        expect(logs[0].args.tokenId).to.eq.BN(token1)

        expect(logs[1].event).to.be.equal('Transfer')
        expect(logs[1].args.from).to.be.equal(holder)
        expect(logs[1].args.to).to.be.equal(anotherHolder)
        expect(logs[1].args.tokenId).to.eq.BN(token2)

        ownerToken1 = await contractInstance.ownerOf(token1)
        ownerToken2 = await contractInstance.ownerOf(token2)
        expect(ownerToken1).to.be.equal(anotherHolder)
        expect(ownerToken2).to.be.equal(anotherHolder)
      })

      it('reverts when transfer in batch by unuthorized user', async function() {
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
    })

    describe('Owner', function() {
      it('should set Allowed user', async function() {
        let allowed = await contractInstance.allowed()
        expect(user).to.be.equal(allowed)

        const { logs } = await contractInstance.setAllowed(
          anotherUser,
          fromDeployer
        )

        expect(logs.length).to.be.equal(1)
        expect(logs[0].event).to.be.equal('Allowed')
        expect(logs[0].args._oldAllowed).to.be.equal(user)
        expect(logs[0].args._newAllowed).to.be.equal(anotherUser)

        allowed = await contractInstance.allowed()
        expect(anotherUser).to.be.equal(allowed)
      })

      it('should set Base Uri user', async function() {
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

        const kindId = uri.split('/').pop()

        expect(uri).to.be.equal(`${newBaseURI}${kind1}/${kindId}`)
      })

      it('reverts when not the owner try to change values', async function() {
        await assertRevert(
          contractInstance.setAllowed(user, fromHacker),
          'Ownable: caller is not the owner'
        )

        await assertRevert(
          contractInstance.setBaseURI('', fromHacker),
          'Ownable: caller is not the owner'
        )
      })
    })

    describe('Kinds', function() {
      it('should manage kind', async function() {
        let issued = await contractInstance.issued(kind1Hash)
        expect(issued).to.eq.BN(2)

        issued = await contractInstance.issued(kind2Hash)
        expect(issued).to.eq.BN(1)
      })

      it('should reach kind limit', async function() {
        const maxKind = await contractInstance.maxIssuance(kind3Hash)

        for (let i = 0; i < maxKind.toNumber(); i++) {
          await contractInstance.issueToken(holder, kind3, fromUser)
        }

        const issued = await contractInstance.issued(kind3Hash)

        expect(issued).to.eq.BN(maxKind)

        await assertRevert(
          contractInstance.issueToken(holder, kind3, fromUser),
          'invalid: trying to issue an exhausted kind of nft'
        )
      })

      it('should be created with correct kinds and maximum', async function() {
        for (let { name, max } of kinds) {
          const maxKind = await contractInstance.maxIssuance(
            web3.utils.soliditySha3(name)
          )

          expect(maxKind).to.eq.BN(max)
        }
      })

      it('reverts when create an invalid kind', async function() {
        await assertRevert(
          contractInstance.issueToken(holder, kind3 + 'a', fromUser),
          'invalid: trying to issue an exhausted kind of nft'
        )
      })
    })

    describe('URI', function() {
      it('should create tokens with correct URI', async function() {
        const uri = await contractInstance.tokenURI(token1)
        const owner = await contractInstance.ownerOf(token1)

        const kindId = uri.split('/').pop()

        expect(uri).to.be.equal(`${BASE_URI}${kind1}/${kindId}`)
        expect(owner).to.be.equal(holder)
      })
    })
  })
}
