// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;


import "../collections/v1/ERC721DeterministicCollection.sol";

contract DummyERC721DeterministicCollection is ERC721DeterministicCollection {

    constructor(
        string memory _name,
        string memory _symbol,
        address _operator,
        string memory _baseURI
    )  ERC721DeterministicCollection (
          _name,
          _symbol,
          _operator,
          _baseURI
    ) public {}

    function encodeTokenId(uint256 _a, uint256 _b) public pure returns (uint256) {
        return _encodeTokenId(_a, _b);
    }

    function decodeTokenId(uint256 _id) public pure returns (uint256, uint256) {
        return _decodeTokenId(_id);
    }

}