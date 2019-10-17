pragma solidity ^0.5.11;

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721Full.sol";


contract ExclusiveMasks is Ownable, ERC721Full {
    mapping(bytes32 => uint256) public maxIssuance;
    mapping(bytes32 => uint) public issued;
    mapping(uint256 => string) internal _tokenPaths;

    string public baseURI;
    address public allowed;

    event BaseURI(string _oldBaseURI, string _newBaseURI);
    event Allowed(address indexed _oldAllowed, address indexed _newAllowed);


    /**
     * @dev Create the contract.
     * @param _allowed - Address allowed to mint tokens
     * @param _baseURI - base URI for token URIs
     */
    constructor(address _allowed, string memory _baseURI) public ERC721Full("dcl://exclusive-masks", "DCLXM") {
        allowed = _allowed;
        baseURI = _baseURI;

        maxIssuance[keccak256("bird_mask")] = 100;
        maxIssuance[keccak256("classic_mask")] = 100;
        maxIssuance[keccak256("clown_nose")] = 100;
        maxIssuance[keccak256("asian_fox")] = 100;
        maxIssuance[keccak256("killer_mask")] = 100;
        maxIssuance[keccak256("serial_killer_mask")] = 100;
        maxIssuance[keccak256("theater_mask")] = 100;
        maxIssuance[keccak256("tropical_mask")] = 100;
    }


    /**
     * @dev Mint a new kind token.
     * @notice that will throw if kind has reached its maximum or is invalid
     * @param _beneficiary - owner of the token
     * @param _kind - token kind
     */
    function getToken(address _beneficiary, string calldata _kind) external {
        require(msg.sender == allowed, "Only allowed can create tokens");
        bytes32 key = keccak256(abi.encodePacked(_kind));
        if (maxIssuance[key] > 0 && issued[key] < maxIssuance[key]) {
            issued[key] = issued[key] + 1;
            uint tokenId = this.totalSupply();
            _mint(_beneficiary, tokenId);
            _setTokenURI(
                tokenId,
                string(abi.encodePacked(_kind, "/", uint2str(issued[key])))
            );
        } else {
            revert("invalid: trying to issue an exhausted kind of nft");
        }
    }

    /**
     * @dev Set Base URI.
     * @param _baseURI - base URI for token URIs
     */
    function setBaseURI(string calldata _baseURI) external onlyOwner {
        emit BaseURI(baseURI, _baseURI);
        baseURI = _baseURI;
    }

    /**
     * @dev Set Base URI.
     * @param _allowed - Address allowed to mint tokens
     */
    function setAllowed(address _allowed) external onlyOwner {
        emit Allowed(allowed, _allowed);
        allowed = _allowed;
    }


    /**
     * @dev Returns an URI for a given token ID.
     * Throws if the token ID does not exist. May return an empty string.
     * @param _tokenId - uint256 ID of the token to query
     * @return token URI
     */
    function tokenURI(uint256 _tokenId) external view returns (string memory) {
        require(_exists(_tokenId), "ERC721Metadata: URI query for nonexistent token");
        return string(abi.encodePacked(baseURI, _tokenPaths[_tokenId]));
    }


    /**
     * @dev Transfers the ownership of given tokens ID to another address.
     * Usage of this method is discouraged, use {safeBatchTransferFrom} whenever possible.
     * Requires the msg.sender to be the owner, approved, or operator.
     * @param _from current owner of the token
     * @param _to address to receive the ownership of the given token ID
     * @param _tokenIds uint256 ID of the token to be transferred
     */
    function batchTransferFrom(address _from, address _to, uint256[] calldata _tokenIds) external {
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            transferFrom(_from, _to, _tokenIds[i]);
        }
    }

    /**
     * @dev Safely transfers the ownership of given token IDs to another address
     * If the target address is a contract, it must implement {IERC721Receiver-onERC721Received},
     * which is called upon a safe transfer, and return the magic value
     * `bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))`; otherwise,
     * the transfer is reverted.
     * Requires the msg.sender to be the owner, approved, or operator
     * @param _from - current owner of the token
     * @param _to - address to receive the ownership of the given token ID
     * @param _tokenIds - uint256 IDs of the tokens to be transferred
     */
    function safeBatchTransferFrom(address _from, address _to, uint256[] memory _tokenIds) public {
        safeBatchTransferFrom(_from, _to, _tokenIds, "");
    }

    /**
     * @dev Safely transfers the ownership of given token IDs to another address
     * If the target address is a contract, it must implement {IERC721Receiver-onERC721Received},
     * which is called upon a safe transfer, and return the magic value
     * `bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))`; otherwise,
     * the transfer is reverted.
     * Requires the msg.sender to be the owner, approved, or operator
     * @param _from - current owner of the token
     * @param _to - address to receive the ownership of the given token ID
     * @param _tokenIds - uint256 ID of the tokens to be transferred
     * @param _data bytes data to send along with a safe transfer check
     */
    function safeBatchTransferFrom(address _from, address _to, uint256[] memory _tokenIds, bytes memory _data) public {
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            safeTransferFrom(_from, _to, _tokenIds[i], _data);
        }
    }

     /**
     * @dev Internal function to set the token URI for a given token.
     * Reverts if the token ID does not exist.
     * @param _tokenId - uint256 ID of the token to set its URI
     * @param _uri - string URI to assign
     */
    function _setTokenURI(uint256 _tokenId, string memory _uri) internal {
        require(_exists(_tokenId), "ERC721Metadata: URI set of nonexistent token");
        _tokenPaths[_tokenId] = _uri;
    }


     /**
     * @dev Convert uint to string.
     * @param _i - uint256 to be converted to string.
     * @return uint in string
     */
    function uint2str(uint _i) internal pure returns (string memory _uintAsString) {
        if (_i == 0) {
            return "0";
        }
        uint j = _i;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint k = len - 1;
        while (_i != 0) {
            bstr[k--] = byte(uint8(48 + _i % 10));
            _i /= 10;
        }
        return string(bstr);
    }
}