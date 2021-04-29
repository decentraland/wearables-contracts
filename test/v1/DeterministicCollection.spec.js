import assertRevert from '../helpers/assertRevert'
import { doTest } from '../helpers/baseCollection'
import {
  CONTRACT_NAME,
  CONTRACT_SYMBOL,
  WEARABLES,
  setupWearables,
  ZERO_ADDRESS,
  BASE_URI as URI,
} from '../helpers/collection'

const BN = web3.utils.BN
const expect = require('chai').use(require('bn-chai')(BN)).expect

const ERC721DeterministicCollection = artifacts.require(
  'DummyERC721DeterministicCollection'
)

let wearables = WEARABLES.map((w) => ({ ...w, issued: 1 }))

function cleanIssuances() {
  wearables = WEARABLES.map((w) => ({ ...w, issued: 1 }))
}

function encodeTokenId(a, b) {
  return web3.utils.toBN(
    `0x${web3.utils.padLeft(a, 10).replace('0x', '')}${web3.utils
      .padLeft(b, 54)
      .replace('0x', '')}`
  )
}

function decodeTokenId(id) {
  const hexId = web3.utils.padLeft(web3.utils.toHex(id), 64).replace('0x', '')

  return [
    web3.utils.toBN(hexId.substr(0, 10)),
    web3.utils.toBN(hexId.substr(10, hexId.length)),
  ]
}

async function issueWearable(contract, beneficiary, index, from) {
  await contract.issueToken(beneficiary, index, wearables[index].issued, from)
  wearables[index].issued++
}

