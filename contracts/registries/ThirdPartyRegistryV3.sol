// SPDX-License-Identifier: MIT

pragma solidity  0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";

import "../commons/OwnableInitializable.sol";
import "../commons/NativeMetaTransaction.sol";
import "../interfaces/ICommittee.sol";
import "../interfaces/IERC20.sol";
import "../interfaces/IOracle.sol";
import "../libs/String.sol";

contract ThirdPartyRegistryV2 is OwnableInitializable, NativeMetaTransaction, Initializable {
    using SafeMath for uint256;

    bytes32 private constant CONSUME_SLOTS_TYPEHASH = keccak256(
        bytes("ConsumeSlots(string thirdPartyId,uint256 qty,bytes32 salt)")
    );

    struct ConsumeSlots {
        string thirdPartyId;
        uint256 qty;
        bytes32 salt;
    }

    struct ConsumeSlotsParam {
        uint256 qty;
        bytes32 salt;
        bytes32 sigR;
        bytes32 sigS;
        uint8 sigV;
    }

    struct ThirdPartyParam {
        string id;
        string metadata;
        string resolver;
        address[] managers;
        bool[] managerValues;
        uint256 slots;
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
        bool isApproved;
        bytes32 root;
        uint256 maxItems;
        uint256 consumedSlots;
        uint256 registered;
        string metadata;
        string resolver;
        string[] itemIds;
        mapping(bytes32 => uint256) receipts;
        mapping(address => bool) managers;
        mapping(string => Item) items;
        mapping(string => bool) rules;
    }

    mapping(string => ThirdParty) public thirdParties;
    string[] public thirdPartyIds;

    address public thirdPartyAggregator;
    address public feesCollector;
    ICommittee public committee;
    IERC20  public acceptedToken;
    uint256 public itemSlotPrice;
    IOracle public oracle;

    bool public initialThirdPartyValue;
    bool public initialItemValue;

    event ThirdPartyAdded(string _thirdPartyId, string _metadata, string _resolver, bool _isApproved, address[] _managers, uint256 _itemSlots, address _sender);
    event ThirdPartyUpdated(string _thirdPartyId, string _metadata, string _resolver, address[] _managers, bool[] _managerValues, uint256 _itemSlots, address _sender);
    event ThirdPartyItemSlotsBought(string _thirdPartyId, uint256 _price, uint256 _value, address _sender);
    event ThirdPartyReviewed(string _thirdPartyId, bool _value, address _sender);
    event ThirdPartyReviewedWithRoot(string _thirdPartyId, bytes32 _root, bool _isApproved, address _sender);
    event ThirdPartyRuleAdded(string _thirdPartyId, string _rule, bool _value, address _sender);

    event ItemReviewed(string _thirdPartyId, string _itemId, string _metadata, string _contentHash, bool _value, address _sender);
    event ItemSlotsConsumed(string _thirdPartyId, uint256 _qty, address indexed _signer, bytes32 _messageHash, address indexed _sender);

    event ThirdPartyAggregatorSet(address indexed _oldThirdPartyAggregator, address indexed _newThirdPartyAggregator);
    event FeesCollectorSet(address indexed _oldFeesCollector, address indexed _newFeesCollector);
    event CommitteeSet(ICommittee indexed _oldCommittee, ICommittee indexed _newCommittee);
    event AcceptedTokenSet(IERC20 indexed _oldAcceptedToken, IERC20 indexed _newAcceptedToken);
    event OracleSet(IOracle indexed _oldOracle, IOracle indexed _newOracle);
    event ItemSlotPriceSet(uint256 _oldItemSlotPrice, uint256 _newItemSlotPrice);
    event InitialThirdPartyValueSet(bool _oldInitialThirdPartyValue, bool _newInitialThirdPartyValue);
    event InitialItemValueSet(bool _oldInitialItemValue, bool _newInitialItemValue);

   /**
    * @notice Initialize the contract
    * @param _owner - owner of the contract
    * @param _thirdPartyAggregator - third party aggregator
    * @param _feesCollector - fees collector
    * @param _committee - committee smart contract
    * @param _acceptedToken - accepted token
    * @param _oracle - oracle smart contract
    * @param _itemSlotPrice - item price in USD dollar. 18 decimals
    */
    function initialize(
        address _owner,
        address _thirdPartyAggregator,
        address _feesCollector,
        ICommittee _committee,
        IERC20 _acceptedToken,
        IOracle _oracle,
        uint256 _itemSlotPrice
    ) public initializer {
        _initializeEIP712("Decentraland Third Party Registry", "1");
        _initOwnable();

        setThirdPartyAggregator(_thirdPartyAggregator);
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
            "TPR#onlyCommittee: SENDER_IS_NOT_A_COMMITTEE_MEMBER"
        );
        _;
    }

    modifier onlyThirdPartyAggregator() {
        require(
            thirdPartyAggregator == _msgSender(),
            "TPR#onlyThirdPartyAggregator: SENDER_IS_NOT_THE_PARTY_AGGREGATOR"
        );
        _;
    }

    /**
    * @notice Set the third party aggregator
    * @param _newThirdPartyAggregator - third party aggregator
    */
    function setThirdPartyAggregator(address _newThirdPartyAggregator) onlyOwner public {
        require(_newThirdPartyAggregator != address(0), "TPR#setThirdPartyAggregator: INVALID_THIRD_PARTY_AGGREGATOR");

        emit ThirdPartyAggregatorSet(thirdPartyAggregator, _newThirdPartyAggregator);
        thirdPartyAggregator = _newThirdPartyAggregator;
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
    function addThirdParties(ThirdPartyParam[] calldata _thirdParties) onlyThirdPartyAggregator external {
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
            thirdParty.maxItems = thirdPartyParam.slots;

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
                thirdParty.maxItems,
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
                thirdParty.managers[sender] || thirdPartyAggregator == sender,
                "TPR#updateThirdParties: SENDER_IS_NOT_MANAGER_OR_THIRD_PARTY_AGGREGATOR"
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

            uint256 slots = thirdPartyParam.slots;

            if (slots > 0) {
                require(thirdPartyAggregator == sender, "TPR#updateThirdParties: SENDER_IS_NOT_THIRD_PARTY_AGGREGATOR");

                thirdParty.maxItems = thirdParty.maxItems.add(slots);
            }

            emit ThirdPartyUpdated(
                thirdPartyParam.id,
                thirdParty.metadata,
                thirdParty.resolver,
                thirdPartyParam.managers,
                thirdPartyParam.managerValues,
                thirdPartyParam.slots,
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
     * @notice Review third parties with Merkle Root
     * @dev The amount of slots should be the same as the amount of items in the merkle tree 
     * @param _thirdPartyId - third party id
     * @param _root - Merkle tree root
     * @param _consumeSlotsParams - Data to consume slots mutilple times in a single transaction
     */
    function reviewThirdPartyWithRoot(
        string calldata _thirdPartyId,
        bytes32 _root,
        ConsumeSlotsParam[] calldata _consumeSlotsParams
    ) onlyCommittee external {
        address sender = _msgSender();

        require(_root != bytes32(0), "TPR#reviewThirdPartyWithRoot: INVALID_ROOT");

        ThirdParty storage thirdParty = thirdParties[_thirdPartyId];

        _checkThirdParty(thirdParty);

        _consumeSlots(_thirdPartyId, _consumeSlotsParams);

        thirdParty.isApproved = true;
        thirdParty.root = _root;

        emit ThirdPartyReviewedWithRoot(_thirdPartyId, _root, thirdParty.isApproved, sender);
    }

    /**
     * @notice Consume third party slots
     * @param _consumeSlotsParams - Data to consume slots mutilple times in a single transaction
     */
    function consumeSlots(string calldata _thirdPartyId, ConsumeSlotsParam[] calldata _consumeSlotsParams) onlyCommittee external {
        ThirdParty storage thirdParty = thirdParties[_thirdPartyId];

        _checkThirdParty(thirdParty);

        _consumeSlots(_thirdPartyId, _consumeSlotsParams);
    }

    /**
     * @notice Set rules
     * @param _thirdPartyId - Third party id
     * @param _rules - Rules to be updated
     * @param _values - Values for the rules to be updated
     */
    function setRules(string memory _thirdPartyId, string[] memory _rules, bool[] memory _values) onlyCommittee external {
        address sender = _msgSender();

        require(_rules.length == _values.length, "TPR#setRules: LENGTH_MISMATCH");

        ThirdParty storage thirdParty = thirdParties[_thirdPartyId];

        _checkThirdParty(thirdParty);

        for (uint256 i = 0; i < _rules.length; i++) {
            string memory rule = _rules[i];
            bool value = _values[i];

            require(bytes(rule).length > 0, "TPR#setRules: INVALID_RULE");

            thirdParty.rules[rule] = value;

            emit ThirdPartyRuleAdded(_thirdPartyId, rule, value, sender);
        }
    }

    /**
     * @notice Get the value of a given rule in a third party
     * @param _thirdPartyId - Id of the third party
     * @param _rule - Rule for which the value is to be obtained
     * @return Boolean representing the value of the rule
     */
    function getRuleValue(string calldata _thirdPartyId, string calldata _rule) external view returns (bool){
        return thirdParties[_thirdPartyId].rules[_rule];
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
        return thirdParties[_thirdPartyId].consumedSlots;
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
     * @notice Consume third party slots
     * @param _consumeSlotsParams - Data to consume slots mutilple times in a single transaction
     */
    function _consumeSlots(string calldata _thirdPartyId, ConsumeSlotsParam[] calldata _consumeSlotsParams) internal {
        address sender = _msgSender();

        ThirdParty storage thirdParty = thirdParties[_thirdPartyId];

        for (uint256 i = 0; i < _consumeSlotsParams.length; i++) {
            ConsumeSlotsParam memory consumeSlotParam = _consumeSlotsParams[i];

            require(consumeSlotParam.qty > 0, "TPR#_consumeSlots: INVALID_QTY");

            uint256 newConsumedSlots = thirdParty.consumedSlots.add(consumeSlotParam.qty);

            require(thirdParty.maxItems >= newConsumedSlots, 'TPR#_consumeSlots: NO_ITEM_SLOTS_AVAILABLE');

            bytes32 messageHash = toTypedMessageHash(
                keccak256(abi.encode(CONSUME_SLOTS_TYPEHASH, keccak256(bytes(_thirdPartyId)), consumeSlotParam.qty, consumeSlotParam.salt))
            );

            require(thirdParty.receipts[messageHash] == 0, 'TPR#_consumeSlots: MESSAGE_ALREADY_PROCESSED');

            address signer = ecrecover(messageHash, consumeSlotParam.sigV, consumeSlotParam.sigR, consumeSlotParam.sigS);

            require(thirdParty.managers[signer], 'TPR#_consumeSlots: INVALID_SIGNER');

            thirdParty.receipts[messageHash] = consumeSlotParam.qty;
            thirdParty.consumedSlots = newConsumedSlots;

            emit ItemSlotsConsumed(_thirdPartyId, consumeSlotParam.qty, signer, messageHash, sender);
        }
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