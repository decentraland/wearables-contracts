// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;


interface IERC721CollectionV2 {
    function issueToken(address _beneficiary, uint256 _itemId) external;
    function items(uint256 _itemId) external view returns (uint256, uint256, uint256, address, string memory, bytes32);
    function setApproved(bool _value) external;
}