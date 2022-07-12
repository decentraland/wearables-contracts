// SPDX-License-Identifier: MIT

pragma solidity ^0.7.3;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/math/SafeMath.sol';

import '../interfaces/IOracle.sol';
import '../interfaces/IDataFeed.sol';

contract ChainlinkOracle is IOracle {
    using SafeMath for uint256;

    IDataFeed public immutable dataFeed;
    uint256 public immutable decimals;
    uint256 public immutable tolerance;

    /**
     * @notice Create the contract
     * @param _dataFeed - chainlink's data feed address to obtain a rate. https://docs.chain.link/docs/get-the-latest-price/#solidity
     * @param _decimals - amount of decimals the rate should be returned with
     * @param _tolerance - amount of time in seconds from getRate's call block timestamp that the rate can be accepted without receiving an update
     */
    constructor(IDataFeed _dataFeed, uint256 _decimals, uint256 _tolerance) {
        dataFeed = _dataFeed;
        decimals = _decimals;
        tolerance = _tolerance;
    }

    /**
     * @notice Get rate
     * @return rate in the expected token decimals
     */
    function getRate() external view override returns (uint256) {
        uint256 feedDecimals = uint256(dataFeed.decimals());

        (, int256 rate, , uint256 updatedAt, ) = dataFeed.latestRoundData();
        
        require(updatedAt >= block.timestamp.sub(tolerance), "ChainlinkOracle#getRate: STALE_RATE");

        if (rate <= 0) {
            revert('ChainlinkOracle#getRate: INVALID_RATE');
        }

        return uint256(rate).mul(10**(decimals.sub(feedDecimals)));
    }
}
