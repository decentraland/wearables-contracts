// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../markets/v2/CollectionStore.sol";

interface EventsInterface {
    event Issue(address indexed _beneficiary, uint256 indexed _tokenId, uint256 indexed _itemId, uint256 _issuedId, address _caller);
    event Transfer(address indexed _from, address indexed _to, uint256 _value);
}

contract DummyCollectionStore is EventsInterface, CollectionStore {
    constructor (
        address _owner,
        IERC20 _acceptedToken,
        address _feeOwner,
        uint256 _fee
    ) CollectionStore(_owner, _acceptedToken, _feeOwner, _fee) {}
}