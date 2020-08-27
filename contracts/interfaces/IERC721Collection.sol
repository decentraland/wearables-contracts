// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;


interface IERC721Collection {
    function issueToken(address _beneficiary, string calldata _wearableId) external;
    function getWearableKey(string calldata _wearableId) external view returns (bytes32);
    function issued(bytes32 _wearableKey) external view returns (uint256);
    function maxIssuance(bytes32 _wearableKey) external view returns (uint256);
    function issueTokens(address[] calldata _beneficiaries, bytes32[] calldata _wearableIds) external;
    function owner() external view returns (address);
    function wearables(uint256 _index) external view returns (string memory);
    function wearablesCount() external view returns (uint256);
}