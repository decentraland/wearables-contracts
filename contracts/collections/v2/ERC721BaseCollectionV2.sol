// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "../../commons//OwnableInitializable.sol";
import "../../tokens/ERC721Initializable.sol";
import "../../libs/String.sol";

contract ERC721BaseCollectionV2 is OwnableInitializable, ERC721Initializable {
    using String for bytes32;
    using String for uint256;
    using String for address;

    bytes32 constant internal EMPTY_CONTENT = bytes32(0);
    uint8 constant public ITEM_ID_BITS = 40;
    uint8 constant public ISSUED_ID_BITS = 216;

    uint40 constant public MAX_ITEM_ID = uint40(-1);
    uint216 constant public MAX_ISSUED_ID = uint216(-1);

    // Rarity
    enum RARITY {
        common,
        uncommon,
        rare,
        epic,
        legendary,
        mythic,
        unique
    }

    struct Item {
        RARITY rarity;
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
    bool public isInitialized;
    bool public isApproved;
    bool public isCompleted;
    bool public isEditable;

    event BaseURI(string _oldBaseURI, string _newBaseURI);

    event SetGlobalMinter(address indexed _minter, bool _value);
    event SetGlobalManager(address indexed _manager, bool _value);
    event SetItemMinter(uint256 indexed _itemId, address indexed _minter, bool _value);
    event SetItemManager(uint256 indexed _itemId, address indexed _manager, bool _value);

    event AddItem(uint256 indexed _itemId, Item _item);
    event RescueItem(uint256 indexed _itemId, bytes32 _contentHash, string _metadata);
    event Issue(address indexed _beneficiary, uint256 indexed _tokenId, uint256 indexed _itemId, uint256 _issuedId);
    event UpdateItem(uint256 indexed _itemId, uint256 _price, address _beneficiary);
    event CreatorshipTransferred(address indexed _previousCreator, address indexed _newCreator);
    event Approve();
    event SetEditable(bool _previousValue, bool _newValue);
    event Complete();

    constructor() internal {}

    /**
     * @notice Create the contract
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
        isInitialized = true;

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
        // Editable
        isEditable = true;

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

    function _isManager(uint256 _itemId) internal view returns (bool) {
        return globalManagers[msg.sender] || itemManagers[_itemId][msg.sender];
    }


    modifier whenNotInitialized() {
        require(!isInitialized, "ERC721BaseCollectionV2#whenNotInitialized: ALREADY_INITIALIZED");
        _;
    }

    modifier whenIsApproved() {
        require(isApproved, "ERC721BaseCollectionV2#whenIsApproved: NOT_APPROVED_YET");
        _;
    }

    modifier onlyCreator() {
        require(
            _isCreator(),
            "ERC721BaseCollectionV2#onlyCreator: CALLER_IS_NOT_CREATOR"
        );
        _;
    }

    modifier canMint(uint256 _itemId) {
        require(
            _isCreator() || _isMinter(_itemId),
            "ERC721BaseCollectionV2#canMint: CALLER_CAN_NOT_MINT"
        );
        _;
    }

    modifier canManage(uint256 _itemId) {
        require(
            _isCreator() || _isManager(_itemId),
            "ERC721BaseCollectionV2#canManage: CALLER_CAN_NOT_MANAGE"
        );
        _;
    }

    /*
    * Creator methods
    */

     /**
     * @notice Set allowed account to manage items.
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

            globalMinters[minter] = value;
            emit SetGlobalMinter(minter, value);
        }
    }

    /**
     * @notice Set allowed account to manage items.
     * @param _itemIds - item ids
     * @param _minters - minter addresses
     * @param _values - values array
     */
    function setItemsMinters(
        uint256[] calldata _itemIds,
        address[] calldata _minters,
        bool[] calldata _values
    ) external onlyCreator {
        require(
            _itemIds.length == _minters.length  && _minters.length == _values.length,
            "ERC721BaseCollectionV2#setItemsMinters: LENGTH_MISSMATCH"
        );

        for (uint256 i = 0; i < _minters.length; i++) {
            address minter = _minters[i];
            uint256 itemId = _itemIds[i];
            bool value = _values[i];
            require(minter != address(0), "ERC721BaseCollectionV2#setItemsMinters: INVALID_MINTER_ADDRESS");
            require(itemId < items.length, "ERC721BaseCollectionV2#setItemsMinters: ITEM_DOES_NOT_EXIST");
            require(itemMinters[itemId][minter] != value, "ERC721BaseCollectionV2#setItemsMinters: VALUE_IS_THE_SAME");

            itemMinters[itemId][minter] = value;
            emit SetItemMinter(itemId, minter, value);
        }
    }

    /**
     * @notice Set allowed account to manage items.
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

            globalManagers[manager] = value;
            emit SetGlobalManager(manager, value);
        }
    }

    /**
     * @notice Set allowed account to manage items.
     * @param _itemIds - item ids to set managers
     * @param _managers - Addresses allowed to manage items
     * @param _values - Whether is allowed or not
     */
    function setItemsManagers(
        uint256[] calldata _itemIds,
        address[] calldata _managers,
        bool[] calldata _values
    ) external onlyCreator {
        require(
            _itemIds.length == _managers.length && _managers.length == _values.length,
            "ERC721BaseCollectionV2#setItemsManagers: LENGTH_MISSMATCH"
        );

        for (uint256 i = 0; i < _managers.length; i++) {
            address manager = _managers[i];
            uint256 itemId = _itemIds[i];
            bool value = _values[i];
            require(manager != address(0), "ERC721BaseCollectionV2#setItemsManagers: INVALID_MANAGER_ADDRESS");
            require(itemId < items.length, "ERC721BaseCollectionV2#setItemsManagers: ITEM_DOES_NOT_EXIST");
            require(itemManagers[itemId][manager] != value, "ERC721BaseCollectionV2#setItemsManagers: VALUE_IS_THE_SAME");

            itemManagers[itemId][manager] = value;
            emit SetItemManager(itemId, manager, value);
        }
    }

    /**
     * @notice Complete the collection.
     * @dev Disable forever the possibility of adding new items in the collection.
     * The issuance is still allowed.
     */
    function completeCollection() external onlyCreator {
        require(!isCompleted, "ERC721BaseCollectionV2#completeCollection: COLLECTION_ALREADY_COMPLETED");

        _completeCollection();
    }

    function _completeCollection() internal {
        isCompleted = true;
        emit Complete();
    }

    /**
     * @dev Add items to the collection.
     * @param _items - items to add
     */
    function addItems(Item[] memory _items) external virtual onlyCreator {
        require(!isCompleted, "ERC721BaseCollectionV2#_addItem: COLLECTION_COMPLETED");

        for (uint256 i = 0; i < _items.length; i++) {
            _addItem(_items[i]);
        }
    }

    /*
    * Manager & Minters methods
    */

    /**
     * @dev Issue a new token of the specified item.
     * @notice that will throw if the item has reached its maximum or is invalid
     * @param _beneficiary - owner of the token
     * @param _itemId - item id
     */
    function issueToken(address _beneficiary,  uint256 _itemId) external virtual whenIsApproved() {
        _issueToken(_beneficiary, _itemId);
    }

    /**
     * @notice Issue tokens by item ids.
     * @dev Will throw if the items have reached its maximum or is invalid
     * @param _beneficiaries - owner of the tokens
     * @param _itemIds - item ids
     */
    function issueTokens(address[] calldata _beneficiaries, uint256[] calldata _itemIds) external virtual whenIsApproved() {
        require(_beneficiaries.length == _itemIds.length, "ERC721BaseCollectionV2#issueTokens: LENGTH_MISSMATCH");

        for (uint256 i = 0; i < _itemIds.length; i++) {
            _issueToken(_beneficiaries[i], _itemIds[i]);
        }
    }

    /**
     * @notice Issue a new token of the specified item.
     * @dev Will throw if the item has reached its maximum or is invalid
     * @param _beneficiary - owner of the token
     * @param _itemId - item id
     */
    function _issueToken(address _beneficiary, uint256 _itemId) internal virtual canMint(_itemId) {
        // Check item id
        require(_itemId < items.length, "ERC721BaseCollectionV2#_issueToken: ITEM_DOES_NOT_EXIST");

        Item storage item = items[_itemId];
        uint256 currentIssuance = item.totalSupply.add(1);

        // Check issuance
        require(currentIssuance <= getRarityValue(item.rarity), "ERC721BaseCollectionV2#_issueToken: ITEM_EXHAUSTED");

        // Encode token id
        uint256 tokenId = encodeTokenId(_itemId, currentIssuance);

        // Increase issuance
        item.totalSupply = currentIssuance;

        // Mint token to beneficiary
        super._mint(_beneficiary, tokenId);

        // Log
        emit Issue(_beneficiary, tokenId, _itemId, currentIssuance);
    }

    function editItems(
        uint256[] calldata _itemIds,
        uint256[] calldata _prices,
        address[] calldata _beneficiaries
    ) external virtual {
        // Check lengths
        require(
            _itemIds.length == _prices.length && _prices.length == _beneficiaries.length,
            "ERC721BaseCollectionV2#editItems: LENGTH_MISSMATCH"
        );

        // Check item id
        for (uint256 i = 0; i < _itemIds.length; i++) {
            uint256 itemId = _itemIds[i];
            uint256 price = _prices[i];
            address beneficiary = _beneficiaries[i];

            require(_isCreator() || _isManager(itemId), "ERC721BaseCollectionV2#editItems: CALLER_IS_NOT_CREATOR_OR_MANAGER");
            require(itemId < items.length, "ERC721BaseCollectionV2#editItems: ITEM_DOES_NOT_EXIST");
            require(
                price > 0 && beneficiary != address(0) || price == 0 && beneficiary == address(0),
                "ERC721BaseCollectionV2#editItems: INVALID_PRICE_AND_BENEFICIARY"
            );

            Item storage item = items[itemId];
            item.price = price;
            item.beneficiary = beneficiary;

            emit UpdateItem(itemId, price, beneficiary);
        }
    }

     /**
     * @notice Add items to the collection
     * @dev Used only at initialize
     * @param _items - items to add
     */
    function _initializeItems(Item[] memory _items) internal {
        for (uint256 i = 0; i < _items.length; i++) {
            _addItem(_items[i]);
        }
    }

    /**
     * @notice Add a new item to the collection.
     * @dev The item should follow:
     * rarity: Should be one of the RARITY enum
     * totalSupply: Should starts in 0
     * metadata: Shouldn't be empty
     * price & beneficiary: Is the price is > 0, a beneficiary should be passed. If not, price and
     *   beneficiary should be empty.
     * contentHash: Should be the an empty hash
     * @param _item - item to add
     */
    function _addItem(Item memory _item) internal {
        uint256 rarity = getRarityValue(_item.rarity);
        require(
           rarity > 0 && rarity <= MAX_ISSUED_ID,
            "ERC721BaseCollectionV2#_addItem: INVALID_RARITY"
        );
        require(
            _item.totalSupply == 0,
            "ERC721BaseCollectionV2#_addItem: INVALID_TOTAL_SUPPLY"
        );
        require(bytes(_item.metadata).length > 0, "ERC721BaseCollectionV2#_addItem: EMPTY_METADATA");
        require(
            _item.price > 0 && _item.beneficiary != address(0) || _item.price == 0 && _item.beneficiary == address(0),
            "ERC721BaseCollectionV2#_addItem: INVALID_PRICE_AND_BENEFICIARY"
        );
        require(_item.contentHash == EMPTY_CONTENT, "ERC721BaseCollectionV2#_addItem: CONTENT_HASH_SHOULD_BE_EMPTY");

        uint256 newItemId = items.length;
        require(newItemId < MAX_ITEM_ID, "ERC721BaseCollectionV2#_addItem: MAX_ITEM_ID_REACHED");

        items.push(_item);

        emit AddItem(newItemId, _item);
    }

    /*
    * Owner Methods
    */

    /**
    * @notice Approve a collection
    * @notice Once the collection is approved, items can be minted and transferred
    */
    function approveCollection() external virtual onlyOwner {
        require(!isApproved, "ERC721BaseCollectionV2#approveCollection: ALREADY_APPROVED");

        isApproved = true;
        emit Approve();
    }

    /**
    * @notice Rescue an item by providing new metadata and/or content hash
    * @dev Only the owner can rescue an item. This function should be used
    * to resolve a dispute or fix a broken metadata or hashContent item
    * @param _itemIds - Item ids to be fixed
    * @param _contentHashes - New items content hash
    * @param _metadatas - New items metadata
    */
    function rescueItems(
        uint256[] calldata _itemIds,
        bytes32[] calldata _contentHashes,
        string[] calldata _metadatas
    ) external onlyOwner {
        // Check lengths
        require(
            _itemIds.length == _contentHashes.length && _contentHashes.length == _metadatas.length,
            "ERC721BaseCollectionV2#rescueItems: LENGTH_MISSMATCH"
        );

        for (uint256 i = 0; i < _itemIds.length; i++) {
            uint256 itemId = _itemIds[i];
            require(itemId < items.length, "ERC721BaseCollectionV2#rescueItems: ITEM_DOES_NOT_EXIST");

            Item storage item = items[itemId];

            bytes32 contentHash = _contentHashes[i];
            string memory metadata = _metadatas[i];

            item.contentHash = contentHash;

            if (bytes(metadata).length > 0) {
                item.metadata = metadata;
            }

            emit RescueItem(itemId, contentHash, item.metadata);
        }
    }

    /**
     * @notice Transfers ownership of the contract to a new account (`newOwner`).
     */
    function transferCreatorship(address _newCreator) public virtual {
        require(msg.sender == owner() || msg.sender == creator, "ERC721BaseCollectionV2#transferCreatorship: CALLER_IS_NOT_OWNER_OR_CREATOR");
        require(_newCreator != address(0), "ERC721BaseCollectionV2#transferCreatorship: INVALID_CREATOR_ADDRESS");

        emit CreatorshipTransferred(creator, _newCreator);
        creator = _newCreator;
    }

    /**
     * @notice Set Base URI
     * @param _baseURI - base URI for token URIs
     */
    function setBaseURI(string memory _baseURI) public onlyOwner {
        emit BaseURI(baseURI(), _baseURI);
        _setBaseURI(_baseURI);
    }

    /**
     * @notice Set whether the collection can be editable or not.
     * @dev This property is used off-chain to check whether the items of the collection
     * can be updated or not
     * @param _value - Value to set
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
     * @dev Returns an URI for a given token ID.
     * Throws if the token ID does not exist. May return an empty string.
     * @param _tokenId - uint256 ID of the token queried
     * @return token URI
     */
    function tokenURI(uint256 _tokenId) public view virtual override returns (string memory) {
        require(_exists(_tokenId), "ERC721Metadata: received a URI query for a nonexistent token");

        (uint256 itemId, uint256 issuedId) = decodeTokenId(_tokenId);

        return string(
            abi.encodePacked(
                baseURI(),
                "0x",
                address(this).addressToString(),
                "/",
                itemId.uintToString(),
                "/",
                issuedId.uintToString()
            )
        );
    }

     /**
     * @notice Encode token id
     * @dev itemId (`itemIdBits` bits) + issuedId (`issuedIdBits` bits)
     * @param _itemId - item id
     * @param _issuedId - issued id
     * @return id uint256 of the encoded id
     */
    function encodeTokenId(uint256 _itemId, uint256 _issuedId) public pure returns (uint256 id) {
        require(_itemId <= MAX_ITEM_ID, "ERC721BaseCollectionV2#encodeTokenId: INVALID_ITEM_ID");
        require(_issuedId <= MAX_ISSUED_ID, "ERC721BaseCollectionV2#encodeTokenId: INVALID_ISSUED_ID");

        // solium-disable-next-line security/no-inline-assembly
        assembly {
            id := or(shl(ISSUED_ID_BITS, _itemId), _issuedId)
        }
    }

    /**
     * @notice Decode token id
     * @dev itemId (`itemIdBits` bits) + issuedId (`issuedIdBits` bits)
     * @param _id - token id
     * @return itemId uint256 of the item id
     * @return issuedId uint256 of the issued id
     */
    function decodeTokenId(uint256 _id) public pure returns (uint256 itemId, uint256 issuedId) {
        uint256 mask = MAX_ISSUED_ID;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            itemId := shr(ISSUED_ID_BITS, _id)
            issuedId := and(mask, _id)
        }
    }

    /**
     * @notice Returns the amount of item in the collection
     * @return Amount of items in the collection
     */
    function itemsCount() external view returns (uint256) {
        return items.length;
    }

    /**
     * @notice Transfers the ownership of given tokens ID to another address.
     * Usage of this method is discouraged, use {safeBatchTransferFrom} whenever possible.
     * Requires the msg.sender to be the owner, approved, or operator.
     * @param _from current owner of the token
     * @param _to address to receive the ownership of the given token ID
     * @param _tokenIds uint256 ID of the token to be transferred
     */
    function batchTransferFrom(address _from, address _to, uint256[] calldata _tokenIds) public {
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            transferFrom(_from, _to, _tokenIds[i]);
        }
    }

    /**
     * @notice Safely transfers the ownership of given token IDs to another address
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
     * @notice Safely transfers the ownership of given token IDs to another address
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

    function getRarityValue(RARITY _rarity) public pure returns (uint256) {
           if (_rarity == RARITY.common) {
               return 100000;
            } else  if (_rarity == RARITY.uncommon) {
               return 10000;
            } else  if (_rarity == RARITY.rare) {
               return 5000;
            } else  if (_rarity == RARITY.epic) {
               return 1000;
            } else  if (_rarity == RARITY.legendary) {
               return 100;
            } else  if (_rarity == RARITY.mythic) {
               return 10;
            } else  if (_rarity == RARITY.unique) {
               return 1;
            }

            revert("#ERC721BaseCollectionV2#getRarityValue: INVALID_RARITY");
    }

    function getRarityName(RARITY _rarity) public pure returns (string memory) {
           if (_rarity == RARITY.common) {
               return "common";
            } else  if (_rarity == RARITY.uncommon) {
               return "uncommon";
            } else  if (_rarity == RARITY.rare) {
               return "rare";
            } else  if (_rarity == RARITY.epic) {
               return "epic";
            } else  if (_rarity == RARITY.legendary) {
               return "legendary";
            } else  if (_rarity == RARITY.mythic) {
               return "mythic";
            } else  if (_rarity == RARITY.unique) {
               return "unique";
            }

            revert("#ERC721BaseCollectionV2#getRarityName: INVALID_RARITY");
    }
}
