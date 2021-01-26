import assertRevert from '../helpers/assertRevert'
import { doTest } from '../helpers/baseCollection'
import {
  CONTRACT_NAME,
  CONTRACT_SYMBOL,
  WEARABLES,
  setupWearables,
  BASE_URI as URI,
} from '../helpers/collection'

const BN = web3.utils.BN
const expect = require('chai').use(require('bn-chai')(BN)).expect

const ERC721Collection = artifacts.require('DummyERC721MaxIssuanceCollection')

async function issueWearable(contract, beneficiary, index, from) {
  return contract.issueToken(beneficiary, WEARABLES[index].name, from)
}

describe('Exhausted Collection', function () {
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
        expect(issued).to.be.eq.BN(1)
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

        // match wearable id & issued id
        const uri = await contractInstance.tokenURI(totalSupply.toNumber() - 1)
        const uriArr = uri.split('/')
        expect(wearable0).to.eq.BN(uriArr[uriArr.length - 2])
        expect(issued).to.eq.BN(uriArr[uriArr.length - 1])
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
          'Option exhausted'
        )
      })
    })
  })
})
