import assertRevert from '../helpers/assertRevert'

const ChainlinkOracle = artifacts.require('ChainlinkOracle')
const DummyAggregatorV3Interface = artifacts.require(
  'DummyAggregatorV3Interface'
)

const BN = web3.utils.BN
const expect = require('chai').use(require('bn-chai')(BN)).expect

const oracleContractDecimals = 18
const feedContractDecimals = 8
const feedContractAnswer = 10 ** feedContractDecimals

let dataFeedContract

beforeEach(async function () {
  dataFeedContract = await DummyAggregatorV3Interface.new(
    feedContractDecimals,
    feedContractAnswer
  )
})

describe('ChainlinkOracle', function () {
  describe('initialize', function () {
    it('should be initialized with correct values', async function () {
      const chainlinkOracleContract = await ChainlinkOracle.new(
        dataFeedContract.address,
        oracleContractDecimals
      )

      const dataFeed = await chainlinkOracleContract.dataFeed()
      expect(dataFeed).to.be.equal(dataFeedContract.address)

      const decimals = await chainlinkOracleContract.decimals()
      expect(decimals).to.eq.BN(oracleContractDecimals)
    })
  })

  describe('getRate', function () {
    it('should return the rate', async function () {
      const chainlinkOracleContract = await ChainlinkOracle.new(
        dataFeedContract.address,
        oracleContractDecimals
      )

      const rate = await chainlinkOracleContract.getRate()
      const expectedRate = web3.utils.toBN(10 ** oracleContractDecimals)
      expect(rate).to.eq.BN(expectedRate)
    })

    it('reverts when the data feed answer is negative', async function () {
      const dataFeedContract = await DummyAggregatorV3Interface.new(
        feedContractDecimals,
        feedContractAnswer * -1
      )

      const chainlinkOracleContract = await ChainlinkOracle.new(
        dataFeedContract.address,
        oracleContractDecimals
      )

      const expectedError = 'ChainlinkOracle#getRate: INVALID_RATE'

      await assertRevert(chainlinkOracleContract.getRate(), expectedError)
    })

    it('reverts when the data feed answer is 0', async function () {
      const dataFeedContract = await DummyAggregatorV3Interface.new(
        feedContractDecimals,
        0
      )

      const chainlinkOracleContract = await ChainlinkOracle.new(
        dataFeedContract.address,
        oracleContractDecimals
      )

      const expectedError = 'ChainlinkOracle#getRate: INVALID_RATE'

      await assertRevert(chainlinkOracleContract.getRate(), expectedError)
    })
  })
})
