pragma solidity ^0.5.11;

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721Full.sol";

import "./libs/String.sol";

contract ERC721BaseCollection is Ownable, ERC721Full {
    using String for bytes32;
    using String for uint256;

    mapping(bytes32 => uint256) public maxIssuance;
    mapping(bytes32 => uint) public issued;
    mapping(uint256 => string) internal _tokenPaths;
    mapping(address => bool) public allowed;

    string[] public wearables;

    string public baseURI;
    bool public isComplete;

    event BaseURI(string _oldBaseURI, string _newBaseURI);
    event Allowed(address indexed _operator, bool _allowed);
    event AddWearable(bytes32 indexed _wearableIdKey, string _wearableId, uint256 _maxIssuance);
    event Issue(address indexed _beneficiary, uint256 indexed _tokenId, bytes32 indexed _wearableIdKey, string _wearableId, uint256 _issuedId);
    event Complete();


    /**
     * @dev Create the contract.
     * @param _name - name of the contract
     * @param _symbol - symbol of the contract
     * @param _operator - Address allowed to mint tokens
     * @param _baseURI - base URI for token URIs
     */
    constructor(string memory _name, string memory _symbol, address _operator, string memory _baseURI) public ERC721Full(_name, _symbol) {
        setAllowed(_operator, true);
        setBaseURI(_baseURI);
    }

    modifier onlyAllowed() {
        require(allowed[msg.sender], "Only an `allowed` address can issue tokens");
        _;
    }


    /**
     * @dev Set Base URI.
     * @param _baseURI - base URI for token URIs
     */
    function setBaseURI(string memory _baseURI) public onlyOwner {
        emit BaseURI(baseURI, _baseURI);
        baseURI = _baseURI;
    }

    /**
     * @dev Set allowed account to issue tokens.
     * @param _operator - Address allowed to issue tokens
     * @param _allowed - Whether is allowed or not
     */
    function setAllowed(address _operator, bool _allowed) public onlyOwner {
        require(_operator != address(0), "Invalid address");
        require(allowed[_operator] != _allowed, "You should set a different value");

        allowed[_operator] = _allowed;
        emit Allowed(_operator, _allowed);
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
     * @dev Complete the collection.
     * @notice that it will only prevent for adding more wearables.
     * The issuance is still allowed.
     */
    function completeCollection() external onlyOwner {
        require(!isComplete, "The collection is already completed");
        isComplete = true;
        emit Complete();
    }

     /**
     * @dev Add a new wearable to the collection.
     * @notice that this method should only allow wearableIds less than or equal to 32 bytes
     * @param _wearableIds - wearable ids
     * @param _maxIssuances - total supply for the wearables
     */
    function addWearables(bytes32[] calldata _wearableIds, uint256[] calldata _maxIssuances) external onlyOwner {
        require(_wearableIds.length == _maxIssuances.length, "Parameters should have the same length");

        for (uint256 i = 0; i < _wearableIds.length; i++) {
            addWearable(_wearableIds[i].bytes32ToString(), _maxIssuances[i]);
        }
    }

    /**
     * @dev Add a new wearable to the collection.
     * @notice that this method allows wearableIds of any size. It should be used
     * if a wearableId is greater than 32 bytes
     * @param _wearableId - wearable id
     * @param _maxIssuance - total supply for the wearable
     */
    function addWearable(string memory _wearableId, uint256 _maxIssuance) public onlyOwner {
        require(!isComplete, "The collection is complete");
        bytes32 key = getWearableKey(_wearableId);

        require(maxIssuance[key] == 0, "Can not modify an existing wearable");
        require(_maxIssuance > 0, "Max issuance should be greater than 0");

        maxIssuance[key] = _maxIssuance;
        wearables.push(_wearableId);

        emit AddWearable(key, _wearableId, _maxIssuance);
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
     * @dev Get keccak256 of a wearableId.
     * @param _wearableId - token wearable
     * @return bytes32 keccak256 of the wearableId
     */
    function getWearableKey(string memory _wearableId) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(_wearableId));
    }

    function _mint(
        address _beneficiary,
        uint256 _tokenId,
        bytes32 _wearableIdKey,
        string memory _wearableId,
        uint256 issuedId
    ) internal {
        // Mint erc721 token
        super._mint(_beneficiary, _tokenId);

        // Increase issuance
        issued[_wearableIdKey] = issued[_wearableIdKey] + 1;

        // Log
        emit Issue(_beneficiary, _tokenId, _wearableIdKey, _wearableId, issuedId);
    }
}
