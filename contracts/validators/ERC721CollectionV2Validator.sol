// SPDX-License-Identifier: MIT

pragma solidity  ^0.7.3;

import "./BaseCollectionValidator.sol";
import "../commons//OwnableInitializable.sol";
import "../interfaces/IERC721CollectionFactoryV2.sol";

contract ERC721CollectionV2Validator is OwnableInitializable, BaseCollectionValidator {

    mapping(IERC721CollectionFactoryV2 => uint256) public factories;

    event FactorySet(IERC721CollectionFactoryV2 indexed _factory, uint256 _value);

   /**
    * @notice Create the contract
    * @param _owner - owner of the contract
    * @param _factories - collection factories
    * @param _values - whether the factories should be allowed or not
    */
    constructor(address _owner, IERC721CollectionFactoryV2[] memory _factories, uint256[] memory _values) {
        _initOwnable();
        setFactories(_factories, _values);
        transferOwnership(_owner);
    }

    /**
    * @notice Manage factories the contract
    * @param _factories - collection factories
    * @param _values - whether the factories should be allowed or not
    */
    function setFactories(IERC721CollectionFactoryV2[] memory _factories, uint256[] memory _values) onlyOwner public {
        require(_factories.length == _values.length, "CV2V#setFactories: LENGTH_MISMATCH");

        for (uint256 i = 0; i < _factories.length; i++) {
            IERC721CollectionFactoryV2 factory = _factories[i];
            uint256 value = _values[i];

            factories[factory] = value;
            emit FactorySet(factory, value);
        }
    }

    /**
    * @notice Check whether a collection is valid or not
    * @param _collection - collection to check if it is valid
    * @param _data - aux data
    * @return boolean whether the collection is valid or not
    */
    function isValidCollection(address _collection, bytes calldata _data)  external override view returns (bool) {
        (IERC721CollectionFactoryV2 factory) = abi.decode(_data, (IERC721CollectionFactoryV2));

        return factories[factory] > 0 && factory.isCollectionFromFactory(_collection);
    }
}
