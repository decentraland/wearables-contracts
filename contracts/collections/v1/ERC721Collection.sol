// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;


import "./ERC721BaseCollection.sol";

contract ERC721Collection is ERC721BaseCollection {
    /**
     * @dev Create the contract.
     * @param _name - name of the contract
     * @param _symbol - symbol of the contract
     * @param _operator - Address allowed to mint tokens
     * @param _baseURI - base URI for token URIs
     */
    constructor(
        string memory _name,
        string memory _symbol,
        address _operator,
        string memory _baseURI
    ) public ERC721BaseCollection(_name, _symbol, _operator, _baseURI) {}

    /**
     * @dev Issue a new NFT of the specified kind.
     * @notice that will throw if kind has reached its maximum or is invalid
     * @param _beneficiary - owner of the token
     * @param _wearableId - token wearable
     */
    function issueToken(address _beneficiary, string calldata _wearableId) external onlyAllowed {
        _issueToken(_beneficiary, _wearableId);
    }

    /**
     * @dev Issue NFTs.
     * @notice that will throw if kind has reached its maximum or is invalid
     * @param _beneficiaries - owner of the tokens
     * @param _wearableIds - token wearables
     */
    function issueTokens(address[] calldata _beneficiaries, bytes32[] calldata _wearableIds) external onlyAllowed {
        require(_beneficiaries.length == _wearableIds.length, "Parameters should have the same length");

        for(uint256 i = 0; i < _wearableIds.length; i++) {
            _issueToken(_beneficiaries[i], _wearableIds[i].bytes32ToString());
        }
    }

    /**
     * @dev Issue a new NFT of the specified kind.
     * @notice that will throw if kind has reached its maximum or is invalid
     * @param _beneficiary - owner of the token
     * @param _wearableId - token wearable
     */
    function _issueToken(address _beneficiary, string memory _wearableId) internal {
        bytes32 key = getWearableKey(_wearableId);
        uint256 issuedId = issued[key] + 1;
        uint256 tokenId = this.totalSupply();

        _mint(_beneficiary, tokenId, key, _wearableId, issuedId);
        _setTokenURI(
            tokenId,
            string(abi.encodePacked(_wearableId, "/", issuedId.uintToString()))
        );
    }

     /**
     * @dev Add a new wearable to the collection.
     * @notice that this method allows wearableIds of any size. It should be used
     * if a wearableId is greater than 32 bytes
     * @param _wearableId - wearable id
     * @param _maxIssuance - total supply for the wearable
     */
    function addWearable(string memory _wearableId, uint256 _maxIssuance) public override onlyOwner {
        super.addWearable(_wearableId, _maxIssuance);
    }
}
