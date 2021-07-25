import hr from 'hardhat'
import { expect } from 'chai'

const ERC721Collection = artifacts.require('ERC721CollectionV2')
const ERC721CollectionV1Validator = artifacts.require(
  'ERC721CollectionV1Validator'
)

describe('ERC721CollectionV1Validator', function () {
  let collection1
  let collection2
  let collection3
  let collectionsV1Validator

  beforeEach(async function () {
    collection1 = await ERC721Collection.new()
    collection2 = await ERC721Collection.new()
    collection3 = await ERC721Collection.new()

    collectionsV1Validator = await ERC721CollectionV1Validator.new([
      collection1.address,
      collection2.address,
    ])
  })

  describe('create collection v1 validator', async function () {
    it('deploy with correct values', async function () {
      let contract = await ERC721CollectionV1Validator.new([
        collection1.address,
      ])

      let isValid = await contract.collections(collection1.address)
      expect(isValid).to.be.eq.BN(web3.utils.toBN(1))

      isValid = await contract.collections(collection2.address)
      expect(isValid).to.be.eq.BN(web3.utils.toBN(0))

      contract = await ERC721CollectionV1Validator.new([
        collection1.address,
        collection2.address,
      ])

      isValid = await contract.collections(collection1.address)
      expect(isValid).to.be.eq.BN(web3.utils.toBN(1))

      isValid = await contract.collections(collection2.address)
      expect(isValid).to.be.eq.BN(web3.utils.toBN(1))
    })
  })

  describe('isValidCollection', async function () {
    it('should return whether a collection is valid or not', async function () {
      // Ok
      let isValid = await collectionsV1Validator.isValidCollection(
        collection1.address,
        '0x'
      )
      expect(isValid).to.be.equal(true)

      // Ok
      isValid = await collectionsV1Validator.isValidCollection(
        collection2.address,
        '0x'
      )
      expect(isValid).to.be.equal(true)

      // Invalid collection
      isValid = await collectionsV1Validator.isValidCollection(
        collection3.address,
        '0x'
      )
      expect(isValid).to.be.equal(false)
    })
  })
})
