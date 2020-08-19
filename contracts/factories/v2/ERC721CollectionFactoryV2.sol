// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;


import "../../commons/MinimalProxyFactory.sol";

contract ERC721CollectionFactoryV2 is MinimalProxyFactory {
    constructor(address _implementation) public MinimalProxyFactory(_implementation) { }
}