import assertRevert from '../helpers/assertRevert'

const ChainlinkOracle = artifacts.require('ChainlinkOracle')
const DummyDataFeed = artifacts.require('DummyDataFeed')

const BN = web3.utils.BN
const expect = require('chai').use(require('bn-chai')(BN)).expect

const oracleContractDecimals = 18
const oracleContractTolerance = 0
const feedContractDecimals = 8
const feedContractAnswer = 10 ** feedContractDecimals
const feedContractAnsweredAtOffset = 0
const day = 86400

let dataFeedContract

beforeEach(async function () {
  dataFeedContract = await DummyDataFeed.new(
    feedContractDecimals,
    feedContractAnswer,
    feedContractAnsweredAtOffset
  )
})

describe('ChainlinkOracle', function () {
  describe('initialize', function () {
    it('should be initialized with correct values', async function () {
      const chainlinkOracleContract = await ChainlinkOracle.new(
        dataFeedContract.address,
        oracleContractDecimals,
        oracleContractTolerance
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
        oracleContractDecimals,
        oracleContractTolerance
      )

      const rate = await chainlinkOracleContract.getRate()
      const expectedRate = web3.utils.toBN(10 ** oracleContractDecimals)
      expect(rate).to.eq.BN(expectedRate)
    })

    it('should return the rate when tolerance is 0 and answeredAt is the same as the block timestamp', async function () {
      const chainlinkOracleContract = await ChainlinkOracle.new(
        dataFeedContract.address,
        oracleContractDecimals,
        oracleContractTolerance
      )

      const rate = await chainlinkOracleContract.getRate()
      const expectedRate = web3.utils.toBN(10 ** oracleContractDecimals)
      expect(rate).to.eq.BN(expectedRate)
    })

    it('should return the rate when tolerance is 1 day and answeredAt is half a day behind the block timestamp', async function () {
      const halfDay = day / 2

      dataFeedContract = await DummyDataFeed.new(
        feedContractDecimals,
        feedContractAnswer,
        halfDay
      )

      const chainlinkOracleContract = await ChainlinkOracle.new(
        dataFeedContract.address,
        oracleContractDecimals,
        day
      )

      const rate = await chainlinkOracleContract.getRate()
      const expectedRate = web3.utils.toBN(10 ** oracleContractDecimals)
      expect(rate).to.eq.BN(expectedRate)
    })

    it('should return the rate when tolerance is 1 day and answeredAt is 1 day behind the block timestamp', async function () {
      dataFeedContract = await DummyDataFeed.new(
        feedContractDecimals,
        feedContractAnswer,
        day
      )

      const chainlinkOracleContract = await ChainlinkOracle.new(
        dataFeedContract.address,
        oracleContractDecimals,
        day
      )

      const rate = await chainlinkOracleContract.getRate()
      const expectedRate = web3.utils.toBN(10 ** oracleContractDecimals)
      expect(rate).to.eq.BN(expectedRate)
    })

    it('reverts when the data feed answer is negative', async function () {
      const dataFeedContract = await DummyDataFeed.new(
        feedContractDecimals,
        feedContractAnswer * -1,
        feedContractAnsweredAtOffset
      )

      const chainlinkOracleContract = await ChainlinkOracle.new(
        dataFeedContract.address,
        oracleContractDecimals,
        oracleContractTolerance
      )

      const expectedError = 'ChainlinkOracle#getRate: INVALID_RATE'

      await assertRevert(chainlinkOracleContract.getRate(), expectedError)
    })

    it('reverts when the data feed answer is 0', async function () {
      const dataFeedContract = await DummyDataFeed.new(
        feedContractDecimals,
        0,
        feedContractAnsweredAtOffset
      )

      const chainlinkOracleContract = await ChainlinkOracle.new(
        dataFeedContract.address,
        oracleContractDecimals,
        oracleContractTolerance
      )

      const expectedError = 'ChainlinkOracle#getRate: INVALID_RATE'

      await assertRevert(chainlinkOracleContract.getRate(), expectedError)
    })

    it('reverts when tolerance is 0 and answeredAt is 1 second behind the block timestamp', async function () {
      dataFeedContract = await DummyDataFeed.new(
        feedContractDecimals,
        feedContractAnswer,
        1
      )

      const chainlinkOracleContract = await ChainlinkOracle.new(
        dataFeedContract.address,
        oracleContractDecimals,
        oracleContractTolerance
      )

      const expectedError = 'ChainlinkOracle#getRate: STALE_RATE'

      await assertRevert(chainlinkOracleContract.getRate(), expectedError)
    })

    it('reverts when tolerance is 1 day and answeredAt is 1 day and 1 second behind the block timestamp', async function () {
      dataFeedContract = await DummyDataFeed.new(
        feedContractDecimals,
        feedContractAnswer,
        day + 1
      )

      const chainlinkOracleContract = await ChainlinkOracle.new(
        dataFeedContract.address,
        oracleContractDecimals,
        day
      )

      const expectedError = 'ChainlinkOracle#getRate: STALE_RATE'

      await assertRevert(chainlinkOracleContract.getRate(), expectedError)
    })
  })
})
