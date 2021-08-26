// SPDX-License-Identifier: MIT

pragma solidity  ^0.7.3;
pragma experimental ABIEncoderV2;

import "../bridges/CollectionsBridgeChild.sol";


contract DummyCollectionsBridgeChild is CollectionsBridgeChild {
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    constructor(
        address _owner,
        uint256 _maxTokensPerTx,
        address _fxChild,
        IERC721BridgedCollection _bridgedCollection
    )  CollectionsBridgeChild(
        _owner,
        _maxTokensPerTx,
        _fxChild,
        _bridgedCollection
    ) {}
}
