import assertRevert from './helpers/assertRevert'
import { doTest } from './helpers/baseCollection'
import {
  CONTRACT_NAME,
  CONTRACT_SYMBOL,
  WEARABLES,
  setupWearables,
  ZERO_ADDRESS,
  BASE_URI as URI,
} from './helpers/collection'

const ERC721Collection = artifacts.require('ERC721Collection')

async function issueWearable(contract, beneficiary, index, from) {
  return contract.issueToken(beneficiary, WEARABLES[index].name, from)
}

describe('Collection', function () {
  doTest(
    ERC721Collection,
    CONTRACT_NAME,
    CONTRACT_SYMBOL,
    WEARABLES,
    issueWearable
  )

  describe('Issuance', function () {
    // Wearables
    const wearable0 = WEARABLES[0].name
    const wearable1 = WEARABLES[1].name
    const wearable2 = WEARABLES[2].name
    const wearable0Hash = web3.utils.soliditySha3(wearable0)
    const wearable1Hash = web3.utils.soliditySha3(wearable1)
    const wearable2Hash = web3.utils.soliditySha3(wearable2)
    const invalidWearable = 'invalid_wearable'

    const BASE_URI = URI + `${CONTRACT_NAME}/wearables/`

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

      contractInstance = await ERC721Collection.new(
        CONTRACT_NAME,
        CONTRACT_SYMBOL,
        user,
        BASE_URI,
        {
          ...fromDeployer,
          gas: 6e6,
          gasPrice: 21e9,
        }
      )

      await setupWearables(contractInstance, WEARABLES)
    })

    describe('issueToken', function () {
      it('should issue a token', async function () {
        const { logs } = await contractInstance.issueToken(
          anotherHolder,
          wearable0,
          fromUser
        )
        // match issued
        const issued = await contractInstance.issued(wearable0Hash)
        expect(issued).to.eq.BN(1)
        const totalSupply = await contractInstance.totalSupply()
        expect(logs.length).to.be.equal(2)
        expect(logs[1].event).to.be.equal('Issue')
        expect(logs[1].args._beneficiary).to.be.equal(anotherHolder)
        expect(logs[1].args._tokenId).to.be.eq.BN(totalSupply.toNumber() - 1)
        expect(logs[1].args._wearableIdKey).to.be.equal(wearable0Hash)
        expect(logs[1].args._wearableId).to.be.equal(wearable0)
        expect(logs[1].args._issuedId).to.eq.BN(issued)

        // match owner
        const owner = await contractInstance.ownerOf(totalSupply.toNumber() - 1)
        expect(owner).to.be.equal(anotherHolder)

        // match wearable id
        const uri = await contractInstance.tokenURI(totalSupply.toNumber() - 1)
        expect(issued).to.eq.BN(uri.split('/').pop())
      })

      it('reverts when issuing a token by not allowed user', async function () {
        await assertRevert(
          contractInstance.issueToken(anotherHolder, wearable0, fromHacker),
          'Only an `allowed` address can issue tokens'
        )
        await assertRevert(
          contractInstance.issueToken(anotherHolder, wearable0),
          'Only an `allowed` address can issue tokens'
        )
      })

      it('reverts when issuing a token to an invalid address', async function () {
        await assertRevert(
          contractInstance.issueToken(ZERO_ADDRESS, wearable0, fromUser),
          'ERC721: mint to the zero address'
        )
      })

      it('reverts when issuing an invalid wearable', async function () {
        await assertRevert(
          contractInstance.issueToken(anotherHolder, invalidWearable, fromUser),
          'invalid: trying to issue an exhausted wearable of nft'
        )
      })

      it('reverts when trying to issue a full wearable', async function () {
        const maxKind = await contractInstance.maxIssuance(wearable2Hash)

        for (let i = 0; i < maxKind.toNumber(); i++) {
          await contractInstance.issueToken(holder, wearable2, fromUser)
        }

        const issued = await contractInstance.issued(wearable2Hash)

        expect(issued).to.eq.BN(maxKind)

        await assertRevert(
          contractInstance.issueToken(holder, wearable2, fromUser),
          'invalid: trying to issue an exhausted wearable of nft'
        )
      })
    })

    describe('issueTokens', function () {
      it('should issue multiple token', async function () {
        const { logs } = await contractInstance.issueTokens(
          [holder, anotherHolder],
          [web3.utils.fromAscii(wearable1), web3.utils.fromAscii(wearable0)],
          fromUser
        )

        // Wearable1
        // match issued
        let issued = await contractInstance.issued(wearable1Hash)
        expect(issued).to.eq.BN(1)
        const totalSupply = await contractInstance.totalSupply()
        expect(logs.length).to.be.equal(4)
        expect(logs[1].event).to.be.equal('Issue')
        expect(logs[1].args._beneficiary).to.be.equal(holder)
        expect(logs[1].args._tokenId).to.be.eq.BN(totalSupply.toNumber() - 2)
        expect(logs[1].args._wearableIdKey).to.be.equal(wearable1Hash)
        expect(logs[1].args._wearableId).to.be.equal(wearable1)
        expect(logs[1].args._issuedId).to.eq.BN(issued)

        // match owner
        let owner = await contractInstance.ownerOf(totalSupply.toNumber() - 2)
        expect(owner).to.be.equal(holder)
        // match wearable id
        let uri = await contractInstance.tokenURI(totalSupply.toNumber() - 2)
        expect(issued).to.eq.BN(uri.split('/').pop())

        // Wearable0
        // match issued
        issued = await contractInstance.issued(wearable0Hash)
        expect(issued).to.eq.BN(1)
        expect(logs[3].event).to.be.equal('Issue')
        expect(logs[3].args._beneficiary).to.be.equal(anotherHolder)
        expect(logs[3].args._tokenId).to.be.eq.BN(totalSupply.toNumber() - 1)
        expect(logs[3].args._wearableIdKey).to.be.equal(wearable0Hash)
        expect(logs[3].args._wearableId).to.be.equal(wearable0)
        expect(logs[3].args._issuedId).to.eq.BN(issued)

        // match owner
        owner = await contractInstance.ownerOf(totalSupply.toNumber() - 1)
        expect(owner).to.be.equal(anotherHolder)

        // match wearable id
        uri = await contractInstance.tokenURI(totalSupply.toNumber() - 1)
        expect(issued).to.eq.BN(uri.split('/').pop())
      })

      it('reverts when issuing a token by not allowed user', async function () {
        await assertRevert(
          contractInstance.issueTokens(
            [holder, anotherHolder],
            [web3.utils.fromAscii(wearable1), web3.utils.fromAscii(wearable0)],
            fromHacker
          ),
          'Only an `allowed` address can issue tokens'
        )
        await assertRevert(
          contractInstance.issueTokens(
            [holder, anotherHolder],
            [web3.utils.fromAscii(wearable1), web3.utils.fromAscii(wearable0)]
          ),
          'Only an `allowed` address can issue tokens'
        )
      })

      it('reverts if trying to issue tokens with invalid argument length', async function () {
        await assertRevert(
          contractInstance.issueTokens(
            [user],
            [
              web3.utils.fromAscii(WEARABLES[0].name),
              web3.utils.fromAscii(WEARABLES[1].name),
            ],
            fromUser
          ),
          'Parameters should have the same length'
        )
        await assertRevert(
          contractInstance.issueTokens(
            [user, anotherUser],
            [web3.utils.fromAscii(WEARABLES[0].name)],
            fromUser
          ),
          'Parameters should have the same length'
        )
      })

      it('reverts when issuing a token to an invalid address', async function () {
        await assertRevert(
          contractInstance.issueTokens(
            [anotherHolder, ZERO_ADDRESS],
            [web3.utils.fromAscii(wearable1), web3.utils.fromAscii(wearable0)],
            fromUser
          ),
          'ERC721: mint to the zero address'
        )
      })

      it('reverts when issuing an invalid wearable', async function () {
        await assertRevert(
          contractInstance.issueTokens(
            [anotherHolder, anotherHolder],
            [
              web3.utils.fromAscii(invalidWearable),
              web3.utils.fromAscii(wearable0),
            ],
            fromUser
          ),
          'invalid: trying to issue an exhausted wearable of nft'
        )
      })
    })
  })
})
