// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

interface IOracle {
    function getRate() external view returns (uint256);
}
