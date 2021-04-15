// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "../interfaces/IForwarder.sol";
import "../interfaces/IERC20.sol";
import "../interfaces/IERC721CollectionV2.sol";
import "../interfaces/IERC721CollectionFactoryV2.sol";
import "../interfaces/IRarities.sol";
import "../commons/OwnableInitializable.sol";
import "../commons/NativeMetaTransaction.sol";


contract CollectionManager is OwnableInitializable, NativeMetaTransaction {

    using SafeMath for uint256;

    IERC20  public acceptedToken;
    IRarities public rarities;
    address public committee;
    address public feesCollector;
    uint256 public pricePerItem;

    mapping(bytes4 => bool) public allowedCommitteeMethods;


    event AcceptedTokenSet(IERC20 indexed _oldAcceptedToken, IERC20 indexed _newAcceptedToken);
    event CommitteeSet(address indexed _oldCommittee, address indexed _newCommittee);
    event CommitteeMethodSet(bytes4 indexed _method, bool _isAllowed);
    event FeesCollectorSet(address indexed _oldFeesCollector, address indexed _newFeesCollector);
    event RaritiesSet(IRarities indexed _oldRarities, IRarities indexed _newRarities);

    /**
    * @notice Create the contract
    * @param _owner - owner of the contract
    * @param _acceptedToken - accepted ERC20 token for collection deployment
    * @param _committee - committee contract
    * @param _feesCollector - fees collector
    * @param _rarities - rarities contract
    * @param _committeeMethods - method selectors
    * @param _committeeValues - whether the method is allowed or not
    */
    constructor(
        address _owner,
        IERC20 _acceptedToken,
        address _committee,
        address _feesCollector,
        IRarities _rarities,
        bytes4[] memory _committeeMethods,
        bool[] memory _committeeValues
    ) {
        // EIP712 init
        _initializeEIP712('Decentraland Collection Manager', '1');
        // Ownable init
        _initOwnable();

        setAcceptedToken(_acceptedToken);

        // Committee
        setCommittee(_committee);
        setCommitteeMethods(_committeeMethods, _committeeValues);

        setFeesCollector(_feesCollector);
        setRarities(_rarities);

        transferOwnership(_owner);
    }

    /**
    * @notice Set the accepted token
    * @param _newAcceptedToken - accepted ERC20 token for collection deployment
    */
    function setAcceptedToken(IERC20 _newAcceptedToken) onlyOwner public {
        require(address(_newAcceptedToken) != address(0), "CollectionManager#setAcceptedToken: INVALID_ACCEPTED_TOKEN");

        emit AcceptedTokenSet(acceptedToken, _newAcceptedToken);
        acceptedToken = _newAcceptedToken;
    }

    /**
    * @notice Set the committee
    * @param _newCommittee - committee contract
    */
    function setCommittee(address _newCommittee) onlyOwner public {
        require(_newCommittee != address(0), "CollectionManager#setCommittee: INVALID_COMMITTEE");

        emit CommitteeSet(committee, _newCommittee);
        committee = _newCommittee;
    }

    /**
    * @notice Set methods to be allowed by the committee
    * @param _methods - method selectors
    * @param _values - whether the method is allowed or not
    */
    function setCommitteeMethods(bytes4[] memory _methods, bool[] memory _values) onlyOwner public {
        uint256 length = _methods.length;
        require(length > 0 && length == _values.length, "CollectionManager#setCommitteeMethods: EMPTY_METHODS");

        for (uint256 i = 0; i < length; i++) {
            bytes4 method = _methods[i];
            bool value = _values[i];

            allowedCommitteeMethods[method] = value;

            emit CommitteeMethodSet(method, value);
        }
    }

    /**
    * @notice Set the fees collector
    * @param _newFeesCollector - fees collector
    */
    function setFeesCollector(address _newFeesCollector) onlyOwner public {
        require(_newFeesCollector != address(0), "CollectionManager#setFeesCollector: INVALID_FEES_COLLECTOR");

        emit FeesCollectorSet(feesCollector, _newFeesCollector);
        feesCollector = _newFeesCollector;
    }

    /**
    * @notice Set the rarities
    * @param _newRarities - price per item
    */
    function setRarities(IRarities _newRarities) onlyOwner public {
        require(address(_newRarities) != address(0), "CollectionManager#setRarities: INVALID_RARITIES");

        emit RaritiesSet(rarities, _newRarities);
        rarities = _newRarities;
    }

    /**
    * @notice Create a collection
    * @param _forwarder - forwarder contract owner of the collection factory
    * @param _factory - collection factory
    * @param _salt - arbitrary 32 bytes hexa
    * @param _name - name of the contract
    * @param _symbol - symbol of the contract
    * @param _baseURI - base URI for token URIs
    * @param _creator - creator address
    * @param _items - items to be added
    */
    function createCollection(
        IForwarder _forwarder,
        IERC721CollectionFactoryV2 _factory,
        bytes32 _salt,
        string memory _name,
        string memory _symbol,
        string memory _baseURI,
        address _creator,
        IERC721CollectionV2.ItemParam[] memory _items
     ) external {
        require(address(_forwarder) != address(this), "CollectionManager#createCollection: FORWARDER_CANT_BE_THIS");
        uint256 amount = 0;

        for (uint256 i = 0; i < _items.length; i++) {
            IERC721CollectionV2.ItemParam memory item = _items[i];

            IRarities.Rarity memory rarity = rarities.getRarityByName(item.rarity);

            amount = amount.add(rarity.price);
        }

        // Transfer fees to collector
        if (amount > 0) {
            require(
                acceptedToken.transferFrom(_msgSender(), feesCollector, amount),
                "CollectionManager#createCollection: TRANSFER_FEES_FAILED"
            );
        }

        bytes memory data = abi.encodeWithSelector(
            IERC721CollectionV2.initialize.selector,
            _name,
            _symbol,
            _baseURI,
            _creator,
            true, // Collection should be completed
            false, // Collection should start disapproved
            rarities,
            _items
        );

        (bool success,) = _forwarder.forwardCall(address(_factory), abi.encodeWithSelector(_factory.createCollection.selector, _salt, data));
        require(
            success,
             "CollectionManager#createCollection: FORWARD_FAILED"
        );
    }

    /**
    * @notice Manage a collection
    * @param _forwarder - forwarder contract owner of the collection factory
    * @param _collection - collection to be managed
    * @param _data - call data to be used
    */
    function manageCollection(IForwarder _forwarder, IERC721CollectionV2 _collection, bytes calldata _data) external {
        require(address(_forwarder) != address(this), "CollectionManager#manageCollection: FORWARDER_CANT_BE_THIS");
        require(
            _msgSender() == committee,
            "CollectionManager#manageCollection: UNAUTHORIZED_SENDER"
        );

        (bytes4 method) = abi.decode(_data, (bytes4));
        require(allowedCommitteeMethods[method], "CollectionManager#manageCollection: COMMITTEE_METHOD_NOT_ALLOWED");

        bool success;
        bytes memory res;

        (success, res) = address(_collection).staticcall(abi.encodeWithSelector(_collection.COLLECTION_HASH.selector));
        require(
            success && abi.decode(res, (bytes32)) == keccak256("Decentraland Collection"),
            "CollectionManager#manageCollection: INVALID_COLLECTION"
        );

        (success,) = _forwarder.forwardCall(address(_collection), _data);
        require(
            success,
            "CollectionManager#manageCollection: FORWARD_FAILED"
        );
    }
}