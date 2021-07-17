// SPDX-License-Identifier: MIT

pragma solidity  ^0.7.3;
pragma experimental ABIEncoderV2;


contract DummyFxRoot {

    address public fxChild;
    uint256 public counter;

    event StateSynced(
        uint256 indexed id,
        address indexed contractAddress,
        bytes data
    );

    constructor(){}

    function setFxChild(address _fxChild) public {
        require(fxChild == address(0x0));
        fxChild = _fxChild;
    }

    function sendMessageToChild(address _fxChildTunnel, bytes memory _message) public  {
        counter = counter + 1;
        bytes memory data = abi.encode(msg.sender, _fxChildTunnel, _message);
        emit StateSynced(counter, fxChild, data);
    }

}
