// SPDX-License-Identifier: MIT

pragma solidity  ^0.7.3;

import "./BaseCollectionValidator.sol";
import "../interfaces/IERC721CollectionFactoryV2.sol";


contract ERC721CollectionV2Validator is BaseCollectionValidator {

    IERC721CollectionFactoryV2 public collectionsFactory;

   /**
    * @notice Create the contract
    * @param _factory - collections factory
    */
    constructor(IERC721CollectionFactoryV2 _factory) {
       collectionsFactory = _factory;
    }

    /**
    * @notice Check whether a collection is valid or not
    * @param _collection - collection to check if it is valid
    * @param _data - aux data
    * @return boolean whether the collection is valid or not
    */
    function isValidCollection(address _collection, bytes calldata _data)  external override view returns (bool) {
        (IERC721CollectionFactoryV2 factory) = abi.decode(_data, (IERC721CollectionFactoryV2));

        return collectionsFactory == factory && collectionsFactory.isCollectionFromFactory(_collection);
    }
}
