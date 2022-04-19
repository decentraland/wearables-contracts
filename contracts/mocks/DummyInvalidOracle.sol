// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

/**
 * @dev Oracle dummy to test failing staticcalls
 */
contract DummyInvalidOracle {
    uint256 count;

    function getRate() external {
        count++;
    }
}
