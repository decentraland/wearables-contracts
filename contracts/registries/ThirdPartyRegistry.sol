// SPDX-License-Identifier: MIT

pragma solidity  ^0.7.3;

import "../commons//OwnableInitializable.sol";
import "../commons//NativeMetaTransaction.sol";
import "../interfaces/ICommittee.sol";
import "../libs/String.sol";

contract ThirdPartyRegistry is OwnableInitializable, NativeMetaTransaction {

    struct URN {
        string urn;
        bool isApproved;
    }

    struct ThirdParty {
        string metadata;
        string resolver;
        string urnPrefix;
        uint256 maxURNs;
        uint256 totalURNs;
        mapping(address => bool) managers;
        mapping(bytes32 => URN) urns;
        string[] existingsURNs;

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
    }


    struct ThirdPartyParam {
        string metadata;
        string resolver;
        string urnPrefix;
        uint256 maxURNs;
        address[] managers;
    }


    mapping(bytes32 => ThirdParty) thirdParties;


    ICommittee public committee;
    bool public initialURNValue;

    event ThirdPartyAdded(bytes32 indexed _id, string _metadata, string _resolver string _urnPrefix, uint256 _maxURNs, address[] _managers, address _caller);
    event ManagerSet(bytes32 indexed _id, address _manager, bool _value, address _caller);
    event URNAdded(bytes32 indexed _id, bytes32 indexed _urnId, string _urn, bool _value, address _caller);
    event URNReviewed(bytes32 indexed _id, bytes32 indexed _urnId, string _urn, bool _value, address _caller);
    event CommitteeSet(address indexed _oldCommittee, address indexed _newCommittee, address _caller));
    event InitialURNValueSet(bool _oldInitialURNValue, bool _newInitialURNValue, address _caller));

   /**
    * @notice Create the contract
    * @param _name - domain contract name
    * @param _version - domain contract version
    * @param _owner - contract owner
    * @param _maxTokensPerTx - max tokens to be bridged per transactions
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
    function setCommittee(address _newCommittee) onlyOwner public {
        require(_newCommittee != address(0), "TPR#setCommittee: INVALID_COMMITTEE");

        emit CommitteeSet(committee, _newCommittee, _msgSender();
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
            require(maxURNs > 0, "TPR#addThirdParties: 0_URNS");
            require(managers.length > 0, "TPR#addThirdParties: EMPTY_MANAGERS");

            bytes32 id = keccak256(bytes(thirdparty.urnPrefix));
            ThirdParty memory thirdParty = ThirdParty(
                thirdParty.metadata,
                thirdParty.resolver,
                thirdParty.urnPrefix;
                thirdParty.maxURNs;
                0
            );

            {
                for (uint256 i = 0; i < thirdPartyParam.managers.length; i++) {
                    thirdParty.managers[thirdPartyParam.managers[i]] = true;
                }
            }

            thirdParties[id] = thirdParty;

            emit ThirdPartyAdded(
                id,
                thirdparty.metadata,
                thirdparty.resolver,
                thirdparty.urnPrefix,
                thirdparty.maxURNs,
                thirdparty.managers,
                _msgSender()
            );
        }
    }

     /**
    * @notice Set third party managers
    * @param _id - third party id
    * @param _address - managers to be set
    * @param _values - whether the managers are being added or removed
    */
    function setManagers(bytes32 _id, address[] calldata _managers, bool[] calldata _values) onlyCommittee external {
        require(_managers.length == _values.length, "TPR#setManagers: LENGTH_MISMATCH");

        for (uint256 i = 0; i < _managers.length; i++) {
            _setThirdPartyManager(_id, _managers[i], _values[i]);
        }
    }


     /**
    * @notice Set a third party manager
    * @param _id - third party id
    * @param _address - manager to be set
    * @param _value - whether the manager is being added or removed
    */
    function _setManager(bytes32 _id, address _manager, bool _value) internal {
        ThirdParty storage thirdParty = thirdParties[_id];
        require(thirdParty.maxURNs > 0, "TPR#_setManager: INVALID_THIRD_PARTY_ID");

        thirdParty.managers[_manager] = value;
        emit ManagerSet(_id, _manager, _value, _msgSender());
    }

     /**
    * @notice Add URNs to a third party
    * @param _id - third party id
    * @param _urns - URNs to be added
    * @param _values - whether the managers are being added or removed
    */
    function addURNs(bytes32 _id, string[] calldata _urns) external {
        address sender = _msgSender();
        // @TODO check if we can set by the builser-server a future blockchain item id
        ThirdParty storage thirdParty = thirdParties[_id];
        require(thirdParty.maxURNs > 0, "TPR#addURNs: INVALID_THIRD_PARTY_ID");
        require(thirdParty.maxURNs >= thirdParty.totalURNs.add(_urns.length), "TPR#addURNs: URN_FULL");

        for (uint256 i = 0; i < _urns.length; i++) {
            string urn = ThirdParty_urns[i];
            require(bytes(urn).length > 0, "TPR#addThirdParties: EMPTY_URN");
            require(bytes(thirdParty[urnId].urn).length == 0, "TPR#addURNs: URN_ALREADY_ADDED");

            bytes32 urnId =  keccak256(bytes(urn));
            thirdParty[urnId] = URN(urn, initialURNValue);

            emit URNAdded(_id, urnId, urn, initialURNValue, _msgSender());
        }
    }

     /**
    * @notice Add URNs to a third party
    * @param _id - third party id
    * @param _urns - URNs to be added
    * @param _values - whether the managers are being added or removed
    */
    function reviewURNs(bytes32 _id, string[] calldata _urns) external {
        address sender = _msgSender();

        ThirdParty storage thirdParty = thirdParties[_id];
        require(thirdParty.maxURNs > 0, "TPR#addURNs: INVALID_THIRD_PARTY_ID");
        require(thirdParty.maxURNs >= thirdParty.totalURNs.add(_urns.length), "TPR#addURNs: URN_FULL");

        for (uint256 i = 0; i < _urns.length; i++) {
            string urn = _urns[i];
            require(bytes(urn).length > 0, "TPR#addThirdParties: EMPTY_URN");

            bytes32 urnId =  keccak256(bytes(urn));
            thirdParty[urnId] = URN(urn, initialURNValue);

            emit URNAdded(_id, urnId, urn, initialURNValue, _msgSender());
        }
    }

}
