// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;


interface IERC721CollectionV2 {
    function COLLECTION_HASH() external view returns (bytes32);

    struct ItemParam {
        string rarity;
        uint256 price;
        address beneficiary;
        string metadata;
    }

    function issueToken(address _beneficiary, uint256 _itemId) external;
    function setApproved(bool _value) external;
    /// @dev For some reason using the Struct Item as an output parameter fails, but works as an input parameter
    function initialize(
        string memory _name,
        string memory _symbol,
        string memory _baseURI,
        address _creator,
        bool _shouldComplete,
        bool _isApproved,
        address _rarities,
        ItemParam[] memory _items
    ) external;
    function items(uint256 _itemId) external view returns (string memory, uint256, uint256, uint256, address, string memory, bytes32);
}