// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import '../interfaces/IDataFeed.sol';

/**
 * @dev Dummy to be used to mock a chainlink data feed
 */
contract DummyDataFeed is IDataFeed {
    uint8 stateDecimals;
    int256 answer;
    uint256 updatedAtOffset;

    /**
     * @param _decimals - Number of decimals the decimals function has to return
     * @param _answer - Value returned as the second argument of the return value of both getRoundData and latestRoundData
     * @param _updatedAtOffset - Value deducted from the fourth argument of the return value of both getRoundData and latestRoundData which is the current block timestamp
     */
    constructor(uint8 _decimals, int256 _answer, uint256 _updatedAtOffset) {
        stateDecimals = _decimals;
        answer = _answer;
        updatedAtOffset = _updatedAtOffset;
    }

    function decimals() external view override returns (uint8) {
        return stateDecimals;
    }

    function latestRoundData()
        external
        view
        override
        returns (
            uint80,
            int256,
            uint256,
            uint256,
            uint80
        )
    {
        return (0, answer, 0, block.timestamp - updatedAtOffset, 0);
    }
}
