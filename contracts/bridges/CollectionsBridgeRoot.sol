// SPDX-License-Identifier: MIT

pragma solidity  ^0.7.3;
pragma experimental ABIEncoderV2;

import "fx-portal-contracts/contracts/tunnel/FxBaseRootTunnel.sol";

import "./CollectionsBridgeBase.sol";
import "../interfaces/ICollectionValidator.sol";

contract CollectionsBridgeRoot is CollectionBridgeBase, FxBaseRootTunnel {

    ICollectionValidator public collectionValidator;

    struct CollectionTokenParam {
        IERC721BridgedCollection collection;
        uint256 tokenId;
        bytes auxData;
    }

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
        CollectionBridgeBase('Decentraland Collection Bridge Root', '1', _owner, _maxTokensPerTx)
        FxBaseRootTunnel(_checkpointManager, _fxRoot)
    {
        collectionValidator = _collectionValidator;
    }

    /**
    * @notice Deposit collections tokens
    * @param _to - beneficiary
    * @param _collectionsTokens - array of collection's tokens to deposit
    */
    function depositFor(address _to, CollectionTokenParam[] calldata _collectionsTokens) external {
        require(_collectionsTokens.length <= maxTokensPerTx, "CBR#depositFor: MAX_TOKENS_PER_TX_EXCEEDED");

        address sender = _msgSender();
        IERC721BridgedCollection.Token[] memory tokens = new IERC721BridgedCollection.Token[](_collectionsTokens.length);

        for (uint256 i = 0; i < _collectionsTokens.length; i++) {
            CollectionTokenParam memory collectionToken = _collectionsTokens[i];

            IERC721BridgedCollection collection =  collectionToken.collection;
            uint256 tokenId = collectionToken.tokenId;
            bytes memory auxData = collectionToken.auxData;

            require(collectionValidator.isValidCollection(address(collection), auxData), "CBR#depositFor: INVALID_COLLECTION");

            collection.safeTransferFrom(sender, address(this), tokenId);
            require(collection.ownerOf(tokenId) == address(this), "CBR#depositFor: TOKEN_TRANSFER_FAILED");

            tokens[i] = IERC721BridgedCollection.Token(
                collection,
                tokenId,
                collection.tokenURI(tokenId)
            );
        }

        _sendMessageToChild(abi.encode(_to, tokens));
    }

    /**
     * @dev Whenever an {IERC721} `tokenId` token is transferred to this contract via {IERC721-safeTransferFrom}
     * by `operator` from `from`, this function is called.
     *
     * It must return its Solidity selector to confirm the token transfer.
     * If any other value is returned or the interface is not implemented by the recipient, the transfer will be reverted.
     *
     * The selector can be obtained in Solidity with `IERC721.onERC721Received.selector`.
     */
    function onERC721Received(
        address /* operator */, address /* from */, uint256 /* tokenId */, bytes calldata /* data */
        ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    /**
     * @notice Process message received from Child Tunnel
     * @dev function needs to be implemented to handle message as per requirement
     * This is called by onStateReceive function.
     * Since it is called via a system call, any event will not be emitted during its execution.
     * @param _data - bytes message that was sent from Child Tunnel
     */
    function _processMessageFromChild(bytes memory _data) internal override {
        (address to, IERC721BridgedCollection.Token[] memory tokens) =
            abi.decode(_data, (address,  IERC721BridgedCollection.Token[]));

         for (uint256 i = 0; i < tokens.length; i++) {
            IERC721BridgedCollection.Token memory token = tokens[i];

            token.collection.safeTransferFrom(address(this), to, token.tokenId);
         }
    }
}
