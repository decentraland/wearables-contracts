// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "../../commons//OwnableInitializable.sol";
import "../../tokens/ERC721Initializable.sol";
import "../../libs/String.sol";

contract ERC721BaseCollectionV2 is OwnableInitializable, ERC721Initializable {
    using String for bytes32;
    using String for uint256;

    uint8 constant public OPTIONS_BITS = 40;
    uint8 constant public ISSUANCE_BITS = 216;

    uint40 constant public MAX_OPTIONS = uint40(-1);
    uint216 constant public MAX_ISSUANCE = uint216(-1);

    struct Item {
        uint256 maxSupply; // rarity
        uint256 totalSupply; // current supply
        uint256 price;
        address beneficiary;
        string metadata;
        bytes32 contentHash; // used for safe purposes
    }

    // Roles
    address public creator;
    mapping(address => bool) public globalMinters;
    mapping(address => bool) public globalManagers;
    mapping(uint256 => mapping (address => bool)) public itemMinters;
    mapping(uint256 => mapping (address => bool)) public itemManagers;

    Item[] public items;

    // Status
    bool public initialized;
    bool public isComplete;
    bool public isEditable;

    event BaseURI(string _oldBaseURI, string _newBaseURI);

    event SetGlobalMinter(address indexed _manager, bool _value);
    event SetGlobalManager(address indexed _manager, bool _value);
    event SetItemMinter(address indexed _manager, uint256 indexed _itemId, bool _value);
    event SetItemManager(address indexed _manager, uint256 indexed _itemId, bool _value);

    event AddItem(uint256 indexed _itemId, Item _item);
    event RescueItem(uint256 indexed _itemId, Item _item);
    event Issue(address indexed _beneficiary, uint256 indexed _tokenId, uint256 indexed _itemId, uint256 _issuedId);
    event UpdateItem(uint256 indexed _itemId, uint256 _price, address _beneficiary);
    event CreatorshipTransferred(address indexed _previousCreator, address indexed _newCreator);
    event SetEditable(bool __previousValue, bool _newValue);
    event Complete();

    constructor() internal {}

    /**
     * @dev Create the contract.
     * @param _name - name of the contract
     * @param _symbol - symbol of the contract
     * @param _creator - creator address
     * @param _shouldComplete - Whether the collection should be completed by the end of this call.
     * @param _baseURI - base URI for token URIs
     * @param _items - items to be added
     */
    function initialize(
        string memory _name,
        string memory _symbol,
        address _creator,
        bool _shouldComplete,
        string memory _baseURI,
        Item[] memory _items
    ) public virtual whenNotInitialized {
        initialized = true;

        require(_creator != address(0), "ERC721BaseCollectionV2#initialize: INVALID_CREATOR");
        // Ownable init
        //@TODO: check if ownable needs to inherit from Context and this event should be emitted
        _initOwnable();
        // ERC721 init
        _initERC721(_name, _symbol);
        // Base URI init
        setBaseURI(_baseURI);
        // Creator init
        creator = _creator;
        // Items init
        _initializeItems(_items);

        if (_shouldComplete) {
            _completeCollection();
        }
    }

    /*
    * Modifiers & Roles checkers
    */

    function _isCreator() internal view returns (bool) {
        return creator == msg.sender;
    }

    function _isMinter(uint256 _itemId) internal view returns (bool) {
        return globalMinters[msg.sender] || itemMinters[_itemId][msg.sender];
    }

    function isManager(uint256 _itemId) internal view returns (bool) {
        return globalManagers[msg.sender] || itemManagers[_itemId][msg.sender];
    }


    modifier whenNotInitialized() {
        require(!initialized, "ERC721BaseCollectionV2#whenNotInitialized: ALREADY_INITIALIZED");
        _;
    }

    modifier onlyCreator() {
        require(
            _isCreator(),
            "ERC721BaseCollectionV2#onlyMinter: CALLER_IS_NOT_CREATOR"
        );
        _;
    }

    modifier canMint(uint256 _itemId) {
        require(
            _isCreator() || _isMinter(_itemId),
            "ERC721BaseCollectionV2#onlyMinter: CALLER_CAN_NOT_MINTER"
        );
        _;
    }

    modifier canManage(uint256 _itemId) {
        require(
            _isCreator() || isManager(_itemId),
            "ERC721BaseCollectionV2#onlyMinter: CALLER_CAN_NOT_MANAGER"
        );
        _;
    }

    /*
    * Creator methods
    */

     /**
     * @dev Set allowed account to manage items.
     * @param _minters - minter addresses
     * @param _values - values array
     */
    function setMinters(address[] calldata _minters, bool[] calldata _values) external onlyCreator {
        require(
            _minters.length == _values.length,
            "ERC721BaseCollectionV2#setMinters: LENGTH_MISSMATCH"
        );

        for (uint256 i = 0; i < _minters.length; i++) {
            address minter = _minters[i];
            bool value = _values[i];
            require(minter != address(0), "ERC721BaseCollectionV2#setMinters: INVALID_MINTER_ADDRESS");
            require(globalMinters[minter] != value, "ERC721BaseCollectionV2#setMinters: VALUE_IS_THE_SAME");

            globalMinters[minter] != value;
            emit SetGlobalMinter(minter, value);
        }
    }

    /**
     * @dev Set allowed account to manage items.
     * @param _minters - minter addresses
     * @param _itemIds - item ids
     * @param _values - values array
     */
    function setItemsMinters(
        address[] calldata _minters,
        uint256[] calldata _itemIds,
        bool[] calldata _values
    ) external onlyCreator {
        require(
            _minters.length == _itemIds.length && _itemIds.length == _values.length,
            "ERC721BaseCollectionV2#setItemManager: LENGTH_MISSMATCH"
        );

        for (uint256 i = 0; i < _minters.length; i++) {
            address minter = _minters[i];
            uint256 itemId = _itemIds[i];
            bool value = _values[i];
            require(minter != address(0), "ERC721BaseCollectionV2#setItemsMinters: INVALID_MINTER_ADDRESS");
            require(itemId < items.length, "ERC721BaseCollectionV2#setItemsMinters: ITEM_DOES_NOT_EXIST");
            require(itemMinters[itemId][minter] != value, "ERC721BaseCollectionV2#setItemsMinters: VALUE_IS_THE_SAME");

            itemMinters[itemId][minter] != value;
            emit SetItemMinter(minter, itemId, value);
        }
    }

    /**
     * @dev Set allowed account to manage items.
     * @param _managers - Address allowed to manage items
     * @param _values - Whether is allowed or not
     */
    function setManagers(address[] calldata _managers, bool[] calldata _values) external onlyCreator {
        require(
            _managers.length == _values.length,
            "ERC721BaseCollectionV2#setManagers: LENGTH_MISSMATCH"
        );

        for (uint256 i = 0; i < _managers.length; i++) {
            address manager = _managers[i];
            bool value = _values[i];
            require(manager != address(0), "ERC721BaseCollectionV2#setManagers: INVALID_MANAGER_ADDRESS");
            require(globalManagers[manager] != value, "ERC721BaseCollectionV2#setManagers: VALUE_IS_THE_SAME");

            globalManagers[manager] != value;
            emit SetGlobalManager(manager, value);
        }
    }

    /**
     * @dev Set allowed account to manage items.
     * @param _managers - Addresses allowed to manage items
     * @param _itemIds - item ids to set managers
     * @param _values - Whether is allowed or not
     */
    function setItemsManagers(
        address[] calldata _managers,
        uint256[] calldata _itemIds,
        bool[] calldata _values
    ) external onlyCreator {
        require(
            _managers.length == _itemIds.length && _itemIds.length == _values.length,
            "ERC721BaseCollectionV2#setItemManager: LENGTH_MISSMATCH"
        );

        for (uint256 i = 0; i < _managers.length; i++) {
            address manager = _managers[i];
            uint256 itemId = _itemIds[i];
            bool value = _values[i];
            require(manager != address(0), "ERC721BaseCollectionV2#setItemsManagers: INVALID_MANAGER_ADDRESS");
            require(itemId < items.length, "ERC721BaseCollectionV2#setItemsManagers: ITEM_DOES_NOT_EXIST");
            require(itemManagers[itemId][manager] != value, "ERC721BaseCollectionV2#setItemsManagers: VALUE_IS_THE_SAME");

            itemManagers[itemId][manager] != value;
            emit SetItemManager(manager, itemId, value);
        }
    }

    /**
     * @dev Complete the collection.
     * @notice that it will only prevent for adding more wearables.
     * The issuance is still allowed.
     */
    function completeCollection() external onlyCreator {
        require(!isComplete, "The collection is already completed");

        _completeCollection();
    }

    function _completeCollection() internal {
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
        _addItem(_item);
    }

    /*
    * Manager methods
    */

    function editItems(
        uint256[] calldata _itemIds,
        uint256[] calldata _prices,
        address[] calldata _beneficiaries
    ) external virtual {
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

            require(_isCreator() || isManager(itemId), "ERC721BaseCollectionV2#editItems: CALLER_IS_NOT_CREATOR_OR_MANAGER");
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
     * @dev Add items to the collection.
     * @param _items - items to add
     */
    function _initializeItems(Item[] memory _items) internal {
        for (uint256 i = 0; i < _items.length; i++) {
            _addItem(_items[i]);
        }
    }

    /**
     * @dev Add a new item to the collection.
     * @param _item - item to add
     */
    function _addItem(Item memory _item) internal {
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

    /*
    * Owner Methods
    */

    function rescueItems(
        uint256[] calldata _itemIds,
        Item[] memory _items
    ) external onlyOwner {
        // Check lengths
        require(
            _itemIds.length == _items.length,
            "ERC721BaseCollectionV2#rescueItems LENGTH_MISSMATCH"
        );

        // Check item id
        //@TODO: check requires needed
        for (uint256 i = 0; i < _itemIds.length; i++) {
            uint256 itemId = _itemIds[i];
            Item memory item = _items[i];

            require(itemId < items.length, "ERC721BaseCollectionV2#editItems ITEM_DOES_NOT_EXIST");

            items[itemId] = item;

            emit RescueItem(itemId, item);
        }
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferCreatorship(address _newCreator) public virtual {
        require(msg.sender == owner() || msg.sender == creator, "ERC721BaseCollectionV2#transferCreatorship: CALLER_IS_NOT_OWNER_OR_CREATOR");
        require(_newCreator != address(0), "ERC721BaseCollectionV2#transferCreatorship: INVALID_CREATOR_ADDRESS");

        emit CreatorshipTransferred(creator, _newCreator);
        creator = _newCreator;
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
     * @dev Complete the collection.
     * @notice that it will only prevent for adding more wearables.
     * The issuance is still allowed.
     */
    function setEditable(bool _value) external onlyOwner {
        require(isEditable != _value, "ERC721BaseCollectionV2#setEditable: VALUE_IS_THE_SAME");

        emit SetEditable(isEditable, _value);

        isEditable = _value;
    }

    /*
    * User base methods
    */

    /**
     * @dev Returns the item length.
     * @return Amount of items in the collection
     */
    function itemsCount() external view returns (uint256) {
        return items.length;
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
}
