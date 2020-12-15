// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "../interfaces/IForwarder.sol";
import "../interfaces/IERC20.sol";
import "../interfaces/IERC721CollectionV2.sol";
import "../interfaces/IERC721CollectionFactoryV2.sol";
import "../commons/OwnableInitializable.sol";
import "../commons/NativeMetaTransaction.sol";


contract CollectionManager is OwnableInitializable, NativeMetaTransaction {

    using SafeMath for uint256;

    IERC20  public acceptedToken;
    address public committee;
    address public feesCollector;
    uint256 public pricePerItem;

    event AcceptedTokenSet(IERC20 indexed _oldAcceptedToken, IERC20 indexed _newAcceptedToken);
    event CommitteeSet(address indexed _oldCommittee, address indexed _newCommittee);
    event FeesCollectorSet(address indexed _oldFeesCollector, address indexed _newFeesCollector);
    event PricePerItemSet(uint256 _oldPricePerItem, uint256 _newPricePerItem);

    /**
    * @notice Create the contract
    * @param _owner - owner of the contract
    * @param _acceptedToken - accepted ERC20 token for collection deployment
    * @param _committee - committee contract
    * @param _feesCollector - fees collector
    * @param _pricePerItem - price per item
    */
    constructor(address _owner, IERC20 _acceptedToken, address _committee, address _feesCollector, uint256 _pricePerItem) public {
        // EIP712 init
        _initializeEIP712('Decentraland Collection Manager', '1');
        // Ownable init
        _initOwnable();

        setAcceptedToken(_acceptedToken);
        setCommittee(_committee);
        setFeesCollector(_feesCollector);
        setPricePerItem(_pricePerItem);

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
    * @notice Set the fees collector
    * @param _newFeesCollector - fees collector
    */
    function setFeesCollector(address _newFeesCollector) onlyOwner public {
        require(_newFeesCollector != address(0), "CollectionManager#setFeesCollector: INVALID_FEES_COLLECTOR");

        emit FeesCollectorSet(feesCollector, _newFeesCollector);
        feesCollector = _newFeesCollector;
    }

    /**
    * @notice Set the price per item
    * @param _newPricePerItem - price per item
    */
    function setPricePerItem(uint256 _newPricePerItem) onlyOwner public {
        emit PricePerItemSet(pricePerItem, _newPricePerItem);
        pricePerItem = _newPricePerItem;
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
        IERC721CollectionV2.Item[] memory _items
     ) external {
        uint256 amount = _items.length.mul(pricePerItem);
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
    function manageCollection(IForwarder _forwarder, IERC721CollectionV2 _collection, bytes calldata _data) public {
        require(
            _msgSender() == committee,
            "CollectionManager#manageCollection: UNAUTHORIZED_SENDER"
        );

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