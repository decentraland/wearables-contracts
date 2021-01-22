import { increaseTime } from '../helpers/increase'
import { doTest } from '../helpers/baseCollectionV2'
import {
  CONTRACT_NAME,
  CONTRACT_SYMBOL,
  ITEMS,
  BASE_URI,
  GRACE_PERIOD,
  encodeTokenId,
} from '../helpers/collectionV2'

const ERC721CollectionV2 = artifacts.require('ERC721CollectionV2')
const Rarities = artifacts.require('Rarities')

async function issueItem(contract, beneficiary, index, from) {
  await contract.issueToken(beneficiary, index, from)
}

describe('Collection V2', function () {
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
    ERC721CollectionV2,
    async (
      creator,
      shouldComplete,
      shouldApprove,
      shouldPassGracePeriod,
      creationParams
    ) => {
      const rarities = await Rarities.new(creator, 0)
      const collectionContract = await ERC721CollectionV2.new()
      await collectionContract.initialize(
        CONTRACT_NAME,
        CONTRACT_SYMBOL,
        BASE_URI,
        creator,
        shouldComplete,
        shouldApprove,
        rarities.address,
        ITEMS,
        creationParams
      )

      if (shouldPassGracePeriod) {
        await increaseTime(GRACE_PERIOD)
      }
      return collectionContract
    },
    CONTRACT_NAME,
    CONTRACT_SYMBOL,
    ITEMS,
    issueItem,
    null,
    [token1, token2, token3]
  )
})
