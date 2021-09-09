// SPDX-License-Identifier: MIT

pragma solidity  ^0.7.3;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "../commons//OwnableInitializable.sol";
import "../commons//NativeMetaTransaction.sol";
import "../interfaces/ICommittee.sol";
import "../libs/String.sol";

contract ThirdPartyRegistry is OwnableInitializable, NativeMetaTransaction {
    using SafeMath for uint256;

    struct ThirdPartyParam {
        string urnPrefix;
        string metadata;
        string resolver;
        uint256 maxItems;
        address[] managers;
    }

    struct ItemParam {
        string urnSuffix;
        string metadata;
    }

    struct ItemReviewParam {
        bytes32 itemId;
        string contentHash;
        bool value;
    }

    struct Item {
        string urnSuffix;
        string metadata;
        string contentHash;
        bool isApproved;
    }

    struct ThirdParty {
        string urnPrefix;
        string metadata;
        string resolver;
        uint256 maxItems;
        bool isApproved;
        mapping(address => bool) managers;
        mapping(bytes32 => Item) items;
        string[] itemIds;
    }

    struct ItemLookup {
        bytes32 thirdPartyId;
        bytes32 itemId;
    }

    mapping(bytes32 => ThirdParty) thirdParties;
    mapping(string => ItemLookup) itemsLookup;


    ICommittee public committee;
    bool public initialURNValue;

    event ThirdPartyAdded(bytes32 indexed _thirdPartyId, string _metadata, string _resolver, string _urnPrefix, uint256 _maxItems, address[] _managers, address _caller);
    event ManagerSet(bytes32 indexed _thirdPartyId, address _manager, bool _value, address _caller);
    event ItemAdded(bytes32 indexed _thirdPartyId, bytes32 indexed _itemId, string _urnSuffix, string _urn, string _metadata, string _contentHash, bool _value, address _caller);
    event ItemReviewed(bytes32 indexed _thirdPartyId, bytes32 indexed _itemId, string _contentHash, bool _value, address _caller);
    event CommitteeSet(ICommittee indexed _oldCommittee, ICommittee indexed _newCommittee, address _caller);
    event InitialURNValueSet(bool _oldInitialURNValue, bool _newInitialURNValue, address _caller);

   /**
    * @notice Create the contract
    * @param _owner - owner of the contract
    * @param _committee - committee smart contract
    */
    constructor(address _owner, ICommittee _committee) {
        _initializeEIP712("Decentraland Third Party Registry", "1");
        _initOwnable();

        transferOwnership(_owner);
        setCommittee(_committee);
        setInitialURNValue(true);
    }

    modifier onlyCommittee() {
        require(
            committee.members(_msgSender()),
            "onlyCreator: CALLER_IS_NOT_A_COMMITTEE_MEMBER"
        );
        _;
    }


    /**
    * @notice Set the committee
    * @param _newCommittee - committee contract
    */
    function setCommittee(ICommittee _newCommittee) onlyOwner public {
        require(address(_newCommittee) != address(0), "TPR#setCommittee: INVALID_COMMITTEE");

        emit CommitteeSet(committee, _newCommittee, _msgSender());
        committee = _newCommittee;
    }

    /**
    * @notice Set the initial URN value
    * @param _newInitialURNValue - initial value
    */
    function setInitialURNValue(bool _newInitialURNValue) onlyOwner public {
        emit InitialURNValueSet(initialURNValue, _newInitialURNValue, _msgSender());
        initialURNValue = _newInitialURNValue;
    }

    /**
    * @notice Add third parties
    * @param _thirdParties - third parties to be added
    */
    function addThirdParties(ThirdPartyParam[] calldata _thirdParties) onlyCommittee external {
        for (uint256 i = 0; i < _thirdParties.length; i++) {
            ThirdPartyParam memory thirdPartyParam = _thirdParties[i];

            require(bytes(thirdPartyParam.metadata).length > 0, "TPR#addThirdParties: EMPTY_METADATA");
            require(bytes(thirdPartyParam.resolver).length > 0, "TPR#addThirdParties: EMPTY_RESOLVER");
            require(bytes(thirdPartyParam.urnPrefix).length > 0, "TPR#addThirdParties: EMPTY_URN_PREFIX");
            require(thirdPartyParam.maxItems > 0, "TPR#addThirdParties: ZERO_URNS");
            require(thirdPartyParam.managers.length > 0, "TPR#addThirdParties: EMPTY_MANAGERS");

            bytes32 id = keccak256(bytes(thirdPartyParam.urnPrefix));

            ThirdParty storage thirdParty = thirdParties[id];
            thirdParty.urnPrefix = thirdPartyParam.urnPrefix;
            thirdParty.metadata = thirdPartyParam.metadata;
            thirdParty.resolver = thirdPartyParam.resolver;
            thirdParty.maxItems = thirdPartyParam.maxItems;
            thirdParty.isApproved =  true; //@TODO: revisit the isApproved

            for (uint256 m = 0; m < thirdPartyParam.managers.length; m++) {
                thirdParty.managers[thirdPartyParam.managers[m]] = true;
            }

            emit ThirdPartyAdded(
                id,
                thirdParty.metadata,
                thirdParty.resolver,
                thirdParty.urnPrefix,
                thirdParty.maxItems,
                thirdPartyParam.managers,
                _msgSender()
            );
        }
    }

     /**
    * @notice Set third party managers
    * @param _thirdPartyId - third party id
    * @param _managers - managers to be set
    * @param _values - whether the managers are being added or removed
    */
    function setManagers(bytes32 _thirdPartyId, address[] calldata _managers, bool[] calldata _values) onlyCommittee external {
        require(_managers.length == _values.length, "TPR#setManagers: LENGTH_MISMATCH");

        for (uint256 i = 0; i < _managers.length; i++) {
            _setManager(_thirdPartyId, _managers[i], _values[i]);
        }
    }


     /**
    * @notice Set a third party manager
    * @param _thirdPartyId - third party id
    * @param _manager - manager to be set
    * @param _value - whether the manager is being added or removed
    */
    function _setManager(bytes32 _thirdPartyId, address _manager, bool _value) internal {
        ThirdParty storage thirdParty = thirdParties[_thirdPartyId];
        require(thirdParty.maxItems > 0, "TPR#_setManager: INVALID_THIRD_PARTY_ID");

        thirdParty.managers[_manager] = _value;
        emit ManagerSet(_thirdPartyId, _manager, _value, _msgSender());
    }

     /**
    * @notice Add items to a third party
    * @param _thirdPartyId - third party id
    * @param _items - items to be added
    */
    function addItems(bytes32 _thirdPartyId, ItemParam[] calldata _items) external {
        address sender = _msgSender();

        ThirdParty storage thirdParty = thirdParties[_thirdPartyId];
        require(thirdParty.managers[sender], "TPR#addItems: INVALID_SENDER");
        require(thirdParty.maxItems > 0, "TPR#addURNs: INVALID_THIRD_PARTY_ID");
        require(thirdParty.maxItems >= thirdParty.itemIds.length.add(_items.length), "TPR#addURNs: URN_FULL");

        for (uint256 i = 0; i < _items.length; i++) {
            ItemParam memory item = _items[i];
            bytes32 itemId =  keccak256(bytes(item.urnSuffix));

            require(bytes(item.urnSuffix).length > 0, "TPR#addThirdParties: EMPTY_URN");
            require(bytes(thirdParty.items[itemId].urnSuffix).length == 0, "TPR#addURNs: URN_ALREADY_ADDED");

            thirdParty.items[itemId] = Item(
                item.urnSuffix,
                item.metadata,
                '',
                initialURNValue
            );

            thirdParty.itemIds.push(item.urnSuffix);

            emit ItemAdded(
                _thirdPartyId,
                itemId,
                item.urnSuffix,
                string(abi.encodePacked(thirdParty.urnPrefix, ":", item.urnSuffix)),
                item.metadata,
                item.contentHash,
                initialURNValue,
                _msgSender()
            );
        }
    }

     /**
    * @notice Review third party items
    * @param _thirdPartyId - third party id
    * @param _items - Items to be reviewed
    */
    function reviewItems(bytes32 _thirdPartyId, ItemReviewParam[] calldata _items) onlyCommittee external {
        address sender = _msgSender();

        ThirdParty storage thirdParty = thirdParties[_thirdPartyId];
        require(thirdParty.maxItems > 0, "TPR#reviewURNs: INVALID_THIRD_PARTY_ID");

        for (uint256 i = 0; i < _items.length; i++) {
            ItemReviewParam memory itemReview = _items[i];
            Item storage item = thirdParty.items[itemReview.itemId];

            require(bytes(item.urnSuffix).length > 0, "TPR#reviewURNs: INVALID_ITEM");
            require(bytes(itemReview.contentHash) == bytes(item.contentHash), "TPR#reviewURNs: INVALID_ITEM_CONTENT_HASH");

            item.isApproved = itemReview.value;

            emit ItemReviewed(_thirdPartyId, itemReview.itemId, itemReview.contentHash, itemReview.value, _msgSender());
        }
    }

    /**
    * @notice Get an item from a third party by URN
    * @param _urn - item urn
    * @return item
    */
    function getItemByURN(string calldata _urn) external view returns (Item memory) {
        address itemLookup = itemsLookup[_urn];

        ThirdParty memory thirdParty = thirdParties[itemLookup.thirdPartyId];

        return thirdParty.items[itemLookup.itemId];
    }

}


 // urns => {
        //     hash('urn:decentraland:cryptopmotors:jackets:hash(uuid1)') => { urn: 'urn:decentraland:cryptopmotors:jackets:hash(uuid1)', isApproved: true}
        //     hash('urn:decentraland:cryptopmotors:jackets:hash(uuid4)') => {urn: 'urn:decentraland:cryptopmotors:jackets:hash(uuid4)', isApproved: true}
        //     hash('urn:decentraland:cryptopmotors:jackets:hash(uuid5)') => { urn: 'urn:decentraland:cryptopmotors:jackets:hash(uuid5)', isApproved: true}
        // }

        // existingURNS => [
        //     'urn:decentraland:cryptopmotors:jackets:hash(uuid1)',
        //     'urn:decentraland:cryptopmotors:jackets:hash(uuid4)',
        //     'urn:decentraland:cryptopmotors:jackets:hash(uuid5)'
        // ]