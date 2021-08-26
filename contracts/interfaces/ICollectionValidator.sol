// SPDX-License-Identifier: MIT

pragma solidity  ^0.7.3;


interface ICollectionValidator {

    /**
    * @notice Check whether a collection is valid or not
    * @param _collection - collection to check if it is valid
    * @param _data - aux data
    * @return boolean whether the collection is valid or not
    */
    function isValidCollection(address _collection, bytes calldata _data) external view returns (bool);
}