
pragma solidity ^0.5.11;

contract OwnableDelegateProxy { }

contract ProxyRegistry {
    mapping(address => OwnableDelegateProxy) public proxies;

    function setProxy(OwnableDelegateProxy _proxy) public {
        proxies[msg.sender] = _proxy;
    }
}
