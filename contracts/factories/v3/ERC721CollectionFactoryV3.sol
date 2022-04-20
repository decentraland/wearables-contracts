// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;

import "@openzeppelin/contracts/access/Ownable.sol";

import "../../commons/BeaconProxyFactory.sol";

contract ERC721CollectionFactoryV3 is Ownable, BeaconProxyFactory {

    address[] public collections;
    mapping(address => bool) public isCollectionFromFactory;

    /**
    * @notice Create the contract
    * @param _owner - contract owner
    * @param _implementation - contract implementation
    */
    constructor(address _owner, address _implementation) BeaconProxyFactory(_implementation) {
        transferOwnership(_owner);
    }

    /**
    * @notice Create a collection
    * @param _salt - arbitrary 32 bytes hexa
    * @param _data - call data used to call the contract already created if passed
    * @return addr - address of the contract created
    */
    function createCollection(bytes32 _salt, bytes memory _data) external onlyOwner returns (address addr) {
        // Deploy a new collection
        addr = _createProxy(_salt, _data);

        // Transfer ownership to the owner after deployment
        Ownable(addr).transferOwnership(owner());

        // Set variables for handle data faster
        // This use storage and therefore make deployments expensive.
        collections.push(addr);
        isCollectionFromFactory[addr] = true;
    }

    /**
    * @notice Get the amount of collections deployed
    * @return amount of collections deployed
    */
    function collectionsSize() external view returns (uint256) {
        return collections.length;
    }
}