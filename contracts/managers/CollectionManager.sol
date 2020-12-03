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

    IERC20 immutable public acceptedToken;
    address public committee;
    address public feesCollector;
    uint256 public pricePerItem;

    event CommitteeSet(address indexed _oldCommittee, address indexed _newCommittee);

    constructor(IERC20 _acceptedToken, address _committee, address _feesCollector, uint256 _pricePerItem) public {
        acceptedToken = _acceptedToken;
        committee = _committee;
        feesCollector = _feesCollector;
        pricePerItem = _pricePerItem;
    }

    function setCommittee(address _newCommittee) onlyOwner external {
        emit CommitteeSet(committee, _newCommittee);

        committee = _newCommittee;
    }

    function transferFactoryOwnership(IERC721CollectionFactoryV2 _factory, address _newFactoryOwner) onlyOwner external {
        _factory.transferOwnership(_newFactoryOwner);
    }

    function createCollection(IERC721CollectionFactoryV2 _factory, bytes32 _salt, bytes memory _data) external {
        (,,,,,, bytes[] memory items) = abi.decode(_data, (bytes4, string, string, address, bool, string, bytes[]));

        // Transfer fees to collector
        require(
            acceptedToken.transferFrom(msg.sender, feesCollector, items.length.mul(pricePerItem)),
            "CollectionManager#createCollection: TRANSFER_FEES_FAILED"
        );

        _factory.createCollection(_salt, _data);
    }

    function manageCollection(IERC721CollectionV2 _collection, bool _value) public returns (address addr) {
        require(msg.sender == committee, "CollectionManager#manageCollection: UNAUTHORIZED_SENDER");

        _collection.setApproved(_value);
    }



}