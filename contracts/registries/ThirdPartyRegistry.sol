// SPDX-License-Identifier: MIT

pragma solidity  ^0.7.3;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "../commons/OwnableInitializable.sol";
import "../commons/NativeMetaTransaction.sol";
import "../interfaces/ICommittee.sol";
import "../interfaces/IERC20.sol";
import "../interfaces/IOracle.sol";
import "../libs/String.sol";

contract ThirdPartyRegistry is OwnableInitializable, NativeMetaTransaction {
    using SafeMath for uint256;

    struct ThirdPartyParam {
        string id;
        string metadata;
        string resolver;
        address[] managers;
        bool[] managerValues;
    }

    struct ItemParam {
        string id;
        string metadata;
    }

    struct ItemReviewParam {
        string id;
        string metadata;
        string contentHash;
        bool value;
    }

    struct ThirdPartyReviewParam {
        string id;
        bool value;
        ItemReviewParam[] items;
    }

    struct Item {
        string metadata;
        string contentHash;
        bool isApproved;
        uint256 registered;
    }

    struct ThirdParty {
        string metadata;
        string resolver;
        uint256 maxItems;
        bool isApproved;
        mapping(address => bool) managers;
        mapping(string => Item) items;
        string[] itemIds;
        uint256 registered;
    }

    mapping(string => ThirdParty) public thirdParties;
    string[] public thirdPartyIds;

    address public thirdPartyAgregator;
    address public feesCollector;
    ICommittee public committee;
    IERC20  public acceptedToken;
    uint256 public itemSlotPrice;
    IOracle public oracle;

    bool public initialThirdPartyValue;
    bool public initialItemValue;

    event ThirdPartyAdded(string _thirdPartyId, string _metadata, string _resolver, bool _isApproved, address[] _managers, address _caller);
    event ThirdPartyUpdated(string _thirdPartyId, string _metadata, string _resolver, address[] _managers, bool[] _managerValues, address _caller);
    event ThirdPartyItemSlotsBought(string _thirdPartyId, uint256 _price, uint256 _value, address _caller);
    event ThirdPartyItemSlotsAdded(string _thirdPartyId, uint256 _value, address _caller);
    event ThirdPartyReviewed(string _thirdPartyId, bool _value, address _caller);

    event ItemAdded(string _thirdPartyId, string _itemId, string _metadata, bool _value, address _caller);
    event ItemUpdated(string _thirdPartyId, string _itemId, string _metadata, address _caller);
    event ItemReviewed(string _thirdPartyId, string _itemId, string _metadata, string _contentHash, bool _value, address _caller);

    event ThirdPartyAgregatorSet(address indexed _oldThirdPartyAgregator, address indexed _newThirdPartyAgregator);
    event FeesCollectorSet(address indexed _oldFeesCollector, address indexed _newFeesCollector);
    event CommitteeSet(ICommittee indexed _oldCommittee, ICommittee indexed _newCommittee);
    event AcceptedTokenSet(IERC20 indexed _oldAcceptedToken, IERC20 indexed _newAcceptedToken);
    event OracleSet(IOracle indexed _oldOracle, IOracle indexed _newOracle);
    event ItemSlotPriceSet(uint256 _oldItemSlotPrice, uint256 _newItemSlotPrice);
    event InitialThirdPartyValueSet(bool _oldInitialThirdPartyValue, bool _newInitialThirdPartyValue);
    event InitialItemValueSet(bool _oldInitialItemValue, bool _newInitialItemValue);

   /**
    * @notice Create the contract
    * @param _owner - owner of the contract
    * @param _thirdPartyAgregator - third party agregator
    * @param _feesCollector - fees collector
    * @param _committee - committee smart contract
    * @param _acceptedToken - accepted token
    * @param _oracle - oracle smart contract
    * @param _itemSlotPrice - item price
    */
    constructor(
        address _owner,
        address _thirdPartyAgregator,
        address _feesCollector,
        ICommittee _committee,
        IERC20 _acceptedToken,
        IOracle _oracle,
        uint256 _itemSlotPrice
    ) {
        _initializeEIP712("Decentraland Third Party Registry", "1");
        _initOwnable();

        setThirdPartyAgregator(_thirdPartyAgregator);
        setFeesCollector(_feesCollector);
        setCommittee(_committee);
        setAcceptedToken(_acceptedToken);
        setOracle(_oracle);
        setInitialItemValue(false);
        setInitialThirdPartyValue(true);
        setItemSlotPrice(_itemSlotPrice);

        transferOwnership(_owner);
    }

    modifier onlyCommittee() {
        require(
            committee.members(_msgSender()),
            "TPR#onlyCommittee: CALLER_IS_NOT_A_COMMITTEE_MEMBER"
        );
        _;
    }

    modifier onlyThirdPartyAgregator() {
        require(
            thirdPartyAgregator == _msgSender(),
            "TPR#onlyThirdPartyAgregator: CALLER_IS_NOT_THE_PARTY_AGREGATOR"
        );
        _;
    }

    /**
    * @notice Set the third party agregator
    * @param _newThirdPartyAgregator - third party agregator
    */
    function setThirdPartyAgregator(address _newThirdPartyAgregator) onlyOwner public {
        require(_newThirdPartyAgregator != address(0), "TPR#setThirdPartyAgregator: INVALID_THIRD_PARTY_AGREGATOR");

        emit ThirdPartyAgregatorSet(thirdPartyAgregator, _newThirdPartyAgregator);
        thirdPartyAgregator = _newThirdPartyAgregator;
    }


     /**
    * @notice Set the fees collector
    * @param _newFeesCollector - fees collector
    */
    function setFeesCollector(address _newFeesCollector) onlyOwner public {
        require(_newFeesCollector != address(0), "TPR#setFeesCollector: INVALID_FEES_COLLECTOR");

        emit FeesCollectorSet(feesCollector, _newFeesCollector);
        feesCollector = _newFeesCollector;
    }

    /**
    * @notice Set the committee
    * @param _newCommittee - committee contract
    */
    function setCommittee(ICommittee _newCommittee) onlyOwner public {
        require(address(_newCommittee) != address(0), "TPR#setCommittee: INVALID_COMMITTEE");

        emit CommitteeSet(committee, _newCommittee);
        committee = _newCommittee;
    }

    /**
    * @notice Set the accepted token
    * @param _newAcceptedToken - accepted ERC20 token for collection deployment
    */
    function setAcceptedToken(IERC20 _newAcceptedToken) onlyOwner public {
        require(address(_newAcceptedToken) != address(0), "TPR#setAcceptedToken: INVALID_ACCEPTED_TOKEN");

        emit AcceptedTokenSet(acceptedToken, _newAcceptedToken);
        acceptedToken = _newAcceptedToken;
    }

     /**
    * @notice Set the oracle
    * @param _newOracle - oracle contract
    */
    function setOracle(IOracle _newOracle) onlyOwner public {
        require(address(_newOracle) != address(0), "TPR#setOracle: INVALID_ORACLE");

        emit OracleSet(oracle, _newOracle);
        oracle = _newOracle;
    }

     /**
    * @notice Set the item slot price
    * @param _newItemSlotPrice - item slot price
    */
    function setItemSlotPrice(uint256 _newItemSlotPrice) onlyOwner public {
        emit ItemSlotPriceSet(itemSlotPrice, _newItemSlotPrice);
        
        itemSlotPrice = _newItemSlotPrice;
    }

    /**
    * @notice Set whether third parties should be init approved or not
    * @param _newinitialThirdPartyValue - initial value
    */
    function setInitialThirdPartyValue(bool _newinitialThirdPartyValue) onlyOwner public {
        emit InitialThirdPartyValueSet(initialThirdPartyValue, _newinitialThirdPartyValue);
        initialThirdPartyValue = _newinitialThirdPartyValue;
    }

    /**
    * @notice Set whether items should be init approved or not
    * @param _newinitialItemValue - initial value
    */
    function setInitialItemValue(bool _newinitialItemValue) onlyOwner public {
        emit InitialItemValueSet(initialItemValue, _newinitialItemValue);
        initialItemValue = _newinitialItemValue;
    }

    /**
    * @notice Add third parties
    * @param _thirdParties - third parties to be added
    */
    function addThirdParties(ThirdPartyParam[] calldata _thirdParties) onlyThirdPartyAgregator external {
        for (uint256 i = 0; i < _thirdParties.length; i++) {
            ThirdPartyParam memory thirdPartyParam = _thirdParties[i];

            require(bytes(thirdPartyParam.id).length > 0, "TPR#addThirdParties: EMPTY_ID");
            require(bytes(thirdPartyParam.metadata).length > 0, "TPR#addThirdParties: EMPTY_METADATA");
            require(bytes(thirdPartyParam.resolver).length > 0, "TPR#addThirdParties: EMPTY_RESOLVER");
            require(thirdPartyParam.managers.length > 0, "TPR#addThirdParties: EMPTY_MANAGERS");

            ThirdParty storage thirdParty = thirdParties[thirdPartyParam.id];
            require(thirdParty.registered == 0, "TPR#addThirdParties: THIRD_PARTY_ALREADY_ADDED");

            thirdParty.registered = 1;
            thirdParty.metadata = thirdPartyParam.metadata;
            thirdParty.resolver = thirdPartyParam.resolver;
            thirdParty.isApproved = initialThirdPartyValue;

            for (uint256 m = 0; m < thirdPartyParam.managers.length; m++) {
                thirdParty.managers[thirdPartyParam.managers[m]] = true;
            }

            thirdPartyIds.push(thirdPartyParam.id);

            emit ThirdPartyAdded(
                thirdPartyParam.id,
                thirdParty.metadata,
                thirdParty.resolver,
                thirdParty.isApproved,
                thirdPartyParam.managers,
                _msgSender()
            );
        }
    }

    /**
    * @notice Update third parties
    * @param _thirdParties - third parties to be updated
    */
    function updateThirdParties(ThirdPartyParam[] calldata _thirdParties) external {
        address sender = _msgSender();

        for (uint256 i = 0; i < _thirdParties.length; i++) {
            ThirdPartyParam memory thirdPartyParam = _thirdParties[i];

            require(bytes(thirdPartyParam.id).length > 0, "TPR#updateThirdParties: EMPTY_ID");

            ThirdParty storage thirdParty = thirdParties[thirdPartyParam.id];
            require(
                thirdParty.managers[sender] || thirdPartyAgregator == sender,
                "TPR#updateThirdParties: CALLER_IS_NOT_MANAGER_OR_THIRD_PARTY_AGREGATOR"
            );

            _checkThirdParty(thirdParty);

            if (bytes(thirdPartyParam.metadata).length > 0) {
                thirdParty.metadata = thirdPartyParam.metadata;
            }

            if (bytes(thirdPartyParam.resolver).length > 0) {
                thirdParty.resolver = thirdPartyParam.resolver;
            }

            require(
                thirdPartyParam.managers.length == thirdPartyParam.managerValues.length,
                "TPR#updateThirdParties: LENGTH_MISMATCH"
            );

            for (uint256 m = 0; m < thirdPartyParam.managers.length; m++) {
                address manager = thirdPartyParam.managers[m];
                bool value = thirdPartyParam.managerValues[m];
                if (!value) {
                    require(sender != manager, "TPR#updateThirdParties: MANAGER_CANT_SELF_REMOVE");
                }

                thirdParty.managers[manager] = value;
            }

            emit ThirdPartyUpdated(
                thirdPartyParam.id,
                thirdParty.metadata,
                thirdParty.resolver,
                thirdPartyParam.managers,
                thirdPartyParam.managerValues,
                sender
            );
        }
    }

    /**
    * @notice Buy item slots
    * @dev It is recomended to send the _maxPrice a little bit higher than expected in order to 
    * prevent minimum rate slippage
    * @param _thirdPartyId - third party id
    * @param _qty - qty of item slots to be bought
    * @param _maxPrice - max price to paid
    */
    function buyItemSlots(string calldata _thirdPartyId, uint256 _qty, uint256 _maxPrice) external {
        address sender = _msgSender();

        ThirdParty storage thirdParty = thirdParties[_thirdPartyId];

        _checkThirdParty(thirdParty);

        uint256 rate = _getRateFromOracle();

        uint256 finalPrice = itemSlotPrice.mul(1 ether).mul(_qty).div(rate);

        require(finalPrice <= _maxPrice, "TPR#buyItems: PRICE_HIGHER_THAN_MAX_PRICE");

        thirdParty.maxItems = thirdParty.maxItems.add(_qty);

        if (finalPrice > 0) {
            require(
                acceptedToken.transferFrom(sender, feesCollector, finalPrice),
                "TPR#buyItemSlots: TRANSFER_FROM_FAILED"
            );
        }

        emit ThirdPartyItemSlotsBought(_thirdPartyId, finalPrice, _qty, sender);
    }

    /**
    * @notice Add item slots
    * @param _thirdPartyId - third party id
    * @param _qty - qty of items to be added
    */
    function addItemSlots(string calldata _thirdPartyId, uint256 _qty)  external onlyThirdPartyAgregator {
        address sender = _msgSender();

        ThirdParty storage thirdParty = thirdParties[_thirdPartyId];

        _checkThirdParty(thirdParty);

        thirdParty.maxItems = thirdParty.maxItems.add(_qty);

        emit ThirdPartyItemSlotsAdded(_thirdPartyId, _qty, sender);
    }

     /**
    * @notice Add items to a third party
    * @param _thirdPartyId - third party id
    * @param _items - items to be added
    */
    function addItems(string calldata _thirdPartyId, ItemParam[] calldata _items) external {
        address sender = _msgSender();
        bool initValue = initialItemValue;

        ThirdParty storage thirdParty = thirdParties[_thirdPartyId];
        require(thirdParty.managers[sender], "TPR#addItems: INVALID_SENDER");
        require(thirdParty.maxItems >= thirdParty.itemIds.length.add(_items.length), "TPR#addItems: NO_ITEM_SLOTS_AVAILABLE");

        for (uint256 i = 0; i < _items.length; i++) {
            ItemParam memory itemParam = _items[i];
            _checkItemParam(itemParam);

            Item storage item = thirdParty.items[itemParam.id];
            require(item.registered == 0, "TPR#addItems: ITEM_ALREADY_ADDED");

            item.metadata = itemParam.metadata;
            item.isApproved = initValue;
            item.registered = 1;

            thirdParty.itemIds.push(itemParam.id);

            emit ItemAdded(
                _thirdPartyId,
                itemParam.id,
                itemParam.metadata,
                initValue,
                sender
            );
        }
    }

    /**
    * @notice Update items metadata
    * @param _thirdPartyId - third party id
    * @param _items - items to be updated
    */
    function updateItems(string calldata _thirdPartyId, ItemParam[] calldata _items) external {
        address sender = _msgSender();

        ThirdParty storage thirdParty = thirdParties[_thirdPartyId];
        require(thirdParty.managers[sender], "TPR#updateItems: INVALID_SENDER");

        for (uint256 i = 0; i < _items.length; i++) {
            ItemParam memory itemParam = _items[i];
            _checkItemParam(itemParam);

            Item storage item = thirdParty.items[itemParam.id];
            _checkItem(item);

            require(!item.isApproved, "TPR#updateItems: ITEM_IS_APPROVED");

            item.metadata = itemParam.metadata;

            emit ItemUpdated(
                _thirdPartyId,
                itemParam.id,
                itemParam.metadata,
                sender
            );
        }
    }

     /**
    * @notice Review third party items
    * @param _thirdParties - Third parties with items to be reviewed
    */
    function reviewThirdParties(ThirdPartyReviewParam[] calldata _thirdParties) onlyCommittee external {
        address sender = _msgSender();

        for (uint256 i = 0; i < _thirdParties.length; i++) {
            ThirdPartyReviewParam memory thirdPartyReview = _thirdParties[i];

            ThirdParty storage thirdParty = thirdParties[thirdPartyReview.id];
            _checkThirdParty(thirdParty);

            thirdParty.isApproved = thirdPartyReview.value;
            emit ThirdPartyReviewed(thirdPartyReview.id, thirdParty.isApproved, sender);

            for (uint256 j = 0; j < thirdPartyReview.items.length; j++) {
                ItemReviewParam memory itemReview = thirdPartyReview.items[j];
                require(bytes(itemReview.contentHash).length > 0, "TPR#reviewThirdParties: INVALID_CONTENT_HASH");

                Item storage item = thirdParty.items[itemReview.id];
                _checkItem(item);

                item.contentHash = itemReview.contentHash;
                item.isApproved = itemReview.value;

                if (bytes(itemReview.metadata).length > 0) {
                    item.metadata = itemReview.metadata;
                }

                emit ItemReviewed(
                    thirdPartyReview.id,
                    itemReview.id,
                    item.metadata,
                    item.contentHash,
                    item.isApproved,
                    sender
                );
            }
        }
    }

    /**
    * @notice Returns the count of third parties
    * @return Count of third parties
    */
    function thirdPartiesCount() external view returns (uint256) {
        return thirdPartyIds.length;
    }

     /**
    * @notice Returns if an address is a third party's manager
    * @return bool whether an address is a third party's manager or not
    */
    function isThirdPartyManager(string memory _thirdPartyId, address _manager) external view returns (bool) {
        return thirdParties[_thirdPartyId].managers[_manager];
    }

     /**
    * @notice Returns the count of items from a third party
    * @return Count of third party's items
    */
    function itemsCount(string memory _thirdPartyId) external view returns (uint256) {
        return thirdParties[_thirdPartyId].itemIds.length;
    }

    /**
    * @notice Returns an item id by index
    * @return id of the item
    */
    function itemIdByIndex(string memory _thirdPartyId, uint256 _index) external view returns (string memory) {
        return thirdParties[_thirdPartyId].itemIds[_index];
    }

     /**
    * @notice Returns an item
    * @return Item
    */
    function itemsById(string memory _thirdPartyId, string memory _itemId) external view returns (Item memory) {
        return thirdParties[_thirdPartyId].items[_itemId];
    }

    /**
    * @dev Safely call Oracle.getRate
    * @return Rate
    */
    function _getRateFromOracle() internal view returns(uint256) {
        /* solium-disable-next-line */
        (bool success, bytes memory data) = address(oracle).staticcall(
            abi.encodeWithSelector(oracle.getRate.selector)
        );

        require(success, "TPR#_getRateFromOracle: INVALID_RATE_FROM_ORACLE");

        return abi.decode(data, (uint256));
    }

    /**
    * @dev Check whether a third party has been registered
    * @param _thirdParty - Third party
    */
    function _checkThirdParty(ThirdParty storage _thirdParty) internal view {
        require(_thirdParty.registered > 0, "TPR#_checkThirdParty: INVALID_THIRD_PARTY");
    }

    /**
    * @dev Check whether an item has been registered
    * @param _item - Item
    */
    function _checkItem(Item memory _item) internal pure {
        require(_item.registered > 0, "TPR#_checkItem: INVALID_ITEM");
    }

    /**
    * @dev Check whether an item param is well formed
    * @param _item - Item param
    */
    function _checkItemParam(ItemParam memory _item) internal pure {
        require(bytes(_item.id).length > 0, "TPR#_checkItemParam: EMPTY_ID");
        require(bytes(_item.metadata).length > 0, "TPR#_checkItemParam: EMPTY_METADATA");
    }
}