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

    // function issueToken(address _beneficiary, string calldata _wearableId) external;
    // function getWearableKey(string calldata _wearableId) external view returns (bytes32);
    // function issued(bytes32 _wearableKey) external view returns (uint256);
    // function maxIssuance(bytes32 _wearableKey) external view returns (uint256);
    // function owner() external view returns (address);
    // function wearables(uint256 _index) external view returns (string memory);
    function issueToken(address _beneficiary, uint256 _itemId) external;
    function issueTokens(address[] calldata  _beneficiaries, uint256[] calldata _itemIds) external;
   // function items(uint256 _itemId) external view returns (Item memory);
    function items(uint256 _itemId) external view returns (uint256, uint256, uint256, address, string memory, bytes32);

}