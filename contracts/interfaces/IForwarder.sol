// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;


interface IForwarder {
   function forwardCall(address _address, bytes calldata _data) external returns (bool, bytes memory);
}