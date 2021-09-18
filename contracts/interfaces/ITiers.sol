// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;


interface ITiers {
    struct Tier {
        uint256 value;
        uint256 price;
    }

    function tiers(uint256 _index) external view returns (Tier memory);
}