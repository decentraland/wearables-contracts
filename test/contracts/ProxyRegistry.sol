
// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

contract OwnableDelegateProxy { }

contract ProxyRegistry {
    mapping(address => OwnableDelegateProxy) public proxies;

    function setProxy(OwnableDelegateProxy _proxy) public {
        proxies[msg.sender] = _proxy;
    }
}
