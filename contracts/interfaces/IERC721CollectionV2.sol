// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;


interface IERC721CollectionV2 {
    struct Item {
        uint8 rarity;
        uint256 totalSupply; // current supply
        uint256 price;
        address beneficiary;
        string metadata;
        bytes32 contentHash; // used for safe purposes
    }

    function issueToken(address _beneficiary, uint256 _itemId) external;
    function setApproved(bool _value) external;
    /// @dev For some reason using the Struct Item as an output parameter fails, but works as an input parameter/
    function initialize(
        string memory _name,
        string memory _symbol,
        address _creator,
        bool _shouldComplete,
        string memory _baseURI,
        Item[] memory _items
    ) external;
    function items(uint256 _itemId) external view returns (uint256, uint256, uint256, address, string memory, bytes32);
}