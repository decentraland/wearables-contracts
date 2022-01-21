// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

contract DummyInvalidOracle {
    uint256 count;

    function getRate() external {
        count++;
    }
}
