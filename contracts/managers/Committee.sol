// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;


import "@openzeppelin/contracts/access/Ownable.sol";

import "../interfaces/ICollectionManager.sol";


contract Committee is Ownable {

    mapping(address => bool) public members;

    event MemberSet(address indexed _member, bool _value);

    constructor(address _owner, address[] memory _members) public {
        transferOwnership(_owner);

        for (uint256 i = 0; i < _members.length; i++) {
            address member = _members[i];

            members[member] = true;

            emit MemberSet(member, true);
        }
    }

    function setMember(address _address, bool _value) external onlyOwner {
        members[_address] = _value;

        emit MemberSet(_address, _value);
    }

    function manageCollection(ICollectionManager _collectionManager, address _collection, bool _value) public {
        require(members[msg.sender], "Committee#manageCollection: UNAUTHORIZED_SENDER");

        _collectionManager.manageCollection(_collection, _value);
    }



}