// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "../markets/BurningStore.sol";

interface EventsInterface {
    event Issue(address indexed _beneficiary, uint256 indexed _tokenId, bytes32 indexed _wearableIdKey, string _wearableId, uint256 _issuedId);
    event Burn(address indexed burner, uint256 value);
}

contract DummyBurningStore is BurningStore, EventsInterface {

    constructor(
        IERC20 _acceptedToken,
        address[] memory _collectionAddresses,
        uint256[][] memory _collectionOptionIds,
        uint256[][] memory _collectionAvailableQtys,
        uint256[][] memory _collectionPrices
    )  BurningStore (
        _acceptedToken,
        _collectionAddresses,
        _collectionOptionIds,
        _collectionAvailableQtys,
        _collectionPrices
    ) public {}
}