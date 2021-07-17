// SPDX-License-Identifier: MIT

pragma solidity  ^0.7.3;

import "../commons//OwnableInitializable.sol";
import "../commons//NativeMetaTransaction.sol";
import "../interfaces/IERC721BridgedCollection.sol";

contract CollectionBridgeBase is OwnableInitializable, NativeMetaTransaction {

    uint256 public maxTokensPerTx;

    event MaxTokensPerTxSet(uint256 _oldValue, uint256 _newValue);

   /**
    * @notice Create the contract
    * @param _name - domain contract name
    * @param _version - domain contract version
    * @param _owner - contract owner
    * @param _maxTokensPerTx - max tokens to be bridged per transactions
    */
    constructor(string memory _name, string memory  _version, address _owner, uint256 _maxTokensPerTx) {
        _initializeEIP712(_name, _version);
        _initOwnable();

        setMaxTokensPerTx(_maxTokensPerTx);
        transferOwnership(_owner);
    }

    /**
    * @notice Set max tokens to be bridged per transactions
    * @param _newMaxTokensPerTx - max tokens per transactions to be bridged
    */
    function setMaxTokensPerTx(uint256 _newMaxTokensPerTx) public onlyOwner {
        emit MaxTokensPerTxSet(maxTokensPerTx, _newMaxTokensPerTx);

        maxTokensPerTx = _newMaxTokensPerTx;
    }
}
