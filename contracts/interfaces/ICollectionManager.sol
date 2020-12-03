// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;


interface ICollectionManager {
   function manageCollection(address _collection, bool _value) external;
}