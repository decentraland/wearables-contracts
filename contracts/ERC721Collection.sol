pragma solidity ^0.5.11;

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721Full.sol";

import "./ERC721BaseCollection.sol";

contract ERC721Collection is Ownable, ERC721Full, ERC721BaseCollection {
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
     * @dev Returns an URI for a given token ID.
     * Throws if the token ID does not exist. May return an empty string.
     * @param _tokenId - uint256 ID of the token queried
     * @return token URI
     */
    function tokenURI(uint256 _tokenId) external view returns (string memory) {
        require(_exists(_tokenId), "ERC721Metadata: received a URI query for a nonexistent token");
        return string(abi.encodePacked(baseURI, _tokenPaths[_tokenId]));
    }

    /**
     * @dev Issue a new NFT of the specified kind.
     * @notice that will throw if kind has reached its maximum or is invalid
     * @param _beneficiary - owner of the token
     * @param _wearableId - token wearable
     */
    function _issueToken(address _beneficiary, string memory _wearableId) internal {
        bytes32 key = getWearableKey(_wearableId);
        if (maxIssuance[key] > 0 && issued[key] < maxIssuance[key]) {
            uint tokenId = this.totalSupply();

            _mint(_beneficiary, tokenId, key, _wearableId, issued[key] + 1);
            _setTokenURI(
                tokenId,
                string(abi.encodePacked(_wearableId, "/", issued[key].uintToString()))
            );

        } else {
            revert("invalid: trying to issue an exhausted wearable of nft");
        }
    }

    /**
     * @dev Internal function to set the token URI for a given token.
     * Reverts if the token ID does not exist.
     * @param _tokenId - uint256 ID of the token to set as its URI
     * @param _uri - string URI to assign
     */
    function _setTokenURI(uint256 _tokenId, string memory _uri) internal {
        require(_exists(_tokenId), "ERC721Metadata: calling set URI for a nonexistent token");
        _tokenPaths[_tokenId] = _uri;
    }
}
