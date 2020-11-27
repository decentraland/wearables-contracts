// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;


import "../../commons/MinimalProxyFactory.sol";

contract ERC721CollectionFactoryV2 is MinimalProxyFactory {

    address[] public collections;
    mapping(address => bool) public isCollectionFromFactory;

    constructor(address _implementation, address _owner) public MinimalProxyFactory(_implementation) {
        transferOwnership(_owner);
    }

    function createCollection(bytes32 _salt, bytes memory _data) public onlyOwner returns (address addr) {
        // Deploy a new collection
        addr = _createProxy(_salt, _data);

        // Transfer ownership to the owner after deployment
        Ownable(addr).transferOwnership(owner());

        // Set variables for handle data faster
        // This use storage and therefore make deployments expensive.
        collections.push(addr);
        isCollectionFromFactory[addr] = true;
    }

    function collectionsSize() public view returns (uint256) {
        return collections.length;
    }
}