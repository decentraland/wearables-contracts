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
            _setMember(_members[i], true);
        }
    }

    function setMembers(address[] calldata _members, bool[] calldata _values) external onlyOwner {
        require(_members.length == _values.length, "Committee#setMembers: LENGTH_MISMATCH");

        for (uint256 i = 0; i < _members.length; i++) {
            _setMember(_members[i], _values[i]);
        }
    }

    function _setMember(address _member, bool _value) internal {
        members[_member] = _value;

        emit MemberSet(_member, _value);
    }

    function manageCollection(ICollectionManager _collectionManager, address _collection, bool _value) public {
        require(members[msg.sender], "Committee#manageCollection: UNAUTHORIZED_SENDER");

        _collectionManager.manageCollection(_collection, _value);
    }



}