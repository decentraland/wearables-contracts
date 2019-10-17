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

    function getToken(address userAddress, string calldata kind) external {
        require(msg.sender == allowed, "Only allowed can create tokens");
        bytes32 key = keccak256(abi.encodePacked(kind));
        if (maxIssuance[key] > 0 && issued[key] < maxIssuance[key]) {
            issued[key] = issued[key] + 1;
            uint tokenId = this.totalSupply();
            _mint(userAddress, tokenId);
            _setTokenURI(
                tokenId,
                string(abi.encodePacked(kind, "/", uint2str(issued[key])))
            );
        } else {
            revert("invalid: trying to issue an exhausted kind of nft");
        }
    }

    function setBaseURI(string calldata _baseURI) external onlyOwner {
        emit BaseURI(baseURI, _baseURI);
        baseURI = _baseURI;
    }

    function setAllowed(address _allowed) external onlyOwner {
        emit Allowed(allowed, _allowed);
        allowed = _allowed;
    }


    /**
     * @dev Returns an URI for a given token ID.
     * Throws if the token ID does not exist. May return an empty string.
     * @param tokenId uint256 ID of the token to query
     */
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");
        return string(abi.encodePacked(baseURI, _tokenPaths[tokenId]));
    }


    function batchTransferFrom(address _from, address _to, uint256[] calldata _tokenIds) external {
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            transferFrom(_from, _to, _tokenIds[i]);
        }
    }

    function safeBatchTransferFrom(address _from, address _to, uint256[] calldata _tokenIds) external {
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            safeTransferFrom(_from, _to, _tokenIds[i], "");
        }
    }

    function safeBatchTransferFrom(address _from, address _to, uint256[] calldata _tokenIds, bytes calldata _data) external {
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            safeTransferFrom(_from, _to, _tokenIds[i], _data);
        }
    }

    /**
     * @dev Override _setTokenURI from standard
     */
    function _setTokenURI(uint256 tokenId, string memory uri) internal {
        require(_exists(tokenId), "ERC721Metadata: URI set of nonexistent token");
        _tokenPaths[tokenId] = uri;
    }


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