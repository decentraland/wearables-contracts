// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;


interface IERC721CollectionFactoryV2 {
    function createCollection(bytes32 _salt, bytes memory _data) external returns (address addr);
    function transferOwnership(address newOwner) external;
    function isCollectionFromFactory(address _collection) external view returns (bool);
}
