// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "../../commons//OwnableInitializable.sol";
import "../../commons//NativeMetaTransaction.sol";
import "../../tokens/ERC721Initializable.sol";
import "../../libs/String.sol";

contract ERC721BaseCollectionV2 is OwnableInitializable, ERC721Initializable, NativeMetaTransaction {
    using String for bytes32;
    using String for uint256;
    using String for address;

    bytes32 constant internal EMPTY_CONTENT = bytes32(0);
    uint8 constant public ITEM_ID_BITS = 40;
    uint8 constant public ISSUED_ID_BITS = 216;

    uint40 constant public MAX_ITEM_ID = uint40(-1);
    uint216 constant public MAX_ISSUED_ID = uint216(-1);

    /// @dev time for the collection to be auto approved
    uint256 constant public GRACE_PERIOD = 60 * 60 * 24 * 7; // 7 days

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
    mapping(uint256 => mapping (address => uint256)) public itemMinters;
    mapping(uint256 => mapping (address => bool)) public itemManagers;

    Item[] public items;

    // Status
    uint256 public createdAt;
    bool public isInitialized;
    bool public isCompleted;
    bool public isEditable;
    bool public isApproved;

    event BaseURI(string _oldBaseURI, string _newBaseURI);

    event SetGlobalMinter(address indexed _minter, bool _value);
    event SetGlobalManager(address indexed _manager, bool _value);
    event SetItemMinter(uint256 indexed _itemId, address indexed _minter, uint256 _value);
    event SetItemManager(uint256 indexed _itemId, address indexed _manager, bool _value);

    event AddItem(uint256 indexed _itemId, Item _item);
    event RescueItem(uint256 indexed _itemId, bytes32 _contentHash, string _metadata);
    event Issue(address indexed _beneficiary, uint256 indexed _tokenId, uint256 indexed _itemId, uint256 _issuedId);
    event UpdateItemSalesData(uint256 indexed _itemId, uint256 _price, address _beneficiary);
    event UpdateItemMetadata(uint256 indexed _itemId, string _metadata);
    event CreatorshipTransferred(address indexed _previousCreator, address indexed _newCreator);
    event SetApproved(bool _previousValue, bool _newValue);
    event SetEditable(bool _previousValue, bool _newValue);
    event Complete();

   /*
    * Init functions
    */

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
    ) public virtual {
        require(!isInitialized, "BCV2#initialize: ALREADY_INITIALIZED");
        isInitialized = true;

        require(_creator != address(0), "BCV2#initialize: INVALID_CREATOR");
        // Ownable init
        _initOwnable();
        // EIP712 init
        _initializeEIP712('Decentraland Collection', '2');
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

        isEditable = true;
        isApproved = true;
        createdAt = now;
    }

    /*
    * Roles checkers
    */

    function _isCreator() internal view returns (bool) {
        return creator == _msgSender();
    }

    function _isManager(uint256 _itemId) internal view returns (bool) {
        address sender = _msgSender();
        return globalManagers[sender] || itemManagers[_itemId][sender];
    }

    modifier onlyCreator() {
        require(
            _isCreator(),
            "BCV2#onlyCreator: CALLER_IS_NOT_CREATOR"
        );
        _;
    }

    /*
    * Role functions
    */

    /**
     * @notice Set allowed account to manage items.
     * @param _minters - minter addresses
     * @param _values - values array
     */
    function setMinters(address[] calldata _minters, bool[] calldata _values) external onlyCreator {
        require(
            _minters.length == _values.length,
            "BCV2#setMinters: LENGTH_MISMATCH"
        );

        for (uint256 i = 0; i < _minters.length; i++) {
            address minter = _minters[i];
            bool value = _values[i];
            require(minter != address(0), "BCV2#setMinters: INVALID_MINTER_ADDRESS");
            require(globalMinters[minter] != value, "BCV2#setMinters: VALUE_IS_THE_SAME");

            globalMinters[minter] = value;
            emit SetGlobalMinter(minter, value);
        }
    }

    /**
     * @notice Set allowed account to mint items.
     * @param _itemIds - item ids
     * @param _minters - minter addresses
     * @param _values - values array
     */
    function setItemsMinters(
        uint256[] calldata _itemIds,
        address[] calldata _minters,
        uint256[] calldata _values
    ) external onlyCreator {
        require(
            _itemIds.length == _minters.length  && _minters.length == _values.length,
            "BCV2#setItemsMinters: LENGTH_MISMATCH"
        );

        for (uint256 i = 0; i < _minters.length; i++) {
            address minter = _minters[i];
            uint256 itemId = _itemIds[i];
            uint256 value = _values[i];
            require(minter != address(0), "BCV2#setItemsMinters: INVALID_MINTER_ADDRESS");
            require(itemId < items.length, "BCV2#setItemsMinters: ITEM_DOES_NOT_EXIST");
            require(itemMinters[itemId][minter] != value, "BCV2#setItemsMinters: VALUE_IS_THE_SAME");

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
            "BCV2#setManagers: LENGTH_MISMATCH"
        );

        for (uint256 i = 0; i < _managers.length; i++) {
            address manager = _managers[i];
            bool value = _values[i];
            require(manager != address(0), "BCV2#setManagers: INVALID_MANAGER_ADDRESS");
            require(globalManagers[manager] != value, "BCV2#setManagers: VALUE_IS_THE_SAME");

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
            "BCV2#setItemsManagers: LENGTH_MISMATCH"
        );

        for (uint256 i = 0; i < _managers.length; i++) {
            address manager = _managers[i];
            uint256 itemId = _itemIds[i];
            bool value = _values[i];
            require(manager != address(0), "BCV2#setItemsManagers: INVALID_MANAGER_ADDRESS");
            require(itemId < items.length, "BCV2#setItemsManagers: ITEM_DOES_NOT_EXIST");
            require(itemManagers[itemId][manager] != value, "BCV2#setItemsManagers: VALUE_IS_THE_SAME");

            itemManagers[itemId][manager] = value;
            emit SetItemManager(itemId, manager, value);
        }
    }

    /**
     * @notice Transfers ownership of the contract to a new account (`newOwner`).
     * @dev Forced owner to check against msg.sender always
     */
    function transferCreatorship(address _newCreator) public virtual {
        address sender = _msgSender();
        require(sender == owner() || sender == creator, "BCV2#transferCreatorship: CALLER_IS_NOT_OWNER_OR_CREATOR");
        require(_newCreator != address(0), "BCV2#transferCreatorship: INVALID_CREATOR_ADDRESS");

        emit CreatorshipTransferred(creator, _newCreator);
        creator = _newCreator;
    }

    /*
    * Items functions
    */

    /**
     * @notice Add items to the collection.
     * @param _items - items to add
     */
    function addItems(Item[] memory _items) external virtual onlyCreator {
        require(!isCompleted, "BCV2#_addItem: COLLECTION_COMPLETED");

        for (uint256 i = 0; i < _items.length; i++) {
            _addItem(_items[i]);
        }
    }

    /**
     * @notice Edit the price and beneficiary of multiple items
     * @param _itemIds - items ids to edit
     * @param _prices - new prices
     * @param _beneficiaries - new beneficiaries
     */
    function editItemsSalesData(
        uint256[] calldata _itemIds,
        uint256[] calldata _prices,
        address[] calldata _beneficiaries
    ) external virtual {
        // Check lengths
        require(
            _itemIds.length == _prices.length && _prices.length == _beneficiaries.length,
            "BCV2#editItemsSalesData: LENGTH_MISMATCH"
        );

        // Check item id
        for (uint256 i = 0; i < _itemIds.length; i++) {
            uint256 itemId = _itemIds[i];
            uint256 price = _prices[i];
            address beneficiary = _beneficiaries[i];

            require(_isCreator() || _isManager(itemId), "BCV2#editItemsSalesData: CALLER_IS_NOT_CREATOR_OR_MANAGER");
            require(itemId < items.length, "BCV2#editItemsSalesData: ITEM_DOES_NOT_EXIST");
            require(
                price > 0 && beneficiary != address(0) || price == 0 && beneficiary == address(0),
                "BCV2#editItemsSalesData: INVALID_PRICE_AND_BENEFICIARY"
            );

            Item storage item = items[itemId];
            item.price = price;
            item.beneficiary = beneficiary;

            emit UpdateItemSalesData(itemId, price, beneficiary);
        }
    }

    /**
     * @notice Edit the metadata of multiple items
     * @param _itemIds - items ids to edit
     * @param _metadatas - new metadatas
     */
    function editItemsMetadata(
        uint256[] calldata _itemIds,
        string[] calldata _metadatas
    ) external virtual {
        require(isEditable, "BCV2#editItemsMetadata: NOT_EDITABLE");
        require(
            _itemIds.length == _metadatas.length,
            "BCV2#editItemsMetadata: LENGTH_MISMATCH"
        );

        // Check item id
        for (uint256 i = 0; i < _itemIds.length; i++) {
            uint256 itemId = _itemIds[i];
            string memory metadata = _metadatas[i];

            require(_isCreator() || _isManager(itemId), "BCV2#editItemsMetadata: CALLER_IS_NOT_CREATOR_OR_MANAGER");
            require(itemId < items.length, "BCV2#editItemsMetadata: ITEM_DOES_NOT_EXIST");
            require(bytes(metadata).length > 0, "BCV2#editItemsMetadata: EMPTY_METADATA");

            Item storage item = items[itemId];
            item.metadata = metadata;

            emit UpdateItemMetadata(itemId, metadata);
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
            "BCV2#_addItem: INVALID_RARITY"
        );
        require(
            _item.totalSupply == 0,
            "BCV2#_addItem: INVALID_TOTAL_SUPPLY"
        );
        require(bytes(_item.metadata).length > 0, "BCV2#_addItem: EMPTY_METADATA");
        require(
            _item.price > 0 && _item.beneficiary != address(0) || _item.price == 0 && _item.beneficiary == address(0),
            "BCV2#_addItem: INVALID_PRICE_AND_BENEFICIARY"
        );
        require(_item.contentHash == EMPTY_CONTENT, "BCV2#_addItem: CONTENT_HASH_SHOULD_BE_EMPTY");

        uint256 newItemId = items.length;
        require(newItemId < MAX_ITEM_ID, "BCV2#_addItem: MAX_ITEM_ID_REACHED");

        items.push(_item);

        emit AddItem(newItemId, _item);
    }


    /**
     * @notice Issue a new token of the specified item.
     * @dev that will throw if the item has reached its maximum or is invalid
     * @param _beneficiary - owner of the token
     * @param _itemId - item id
     */
    function issueToken(address _beneficiary,  uint256 _itemId) external virtual {
        require(isMintingAllowed(), "BCV2#issueToken: MINT_NOT_ALLOWED");

        address sender = _msgSender();
        _issueToken(_beneficiary, _itemId, sender);
    }

    /**
     * @notice Issue tokens by item ids.
     * @dev Will throw if the items have reached its maximum or is invalid
     * @param _beneficiaries - owner of the tokens
     * @param _itemIds - item ids
     */
    function issueTokens(address[] calldata _beneficiaries, uint256[] calldata _itemIds) external virtual {
        require(isMintingAllowed(), "BCV2#issueTokens: MINT_NOT_ALLOWED");
        require(_beneficiaries.length == _itemIds.length, "BCV2#issueTokens: LENGTH_MISMATCH");

        address sender = _msgSender();
        for (uint256 i = 0; i < _itemIds.length; i++) {
            _issueToken(_beneficiaries[i], _itemIds[i], sender);
        }
    }

    /**
     * @notice Issue a new token of the specified item.
     * @dev Will throw if the item has reached its maximum or is invalid
     * @param _beneficiary - owner of the token
     * @param _itemId - item id
     * @param _sender - transaction sender
     */
    function _issueToken(address _beneficiary, uint256 _itemId, address _sender) internal virtual {
        uint256 allowance = itemMinters[_itemId][_sender];
        bool canMint = _isCreator() || globalMinters[_sender] || allowance > 0;

        // Check sender role
        require(
            canMint,
            "BCV2#_issueToken: CALLER_CAN_NOT_MINT"
        );

        if (allowance > 0 && allowance != uint256(-1)) {
            itemMinters[_itemId][_sender] = allowance - 1;
        }

        // Check item id
        require(_itemId < items.length, "BCV2#_issueToken: ITEM_DOES_NOT_EXIST");

        Item storage item = items[_itemId];
        uint256 currentIssuance = item.totalSupply.add(1);

        // Check issuance
        require(currentIssuance <= getRarityValue(item.rarity), "BCV2#_issueToken: ITEM_EXHAUSTED");

        // Encode token id
        uint256 tokenId = encodeTokenId(_itemId, currentIssuance);

        // Increase issuance
        item.totalSupply = currentIssuance;

        // Mint token to beneficiary
        super._mint(_beneficiary, tokenId);

        // Log
        emit Issue(_beneficiary, tokenId, _itemId, currentIssuance);
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
            "BCV2#rescueItems: LENGTH_MISMATCH"
        );

        for (uint256 i = 0; i < _itemIds.length; i++) {
            uint256 itemId = _itemIds[i];
            require(itemId < items.length, "BCV2#rescueItems: ITEM_DOES_NOT_EXIST");

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
     * @notice Returns the amount of item in the collection
     * @return Amount of items in the collection
     */
    function itemsCount() external view returns (uint256) {
        return items.length;
    }

    /**
     * @notice Returns a rarity's maximum supply
     * @dev will revert if the rarity is out of the RARITY enum bounds
     * @return Max supply of the rarity given
     */
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

        revert("#BCV2#getRarityValue: INVALID_RARITY");
    }

    /**
     * @notice Returns a rarity's name
     * @dev will revert if the rarity is out of the RARITY enum bounds
     * @return Name of the rarity given
     */
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

        revert("#BCV2#getRarityName: INVALID_RARITY");
    }

    /*
    * Status functions
    */

    /**
     * @notice Get whether minting is allowed
     * @return boolean whether minting is allowed or not
     */
    function isMintingAllowed() public view returns (bool) {
        require(createdAt <= now - GRACE_PERIOD, "BCV2#isMintingAllowed: IN_GRACE_PERIOD");
        require(isCompleted, "BCV2#isMintingAllowed: NOT_COMPLETED");
        require(isApproved, "BCV2#isMintingAllowed: NOT_APPROVED");

        return true;
    }

    /**
     * @notice Complete the collection.
     * @dev Disable forever the possibility of adding new items in the collection.
     * The issuance is still allowed.
     */
    function completeCollection() external onlyCreator {
        require(!isCompleted, "BCV2#completeCollection: COLLECTION_ALREADY_COMPLETED");

        _completeCollection();
    }

    /**
     * @notice Complete the collection.
     * @dev Internal. Disable forever the possibility of adding new items in the collection.
     * The issuance is still allowed.
     */
    function _completeCollection() internal {
        isCompleted = true;
        emit Complete();
    }

    /**
     * @notice Approve a collection
     */
    function setApproved(bool _value) external virtual onlyOwner {
        require(isApproved != _value, "BCV2#setApproved: VALUE_IS_THE_SAME");

        emit SetApproved(isApproved, _value);

        isApproved = _value;
    }

    /**
     * @notice Set whether the collection can be editable or not.
     * @dev This property is used off-chain to check whether the items of the collection
     * can be updated or not
     * @param _value - Value to set
     */
    function setEditable(bool _value) external onlyOwner {
        require(isEditable != _value, "BCV2#setEditable: VALUE_IS_THE_SAME");

        emit SetEditable(isEditable, _value);

        isEditable = _value;
    }

    /*
    * URI functions
    */

    /**
     * @notice Set Base URI
     * @param _baseURI - base URI for token URIs
     */
    function setBaseURI(string memory _baseURI) public onlyOwner {
        emit BaseURI(baseURI(), _baseURI);
        _setBaseURI(_baseURI);
    }

    /**
     * @notice Returns an URI for a given token ID.
     * Throws if the token ID does not exist. May return an empty string.
     * @param _tokenId - uint256 ID of the token queried
     * @return token URI
     */
    function tokenURI(uint256 _tokenId) public view virtual override returns (string memory) {
        require(_exists(_tokenId), "BCV2#tokenURI: INVALID_TOKEN_ID");

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

    /*
    * Batch Transfer functions
    */

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

    /*
    * Token Utils functions
    */

    /**
     * @notice Encode token id
     * @dev itemId (`itemIdBits` bits) + issuedId (`issuedIdBits` bits)
     * @param _itemId - item id
     * @param _issuedId - issued id
     * @return id uint256 of the encoded id
     */
    function encodeTokenId(uint256 _itemId, uint256 _issuedId) public pure returns (uint256 id) {
        require(_itemId <= MAX_ITEM_ID, "BCV2#encodeTokenId: INVALID_ITEM_ID");
        require(_issuedId <= MAX_ISSUED_ID, "BCV2#encodeTokenId: INVALID_ISSUED_ID");

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
}
