// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;


import "../../commons/MinimalProxyFactory.sol";

contract ERC721CollectionFactoryV2 is MinimalProxyFactory {

    constructor(address _implementation, address _owner) public MinimalProxyFactory(_implementation) {
        transferOwnership(_owner);
    }

    function createProxy(bytes32 _salt, bytes memory _data) public override returns (address addr) {
        // Deploy a new collection
        addr = super.createProxy(_salt, _data);

        // Transfer ownership to the owner after deployment
        Ownable(addr).transferOwnership(owner());
    }
}