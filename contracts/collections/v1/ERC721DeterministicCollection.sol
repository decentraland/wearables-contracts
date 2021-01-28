// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;


import "./ERC721BaseCollection.sol";


contract ERC721DeterministicCollection is ERC721BaseCollection {
    uint8 constant public OPTIONS_BITS = 40;
    uint8 constant public ISSUANCE_BITS = 216;

    uint40 constant public MAX_OPTIONS = type(uint40).max;
    uint216 constant public MAX_ISSUANCE = type(uint216).max;

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
     * @dev Add a new wearable to the collection.
     * @notice that this method allows wearableIds of any size. It should be used
     * if a wearableId is greater than 32 bytes
     * @param _wearableId - wearable id
     * @param _maxIssuance - total supply for the wearable
     */
    function addWearable(string memory _wearableId, uint256 _maxIssuance) public override onlyOwner {
        require(wearables.length < MAX_OPTIONS, "Wearables options have reached MAX_OPTIONS");
        require(_maxIssuance <= MAX_ISSUANCE, "Max issuance should be lower or equal than MAX_ISSUANCE");

        super.addWearable(_wearableId, _maxIssuance);
    }

     /**
     * @dev Returns an URI for a given token ID.
     * Throws if the token ID does not exist. May return an empty string.
     * @param _tokenId - uint256 ID of the token queried
     * @return token URI
     */
    function tokenURI(uint256 _tokenId) public view override returns (string memory) {
        require(_exists(_tokenId), "ERC721Metadata: received a URI query for a nonexistent token");

        (uint256 optionId, uint256 issuedId) = _decodeTokenId(_tokenId);

        return string(abi.encodePacked(baseURI(), wearables[optionId], "/", issuedId.uintToString()));
    }

    /**
     * @dev Issue a new NFT of the specified kind.
     * @notice that will throw if kind has reached its maximum or is invalid
     * @param _beneficiary - owner of the token
     * @param _optionId - option id
     * @param _issuedId - issued id
     */
    function issueToken(address _beneficiary,  uint256 _optionId, uint256 _issuedId) external onlyAllowed {
        _issueToken(_beneficiary, _optionId, _issuedId);
    }

    /**
     * @dev Issue NFTs.
     * @notice that will throw if kind has reached its maximum or is invalid
     * @param _beneficiaries - owner of the tokens
     * @param _optionIds - option ids
     * @param _issuedIds - issued ids
     */
    function issueTokens(address[] calldata _beneficiaries, uint256[] calldata _optionIds, uint256[] calldata _issuedIds) external onlyAllowed {
        require(_beneficiaries.length == _optionIds.length, "Parameters should have the same length");
        require(_optionIds.length == _issuedIds.length, "Parameters should have the same length");

        for (uint256 i = 0; i < _optionIds.length; i++) {
            _issueToken(_beneficiaries[i],_optionIds[i], _issuedIds[i]);
        }
    }

    /**
     * @dev Issue a new NFT of the specified kind.
     * @notice that will throw if kind has reached its maximum or is invalid
     * @param _beneficiary - owner of the token
     * @param _optionId - option id
     * @param _issuedId - issued id
     */
    function _issueToken(address _beneficiary, uint256 _optionId, uint256 _issuedId) internal {
        // Check option id
        require(_optionId < wearables.length, "Invalid option id");

        // Get werable
        string memory wearableId = wearables[_optionId];

        // Get wearable key
        bytes32 key = getWearableKey(wearableId);

        // Encode token id
        uint tokenId = _encodeTokenId(_optionId, _issuedId);

        // Mint token
        _mint(_beneficiary, tokenId, key, wearableId, _issuedId);
    }

     /**
     * @dev Encode token id
     * @notice optionId (`optionBits` bits) + issuedId (`issuedIdBits` bits)
     * @param _optionId - option id
     * @param _issuedId - issued id
     * @return id uint256 of the encoded id
     */
    function _encodeTokenId(uint256 _optionId, uint256 _issuedId) internal pure returns (uint256 id) {
        require(_optionId <= MAX_OPTIONS, "The option id should be lower or equal than the MAX_OPTIONS");
        require(_issuedId <= MAX_ISSUANCE, "The issuance id should be lower or equal than the MAX_ISSUANCE");

        // solium-disable-next-line security/no-inline-assembly
        assembly {
            id := or(shl(ISSUANCE_BITS, _optionId), _issuedId)
        }
    }

    /**
     * @dev Decode token id
     * @notice optionId (`optionBits` bits) + issuedId (`issuedIdBits` bits)
     * @param _id - token id
     * @return optionId uint256 of the option id
     * @return issuedId uint256 of the issued id
     */
    function _decodeTokenId(uint256 _id) internal pure returns (uint256 optionId, uint256 issuedId) {
        uint256 mask = MAX_ISSUANCE;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            optionId := shr(ISSUANCE_BITS, _id)
            issuedId := and(mask, _id)
        }
    }
}
