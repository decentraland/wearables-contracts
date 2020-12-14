// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../interfaces/IERC20.sol";
import "../interfaces/IERC721CollectionV2.sol";
import "../interfaces/IERC721CollectionFactoryV2.sol";


contract CollectionManager is Ownable {

    using SafeMath for uint256;

    IERC20  public acceptedToken;
    address public committee;
    address public feesCollector;
    uint256 public pricePerItem;

    event AcceptedTokenSet(IERC20 indexed _oldAcceptedToken, IERC20 indexed _newAcceptedToken);
    event CommitteeSet(address indexed _oldCommittee, address indexed _newCommittee);
    event FeesCollectorSet(address indexed _oldFeesCollector, address indexed _newFeesCollector);
    event PricePerItemSet(uint256 _oldPricePerItem, uint256 _newPricePerItem);

    constructor(address _owner, IERC20 _acceptedToken, address _committee, address _feesCollector, uint256 _pricePerItem) public {
        setAcceptedToken(_acceptedToken);
        setCommittee(_committee);
        setFeesCollector(_feesCollector);
        setPricePerItem(_pricePerItem);
        transferOwnership(_owner);
    }


    function setAcceptedToken(IERC20 _newAcceptedToken) onlyOwner public {
        require(address(_newAcceptedToken) != address(0), "CollectionManager#setAcceptedToken: INVALID_ACCEPTED_TOKEN");

        emit AcceptedTokenSet(acceptedToken, _newAcceptedToken);
        acceptedToken = _newAcceptedToken;
    }

    function setCommittee(address _newCommittee) onlyOwner public {
        require(_newCommittee != address(0), "CollectionManager#setCommittee: INVALID_COMMITTEE");

        emit CommitteeSet(committee, _newCommittee);
        committee = _newCommittee;
    }

    function setFeesCollector(address _newFeesCollector) onlyOwner public {
        require(_newFeesCollector != address(0), "CollectionManager#setFeesCollector: INVALID_FEES_COLLECTOR");

        emit FeesCollectorSet(feesCollector, _newFeesCollector);
        feesCollector = _newFeesCollector;
    }

    function setPricePerItem(uint256 _newPricePerItem) onlyOwner public {
        emit PricePerItemSet(pricePerItem, _newPricePerItem);
        pricePerItem = _newPricePerItem;
    }

    function createCollection(
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
                acceptedToken.transferFrom(msg.sender, feesCollector, amount),
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

        _factory.createCollection(_salt, data);
    }

    function manageCollection(IERC721CollectionV2 _collection, bool _value) external {
        require(msg.sender == committee, "CollectionManager#manageCollection: UNAUTHORIZED_SENDER");

        _collection.setApproved(_value);
    }
}