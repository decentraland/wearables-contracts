pragma solidity ^0.5.11;

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721Full.sol";


contract ERC721Collection is Ownable, ERC721Full {
    mapping(bytes32 => uint256) public maxIssuance;
    mapping(bytes32 => uint) public issued;
    mapping(uint256 => string) internal _tokenPaths;

    string[] public wearables;

    string public baseURI;
    address public allowed;

    event BaseURI(string _oldBaseURI, string _newBaseURI);
    event Allowed(address indexed _oldAllowed, address indexed _newAllowed);
    event AddWearable(bytes32 indexed _wearableIdKey, string _wearableId, uint256 _maxIssuance);
    event Issue(address indexed _beneficiary, uint256 indexed _tokenId, bytes32 indexed _wearableIdKey, string _wearableId, uint256 _issuedId);


    /**
     * @dev Create the contract.
     * @param _name - name of the contract
     * @param _symbol - symbol of the contract
     * @param _allowed - Address allowed to mint tokens
     * @param _baseURI - base URI for token URIs
     */
    constructor(string memory _name, string memory _symbol, address _allowed, string memory _baseURI) public ERC721Full(_name, _symbol) {
        allowed = _allowed;
        baseURI = _baseURI;
    }


    /**
     * @dev Issue a new NFT of the specified kind.
     * @notice that will throw if kind has reached its maximum or is invalid
     * @param _beneficiary - owner of the token
     * @param _wearableId - token wearable
     */
    function issueToken(address _beneficiary, string calldata _wearableId) external {
        require(msg.sender == allowed, "Only the `allowed` address can create tokens");
        bytes32 key = keccak256(abi.encodePacked(_wearableId));
        if (maxIssuance[key] > 0 && issued[key] < maxIssuance[key]) {
            issued[key] = issued[key] + 1;
            uint tokenId = this.totalSupply();
            _mint(_beneficiary, tokenId);
            _setTokenURI(
                tokenId,
                string(abi.encodePacked(_wearableId, "/", uint2str(issued[key])))
            );
            emit Issue(_beneficiary, tokenId, key, _wearableId, issued[key]);
        } else {
            revert("invalid: trying to issue an exhausted wearable of nft");
        }
    }

    /**
     * @dev Add a new wearable to the collection.
     * @param _wearableIds - wearable ids
     * @param _maxIssuances - total suppliy for the wearables
     */
    function addWearables(bytes32[] calldata _wearableIds, uint256[] calldata _maxIssuances) external onlyOwner {
        require(_wearableIds.length == _maxIssuances.length, "Parameters should have the same length");

        for (uint256 i = 0; i < _wearableIds.length; i++) {
            string memory wearableId = _bytes32ToString(_wearableIds[i]);
            uint256 maximum = _maxIssuances[i];
            bytes32 key = keccak256(abi.encodePacked(wearableId));

            require(maxIssuance[key] == 0, "Can not modify an existing wearable");
            require(maximum > 0, "Max issuance should be greater than 0");

            maxIssuance[key] = maximum;
            wearables.push(wearableId);

            emit AddWearable(key, wearableId, maximum);
        }
    }

    /**
     * @dev Add a new wearable to the collection.
     * @param _wearableId - wearable id
     * @param _maxIssuance - total suppliy for the wearable
     */
    function addWearable(string calldata _wearableId, uint256 _maxIssuance) external onlyOwner {
        bytes32 key = keccak256(abi.encodePacked(_wearableId));

        require(maxIssuance[key] == 0, "Can not modify an existing wearable");
        require(_maxIssuance > 0, "Max issuance should be greater than 0");

        maxIssuance[key] = _maxIssuance;
        wearables.push(_wearableId);

        emit AddWearable(key, _wearableId, _maxIssuance);
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
        require(_exists(_tokenId), "ERC721Metadata: received a URI query for a nonexistent token");
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
     * @dev Returns the wearables length.
     * @return wearable length
     */
    function wearablesCount() external view returns (uint256) {
        return wearables.length;
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
        require(_exists(_tokenId), "ERC721Metadata: calling set URI for a nonexistent token");
        _tokenPaths[_tokenId] = _uri;
    }

    /**
     * @dev Convert bytes32 to string.
     * @param _x - to be converted to string.
     * @return string
     */
    function _bytes32ToString(bytes32 _x) internal pure returns (string memory) {
        bytes memory bytesString = new bytes(32);
        uint charCount = 0;
        for (uint j = 0; j < 32; j++) {
            byte char = byte(bytes32(uint(_x) * 2 ** (8 * j)));
            if (char != 0) {
                bytesString[charCount] = char;
                charCount++;
            }
        }
        bytes memory bytesStringTrimmed = new bytes(charCount);
        for (uint j = 0; j < charCount; j++) {
            bytesStringTrimmed[j] = bytesString[j];
        }
        return string(bytesStringTrimmed);
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
