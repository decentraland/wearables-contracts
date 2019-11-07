pragma solidity ^0.5.11;


import "../../contracts/ERC721CollectionFactory.sol";

interface EventsInterface {
  event Issue(address indexed _beneficiary, uint256 indexed _tokenId, bytes32 indexed _wearableIdKey, string _wearableId, uint256 _issuedId);
}

contract DummyERC721CollectionFactory is ERC721CollectionFactory, EventsInterface {

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _baseURI,
        ProxyRegistry _proxyRegistry,
        ERC721Collection _erc721Collection
    )  ERC721CollectionFactory (
          _name,
          _symbol,
          _baseURI,
          _proxyRegistry,
          _erc721Collection
    ) public {}

}