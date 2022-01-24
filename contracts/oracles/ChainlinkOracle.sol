// SPDX-License-Identifier: MIT

pragma solidity ^0.7.3;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/math/SafeMath.sol';

import '../interfaces/IOracle.sol';
import '../interfaces/chainlink/AggregatorV3Interface.sol';

contract ChainlinkOracle is IOracle {
    using SafeMath for uint256;

    AggregatorV3Interface public immutable dataFeed;
    uint256 public immutable decimals;

    /**
     * @notice Create the contract
     * @param _dataFeed - chainlink's data feed address to obtain a rate. https://docs.chain.link/docs/get-the-latest-price/#solidity
     * @param _decimals - amount of decimals the rate should be returned with
     */
    constructor(AggregatorV3Interface _dataFeed, uint256 _decimals) {
        dataFeed = _dataFeed;
        decimals = _decimals;
    }

    /**
     * @notice Get rate
     * @return rate in the expected token decimals
     */
    function getRate() external view override returns (uint256) {
        uint256 feedDecimals = uint256(dataFeed.decimals());

        (, int256 rate, , , ) = dataFeed.latestRoundData();

        if (rate <= 0) {
            revert('ChainlinkOracle#getRate: INVALID_RATE');
        }

        return uint256(rate).mul(10**(decimals.sub(feedDecimals)));
    }
}
