// SPDX-License-Identifier: MIT

pragma solidity  ^0.7.3;
pragma experimental ABIEncoderV2;

import "fx-portal-contracts/contracts/tunnel/FxBaseChildTunnel.sol";

import "./CollectionsBridgeBase.sol";


contract CollectionsBridgeChild is CollectionBridgeBase, FxBaseChildTunnel {

    IERC721BridgedCollection public bridgedCollection;
    mapping(uint256 => uint256) public stateIds;

    event MaxTokensSet(uint256 _oldValue, uint256 _newValue);

   /**
    * @notice Create the contract
    * @param _owner - contract owner
    * @param _maxTokensPerTx - max tokens to be bridged per transactions
    * @param _fxChild - Fx child
    * @param _bridgedCollection - collection where the tokens deposits are minted
    */
    constructor(
        address _owner,
        uint256 _maxTokensPerTx,
        address _fxChild,
        IERC721BridgedCollection _bridgedCollection
    )
        CollectionBridgeBase('Decentraland Collection Bridge Child', '1', _owner, _maxTokensPerTx)
        FxBaseChildTunnel(_fxChild)
    {
        bridgedCollection = _bridgedCollection;
    }


    /**
    * @notice Withdraw collections tokens
    * @param _to - beneficiary
    * @param _tokenIds - array of tokens ids to be withdrawn
    */
    function withdrawFor(address _to, uint256[] calldata _tokenIds) external {
        require(_tokenIds.length <= maxTokensPerTx, "CBC#withdrawFor: MAX_TOKENS_PER_TX_EXCEEDED");

        address sender = _msgSender();
        IERC721BridgedCollection.Token[] memory tokens = new IERC721BridgedCollection.Token[](_tokenIds.length);

        for (uint256 i = 0; i < _tokenIds.length; i++) {
            uint256 tokenId = _tokenIds[i];
            require(bridgedCollection.ownerOf(tokenId) == sender, "CBC#withdrawFor: SENDER_NOT_THE_TOKEN_OWNER");

            (IERC721BridgedCollection collection, uint256 originalTokenId, string memory tokenURI) = bridgedCollection.tokens(tokenId);
            tokens[i] =  IERC721BridgedCollection.Token(collection, originalTokenId, tokenURI);
        }

        bridgedCollection.burn(_tokenIds);

        _sendMessageToRoot(abi.encode(_to, tokens));
    }

    /**
     * @notice Process message received from Root Tunnel
     * @dev function needs to be implemented to handle message as per requirement
     * This is called by onStateReceive function.
     * Since it is called via a system call, any event will not be emitted during its execution.
     * @param _sender - root message sender
     * @param _data - bytes message that was sent from Root Tunnel
     */
    function _processMessageFromRoot(uint256 _stateId, address _sender, bytes memory _data) internal override validateSender(_sender) {
        require(stateIds[_stateId] == 0, "CBC#_processMessageFromRoot: STATE_ID_ALREADY_PROCESSED");
        stateIds[_stateId] = 1;

        (address to, IERC721BridgedCollection.Token[] memory tokens) = abi.decode(_data, (address, IERC721BridgedCollection.Token[]));

        bridgedCollection.mint(to, tokens);
    }
}
