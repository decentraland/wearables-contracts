// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;


interface IERC721CollectionV2 {
    enum RARITY {
        common,
        uncommon,
        rare,
        epic,
        legendary,
        mythic,
        unique
    }

    struct Item {
        RARITY rarity;
        uint256 totalSupply; // current supply
        uint256 price;
        address beneficiary;
        bytes32 contentHash; // used for safe purposes
        string metadata;
    }

    function issueToken(address _beneficiary, uint256 _itemId) external;
    function items(uint256 _itemId) external view returns (uint256, uint256, uint256, address, string memory, bytes32);
    // function items(uint256 _itemId) external view returns (Item memory);

}