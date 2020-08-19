// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "./ERC721BaseCollectionV2.sol";


contract ERC721CollectionV2 is ERC721BaseCollectionV2 {

    constructor() public {}

     /**
     * @dev Returns an URI for a given token ID.
     * Throws if the token ID does not exist. May return an empty string.
     * @param _tokenId - uint256 ID of the token queried
     * @return token URI
     */
    function tokenURI(uint256 _tokenId) public view override returns (string memory) {
        require(_exists(_tokenId), "ERC721Metadata: received a URI query for a nonexistent token");

        (uint256 itemId, uint256 issuedId) = _decodeTokenId(_tokenId);

        return string(abi.encodePacked(baseURI(), address(this), "/", itemId, "/", issuedId.uintToString()));
    }

    /**
     * @dev Issue a new token of the specified item.
     * @notice that will throw if the item has reached its maximum or is invalid
     * @param _beneficiary - owner of the token
     * @param _itemId - item id
     */
    function issueToken(address _beneficiary,  uint256 _itemId) external {
        _issueToken(_beneficiary, _itemId);
    }

    /**
     * @dev Issue tokens.
     * @notice that will throw if the item has reached its maximum or is invalid
     * @param _beneficiaries - owner of the tokens
     * @param _itemIds - item ids
     */
    function issueTokens(address[] calldata _beneficiaries, uint256[] calldata _itemIds) external {
        require(_beneficiaries.length == _itemIds.length, "Parameters should have the same length");

        for (uint256 i = 0; i < _itemIds.length; i++) {
            _issueToken(_beneficiaries[i], _itemIds[i]);
        }
    }

    /**
     * @dev Issue a new token of the specified item.
     * @notice that will throw if the item has reached its maximum or is invalid
     * @param _beneficiary - owner of the token
     * @param _itemId - item id
     */
    function _issueToken(address _beneficiary, uint256 _itemId) internal canMint(_itemId) {
        // Check item id
        require(_itemId < items.length, "Invalid item id");

        Item storage item = items[_itemId];
        uint256 currentIssuance = item.totalSupply.add(1);

        // Check issuance
        require(currentIssuance <= item.maxSupply, "Item exhausted");

        // Encode token id
        uint256 tokenId = _encodeTokenId(_itemId, currentIssuance);

        // Increase issuance
        item.totalSupply = currentIssuance;

        // Mint token to beneficiary
        super._mint(_beneficiary, tokenId);

        // Log
        emit Issue(_beneficiary, tokenId, _itemId, currentIssuance);
    }

     /**
     * @dev Encode token id
     * @notice itemId (`optionBits` bits) + issuedId (`issuedIdBits` bits)
     * @param _itemId - item id
     * @param _issuedId - issued id
     * @return id uint256 of the encoded id
     */
    function _encodeTokenId(uint256 _itemId, uint256 _issuedId) internal pure returns (uint256 id) {
        require(_itemId <= MAX_OPTIONS, "The item id should be lower or equal than the MAX_OPTIONS");
        require(_issuedId <= MAX_ISSUANCE, "The issuance id should be lower or equal than the MAX_ISSUANCE");

        // solium-disable-next-line security/no-inline-assembly
        assembly {
            id := or(shl(ISSUANCE_BITS, _itemId), _issuedId)
        }
    }

    /**
     * @dev Decode token id
     * @notice itemId (`itemIdBits` bits) + issuedId (`issuedIdBits` bits)
     * @param _id - token id
     * @return itemId uint256 of the item id
     * @return issuedId uint256 of the issued id
     */
    function _decodeTokenId(uint256 _id) internal pure returns (uint256 itemId, uint256 issuedId) {
        uint256 mask = MAX_ISSUANCE;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            itemId := shr(ISSUANCE_BITS, _id)
            issuedId := and(mask, _id)
        }
    }
}
