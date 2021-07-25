// SPDX-License-Identifier: MIT

pragma solidity  ^0.7.3;

import "./BaseCollectionValidator.sol";


contract ERC721CollectionV1Validator is BaseCollectionValidator {

    mapping(address => uint256) public collections;

   /**
    * @notice Create the contract
    * @param _collections - list of valid collections
    */
    constructor(address[] memory _collections) {
       for (uint256 i = 0; i < _collections.length; i++) {
           collections[_collections[i]] = 1;
       }
    }

    /**
    * @notice Check whether a collection is valid or not
    * @param _collection - collection to check if it is valid
    * @return boolean whether the collection is valid or not
    */
    function isValidCollection(address _collection, bytes calldata /*_data*/)  external override view returns (bool) {
        return collections[_collection] > 0;
    }
}