describe('Deterministic Collection', function () {
  // option id = 0
  // issued id = 1
  const token1 = encodeTokenId(0, 1)

  // option id = 0
  // issued id = 2
  const token2 = encodeTokenId(0, 2)

  // option id = 1
  // issued id = 1
  const token3 = encodeTokenId(1, 1)

  doTest(
    ERC721DeterministicCollection,
    CONTRACT_NAME,
    CONTRACT_SYMBOL,
    WEARABLES,
    issueWearable,
    cleanIssuances,
    [token1, token2, token3]
  )

  describe('Issuance', function () {
    // Wearables
    const wearable0 = WEARABLES[0].name
    const wearable1 = WEARABLES[1].name
    const wearable0Hash = web3.utils.soliditySha3(wearable0)
    const wearable1Hash = web3.utils.soliditySha3(wearable1)

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

      contractInstance = await ERC721DeterministicCollection.new(
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

    afterEach(async () => {
      cleanIssuances()
    })

    describe('issueToken', function () {
      it('should issue a token', async function () {
        const { logs } = await contractInstance.issueToken(
          anotherHolder,
          0,
          wearables[0].issued,
          fromUser
        )

        // match issued
        const issued = await contractInstance.issued(wearable0Hash)
        expect(issued).to.eq.BN(1)
        expect(logs.length).to.be.equal(2)
        expect(logs[1].event).to.be.equal('Issue')
        expect(logs[1].args._beneficiary).to.be.equal(anotherHolder)
        expect(logs[1].args._tokenId).to.be.eq.BN(token1)
        expect(logs[1].args._wearableIdKey).to.be.equal(wearable0Hash)
        expect(logs[1].args._wearableId).to.be.equal(wearable0)
        expect(logs[1].args._issuedId).to.eq.BN(issued)

        // match total supply
        const totalSupply = await contractInstance.totalSupply()
        expect(totalSupply).to.eq.BN(1)

        // match owner
        const owner = await contractInstance.ownerOf(token1)
        expect(owner).to.be.equal(anotherHolder)

        // match URI
        const uri = await contractInstance.tokenURI(token1)
        const uriArr = uri.split('/')
        expect(issued).to.eq.BN(uri.split('/')[uriArr.length - 1])
        expect(wearables[0].name).to.eq.BN(uri.split('/')[uriArr.length - 2])
      })

      it('should issue a deterministic token', async function () {
        // option id = 0
        // issued id = 10
        let tokenId = web3.utils.toBN(
          '0x000000000000000000000000000000000000000000000000000000000000000A'
        )

        const { logs } = await contractInstance.issueToken(
          anotherHolder,
          0,
          10,
          fromUser
        )

        // match issued
        const issued = await contractInstance.issued(wearable0Hash)
        expect(issued).to.eq.BN(1)
        expect(logs.length).to.be.equal(2)
        expect(logs[1].event).to.be.equal('Issue')
        expect(logs[1].args._beneficiary).to.be.equal(anotherHolder)
        expect(logs[1].args._tokenId).to.be.eq.BN(tokenId)
        expect(logs[1].args._wearableIdKey).to.be.equal(wearable0Hash)
        expect(logs[1].args._wearableId).to.be.equal(wearable0)
        expect(logs[1].args._issuedId).to.eq.BN(10)

        // match total supply
        const totalSupply = await contractInstance.totalSupply()
        expect(totalSupply).to.eq.BN(1)

        // match owner
        const owner = await contractInstance.ownerOf(tokenId)
        expect(owner).to.be.equal(anotherHolder)

        // match URI
        const uri = await contractInstance.tokenURI(tokenId)
        const uriArr = uri.split('/')
        expect(10).to.eq.BN(uri.split('/')[uriArr.length - 1])
        expect(wearables[0].name).to.be.equal(uri.split('/')[uriArr.length - 2])
      })

      it('reverts when issuing a token by not allowed user', async function () {
        await assertRevert(
          contractInstance.issueToken(
            anotherHolder,
            0,
            wearables[0].issued,
            fromHacker
          ),
          'Only an `allowed` address can issue tokens'
        )

        await assertRevert(
          contractInstance.issueToken(anotherHolder, 0, wearables[0].issued),
          'Only an `allowed` address can issue tokens'
        )
      })

      it('reverts when issuing a token to an invalid address', async function () {
        await assertRevert(
          contractInstance.issueToken(
            ZERO_ADDRESS,
            0,
            wearables[0].issued,
            fromUser
          ),
          'ERC721: mint to the zero address'
        )
      })

      it('reverts when trying to issue an already minted wearable', async function () {
        await contractInstance.issueToken(holder, 0, 1, fromUser)

        await assertRevert(
          contractInstance.issueToken(holder, 0, 1, fromUser),
          'ERC721: token already minted'
        )
      })

      it('reverts when trying to issue an invalid wearable option id', async function () {
        await assertRevert(
          contractInstance.issueToken(holder, wearables.length, 1, fromUser),
          'Invalid option id'
        )
      })

      it('reverts when trying to issue an invalid wearable issued id', async function () {
        await assertRevert(
          contractInstance.issueToken(
            holder,
            0,
            wearables[0].max + 1,
            fromUser
          ),
          'Invalid issued id'
        )
      })
    })

    describe('issueTokens', function () {
      it('should issue multiple token', async function () {
        const { logs } = await contractInstance.issueTokens(
          [holder, anotherHolder],
          [1, 0],
          [1, 1],
          fromUser
        )

        // Wearable1
        // match issued
        let issued = await contractInstance.issued(wearable1Hash)
        expect(issued).to.eq.BN(1)
        expect(logs.length).to.be.equal(4)
        expect(logs[1].event).to.be.equal('Issue')
        expect(logs[1].args._beneficiary).to.be.equal(holder)
        expect(logs[1].args._tokenId).to.be.eq.BN(token3)
        expect(logs[1].args._wearableIdKey).to.be.equal(wearable1Hash)
        expect(logs[1].args._wearableId).to.be.equal(wearable1)
        expect(logs[1].args._issuedId).to.eq.BN(issued)

        // match owner
        let owner = await contractInstance.ownerOf(token3)
        expect(owner).to.be.equal(holder)

        // match wearable id
        let uri = await contractInstance.tokenURI(token3)
        let uriArr = uri.split('/')
        expect(issued).to.eq.BN(uri.split('/')[uriArr.length - 1])
        expect(wearables[1].name).to.be.equal(uri.split('/')[uriArr.length - 2])

        // Wearable0
        // match issued
        issued = await contractInstance.issued(wearable0Hash)
        expect(issued).to.eq.BN(1)
        expect(logs[3].event).to.be.equal('Issue')
        expect(logs[3].args._beneficiary).to.be.equal(anotherHolder)
        expect(logs[3].args._tokenId).to.be.eq.BN(token1)
        expect(logs[3].args._wearableIdKey).to.be.equal(wearable0Hash)
        expect(logs[3].args._wearableId).to.be.equal(wearable0)
        expect(logs[3].args._issuedId).to.eq.BN(issued)

        // match owner
        owner = await contractInstance.ownerOf(token1)
        expect(owner).to.be.equal(anotherHolder)

        // match wearable id
        uri = await contractInstance.tokenURI(token1)
        uriArr = uri.split('/')
        expect(issued).to.eq.BN(uri.split('/')[uriArr.length - 1])
        expect(wearables[0].name).to.be.equal(uri.split('/')[uriArr.length - 2])

        // Match total supply
        const totalSupply = await contractInstance.totalSupply()
        expect(totalSupply).to.eq.BN(2)
      })

      it('reverts when issuing a token by not allowed user', async function () {
        await assertRevert(
          contractInstance.issueTokens(
            [holder, anotherHolder],
            [0, 0],
            [1, 2],
            fromHacker
          ),
          'Only an `allowed` address can issue tokens'
        )
        await assertRevert(
          contractInstance.issueTokens([holder, anotherHolder], [0, 0], [1, 2]),
          'Only an `allowed` address can issue tokens'
        )
      })

      it('reverts if trying to issue tokens with invalid argument length', async function () {
        await assertRevert(
          contractInstance.issueTokens([user], [0, 0], [1, 2], fromUser),
          'Parameters should have the same length'
        )

        await assertRevert(
          contractInstance.issueTokens([user], [0, 0], [1], fromUser),
          'Parameters should have the same length'
        )

        await assertRevert(
          contractInstance.issueTokens(
            [user, anotherUser],
            [0],
            [1, 1],
            fromUser
          ),
          'Parameters should have the same length'
        )
      })

      it('reverts when issuing a token to an invalid address', async function () {
        await assertRevert(
          contractInstance.issueTokens(
            [anotherHolder, ZERO_ADDRESS],
            [0, 0],
            [1, 2],
            fromUser
          ),
          'ERC721: mint to the zero address'
        )
      })

      it('reverts when trying to issue an already minted wearable', async function () {
        await contractInstance.issueTokens(
          [holder, anotherHolder],
          [0, 0],
          [1, 2],
          fromUser
        )

        await assertRevert(
          contractInstance.issueTokens(
            [holder, anotherHolder],
            [0, 0],
            [3, 1],
            fromUser
          ),
          'ERC721: token already minted'
        )
      })

      it('reverts when trying to issue an invalid wearable option id', async function () {
        await assertRevert(
          contractInstance.issueTokens(
            [holder, anotherHolder],
            [0, wearables.length],
            [1, 1],
            fromUser
          ),
          'Invalid option id'
        )
      })

      it('reverts when trying to issue an invalid wearable issued id', async function () {
        await assertRevert(
          contractInstance.issueTokens(
            [holder, anotherHolder],
            [0, 0],
            [1, wearables[0].max + 1],
            fromUser
          ),
          'Invalid issued id'
        )
      })
    })

    describe('tokenURI', function () {
      it('should return the correct token URI', async function () {
        await contractInstance.issueToken(holder, 3, 99, fromUser)

        // match wearable id
        let uri = await contractInstance.tokenURI(encodeTokenId(3, 99))
        let uriArr = uri.split('/')
        expect(99).to.eq.BN(uri.split('/')[uriArr.length - 1])
        expect(wearables[3].name).to.be.equal(uri.split('/')[uriArr.length - 2])
      })

      it('reverts if the token does not exist', async function () {
        await assertRevert(
          contractInstance.tokenURI(encodeTokenId(0, 1)),
          'ERC721Metadata: received a URI query for a nonexistent token'
        )
      })
    })

    describe('addWearable', function () {
      it('reverts when trying to add a wearable with a max supply greater than 27 bytes', async function () {
        const maxSupply = web3.utils.toBN(web3.utils.padLeft('0xff', 54, 'f'))
        const one = web3.utils.toBN(1)

        await contractInstance.addWearable('wearable', maxSupply)

        await assertRevert(
          contractInstance.addWearable('wearable', maxSupply.add(one)),
          'Max issuance should be lower or equal than MAX_ISSUANCE'
        )
      })
    })

    describe('encodeTokenId', function () {
      it('should encode a token id', async function () {
        let expectedId = await contractInstance.encodeTokenId(0, 1)
        let decoded = decodeTokenId(expectedId)
        expect(expectedId).to.eq.BN(encodeTokenId(0, 1))
        expect(0).to.eq.BN(decoded[0])
        expect(1).to.eq.BN(decoded[1])

        expectedId = await contractInstance.encodeTokenId(1, 0)
        decoded = decodeTokenId(expectedId)
        expect(expectedId).to.eq.BN(encodeTokenId(1, 0))
        expect(1).to.eq.BN(decoded[0])
        expect(0).to.eq.BN(decoded[1])

        expectedId = await contractInstance.encodeTokenId(11232232, 1123123123)
        decoded = decodeTokenId(expectedId)
        expect(expectedId).to.eq.BN(encodeTokenId(11232232, 1123123123))
        expect(11232232).to.eq.BN(decoded[0])
        expect(1123123123).to.eq.BN(decoded[1])

        expectedId = await contractInstance.encodeTokenId(
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

        const expectedId = await contractInstance.encodeTokenId(max, 0)
        expect(expectedId).to.eq.BN(encodeTokenId(max, 0))

        await assertRevert(
          contractInstance.encodeTokenId(max.add(one), 0),
          'The option id should be lower or equal than the MAX_OPTIONS'
        )
      })

      it('revert when the second value is greater than 27 bytes', async function () {
        const max = web3.utils.toBN(web3.utils.padLeft('0xff', 54, 'f'))
        const one = web3.utils.toBN(1)

        const expectedId = await contractInstance.encodeTokenId(0, max)
        expect(expectedId).to.eq.BN(encodeTokenId(0, max))

        await assertRevert(
          contractInstance.encodeTokenId(0, max.add(one)),
          'The issuance id should be lower or equal than the MAX_ISSUANCE'
        )
      })
    })

    describe('decodeTokenId', function () {
      it('should decode a token id', async function () {
        let expectedValues = await contractInstance.decodeTokenId(
          encodeTokenId(0, 1)
        )
        expect(expectedValues[0]).to.eq.BN(0)
        expect(expectedValues[1]).to.eq.BN(1)

        expectedValues = await contractInstance.decodeTokenId(
          encodeTokenId(1, 0)
        )
        expect(expectedValues[0]).to.eq.BN(1)
        expect(expectedValues[1]).to.eq.BN(0)

        expectedValues = await contractInstance.decodeTokenId(
          encodeTokenId(124, 123212)
        )
        expect(expectedValues[0]).to.eq.BN(124)
        expect(expectedValues[1]).to.eq.BN(123212)

        expectedValues = await contractInstance.decodeTokenId(
          encodeTokenId(4569428193, 90893249234)
        )
        expect(expectedValues[0]).to.eq.BN(4569428193)
        expect(expectedValues[1]).to.eq.BN(90893249234)
      })
    })
  })
})
