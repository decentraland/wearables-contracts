// SPDX-License-Identifier: MIT

pragma solidity  ^0.7.3;
pragma experimental ABIEncoderV2;


interface IERC721BridgedCollection {
    struct Token {
        IERC721BridgedCollection collection;
        uint256 tokenId;
        string tokenURI;
    }

    function mint(address _beneficiaries, Token[] calldata _tokens) external;
    function burn(uint256[] calldata _tokenIds) external;
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function ownerOf(uint256 tokenId) external view returns (address);
    function tokenURI(uint256 tokenId) external view returns (string memory);
    function tokens(uint256 tokenId) external view returns (IERC721BridgedCollection, uint256, string memory);
}