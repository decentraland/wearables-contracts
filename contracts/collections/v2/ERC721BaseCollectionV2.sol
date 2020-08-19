// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";

import "../../tokens/ERC721.sol";
import "../../libs/String.sol";

contract ERC721BaseCollectionV2 is Ownable, ERC721 {
    using String for bytes32;
    using String for uint256;

    uint8 constant public OPTIONS_BITS = 40;
    uint8 constant public ISSUANCE_BITS = 216;

    uint40 constant public MAX_OPTIONS = uint40(-1);
    uint216 constant public MAX_ISSUANCE = uint216(-1);

    struct Item {
        uint256 maxSupply; // rarity
        uint256 totalSupply; // current supply
        address beneficiary;
        uint256 price;
        string metadata;
    }

    // Roles
    address public creator;
    mapping(address => bool) public globalMinters;
    mapping(address => bool) public globalManagers;
    mapping(uint256 => mapping (address => bool)) public itemMinters;
    mapping(uint256 => mapping (address => bool)) public itemManagers;

    Item[] public items;

    bool public isComplete;

    event BaseURI(string _oldBaseURI, string _newBaseURI);
    event Allowed(address indexed _operator, bool _allowed);
    event AddItem(uint256 indexed _itemId, Item item);
    event Issue(address indexed _beneficiary, uint256 indexed _tokenId, uint256 indexed _itemId, uint256 _issuedId);
    event UpdateItem(uint256 indexed _itemId, uint256 _price, address _beneficiary);
    event CreatorshipTransferred(address indexed _previousCreator, address indexed _newCreator);
    event Complete();


    /**
     * @dev Create the contract.
     * @param _name - name of the contract
     * @param _symbol - symbol of the contract
     * @param _operator - Address allowed to mint tokens
     * @param _baseURI - base URI for token URIs
     */
    constructor(string memory _name, string memory _symbol, address _operator, string memory _baseURI) public ERC721(_name, _symbol) {
        // setAllowed(_operator, true);
        setBaseURI(_baseURI);
        creator = msg.sender;
    }

     modifier onlyCreator() {
        require(
            creator == msg.sender,
            "ERC721BaseCollectionV2#onlyMinter: CALLER_IS_NOT_CREATOR"
        );
        _;
    }

    modifier onlyMinter(uint256 _itemId) {
        require(
            creator == msg.sender || globalMinters[msg.sender] || itemMinters[_itemId][msg.sender],
            "ERC721BaseCollectionV2#onlyMinter: CALLER_IS_NOT_MINTER"
        );
        _;
    }

    modifier onlyManager(uint256 _itemId) {
        require(
            creator == msg.sender || globalManagers[msg.sender] || itemManagers[_itemId][msg.sender],
            "ERC721BaseCollectionV2#onlyMinter: CALLER_IS_NOT_MANAGER"
        );
        _;
    }

    /**
     * @dev Set Base URI.
     * @param _baseURI - base URI for token URIs
     */
    function setBaseURI(string memory _baseURI) public onlyOwner {
        emit BaseURI(baseURI(), _baseURI);
        _setBaseURI(_baseURI);
    }

    /**
     * @dev Set allowed account to manage items.
     * @param _manager - Address allowed to manage items
     * @param _allowed - Whether is allowed or not
     */
    function setManager(address _manager, bool _allowed) public onlyCreator {
        require(_manager != address(0), "Invalid address");
        require(globalManagers[_manager] != _allowed, "You should set a different value");

        globalManagers[_manager] = _allowed;
        emit Allowed(_manager, _allowed);
    }

    /**
     * @dev Returns the item length.
     * @return Amount of items in the collection
     */
    function itemsCount() external view returns (uint256) {
        return items.length;
    }

    /**
     * @dev Complete the collection.
     * @notice that it will only prevent for adding more wearables.
     * The issuance is still allowed.
     */
    function completeCollection() external onlyCreator {
        require(!isComplete, "The collection is already completed");
        isComplete = true;
        emit Complete();
    }

     /**
     * @dev Add items to the collection.
     * @param _items - items to add
     */
    function addItems(Item[] memory _items) external {
        for (uint256 i = 0; i < _items.length; i++) {
            addItem(_items[i]);
        }
    }

    /**
     * @dev Add a new item to the collection.
     * @param _item - item to add
     */
    function addItem(Item memory _item) public virtual onlyCreator {
        require(!isComplete, "The collection is complete");
        require(
            _item.maxSupply > 0 && _item.maxSupply <= MAX_ISSUANCE,
            "ERC721BaseCollectionV2#addItem: INVALID_MAX_SUPPLY"
        );
        require(bytes(_item.metadata).length > 0, "ERC721BaseCollectionV2#addItem: EMPTY_METADATA");
        require(
            _item.price > 0 && _item.beneficiary != address(0),
            "ERC721BaseCollectionV2#addItem: MISSING_BENEFICIARY"
        );
        require(items.length < MAX_OPTIONS, "ERC721BaseCollectionV2#addItem: MAX_OPTIONS_REACHED");

        items.push(_item);

        emit AddItem(items.length - 1, _item);
    }

    function editItems(
        uint256[] calldata _itemIds,
        uint256[] calldata _prices,
        address[] calldata _beneficiaries
    ) external virtual /* onlyManager(_itemId) */ {
        // Check lengths
        require(
            _itemIds.length == _prices.length && _prices.length == _beneficiaries.length,
            "ERC721BaseCollectionV2#editItems LENGTH_MISSMATCH"
        );

        // Check item id
        for (uint256 i = 0; i < _itemIds.length; i++) {
            uint256 itemId = _itemIds[i];
            uint256 price = _prices[i];
            address beneficiary = _beneficiaries[i];

            require(itemId < items.length, "ERC721BaseCollectionV2#editItems ITEM_DOES_NOT_EXIST");
            require(
                price > 0 && beneficiary != address(0),
                "ERC721BaseCollectionV2#editItems: MISSING_BENEFICIARY"
            );
            Item storage item = items[itemId];

            item.price = price;
            item.beneficiary = beneficiary;

            emit UpdateItem(itemId, price, beneficiary);
        }
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

    // @TODO: check this method
    // onlyOwner or creator
    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferCreatorship(address _newCreator) public virtual onlyOwner {
        require(_newCreator != address(0), "ERC721BaseCollectionV2#transferCreatorship: NON_ZERO_ADDRESS");
        emit CreatorshipTransferred(creator, _newCreator);
        creator = _newCreator;
    }
}
