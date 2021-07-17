// SPDX-License-Identifier: MIT

pragma solidity  ^0.7.3;
pragma experimental ABIEncoderV2;

import "../bridges/CollectionsBridgeRoot.sol";

contract DummyCollectionsBridgeRoot is CollectionsBridgeRoot {

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event StateSynced(
        uint256 indexed id,
        address indexed contractAddress,
        bytes data
    );

   /**
    * @notice Create the contract
    * @param _owner - contract owner
    * @param _checkpointManager - checkpoint manager
    * @param _fxRoot - tunnel root
    * @param _collectionValidator - collection Validator owner
    * @param _maxTokensPerTx - max tokens per transaction
    */
    constructor(
        address _owner,
        uint256 _maxTokensPerTx,
        address _checkpointManager,
        address _fxRoot,
        ICollectionValidator _collectionValidator
    )
        CollectionsBridgeRoot(
            _owner,
            _maxTokensPerTx,
            _checkpointManager,
            _fxRoot,
            _collectionValidator
        )
    { }

     function receiveMessage(bytes memory message) public override {
          _processMessageFromChild(message);
     }

}
