// SPDX-License-Identifier: MIT

pragma solidity ^0.7.3;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/math/SafeMath.sol';

import '../interfaces/IOracle.sol';
import '../interfaces/chainlink/AggregatorV3Interface.sol';

contract ChainlinkOracle is IOracle {
    using SafeMath for uint256;

    AggregatorV3Interface public immutable rateFeed;
    uint256 public immutable expectedDecimals;

    constructor(AggregatorV3Interface _rateFeed, uint256 _expectedDecimals) {
        rateFeed = _rateFeed;
        expectedDecimals = _expectedDecimals;
    }

    /**
     * @notice Get rate
     * @return rate in the expected token decimals
     */
    function getRate() external view override returns (uint256) {
        uint256 decimals = uint256(rateFeed.decimals());

        (, int256 rate, , , ) = rateFeed.latestRoundData();

        if (rate < 0) {
            revert('ChainlinkOracle#getRate: RATE_BELOW_0');
        }

        return uint256(rate).mul(10**(decimals.sub(expectedDecimals)));
    }
}
