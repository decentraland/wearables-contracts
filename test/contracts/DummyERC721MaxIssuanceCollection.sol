pragma solidity ^0.5.11;


import "../../contracts/ERC721BaseCollection.sol";

contract DummyERC721MaxIssuanceCollection is ERC721BaseCollection {

    constructor(
        string memory _name,
        string memory _symbol,
        address _operator,
        string memory _baseURI
    )  ERC721BaseCollection (
          _name,
          _symbol,
          _operator,
          _baseURI
    ) public {}

    function issueToken(address _beneficiary, string memory _wearableId) public {
        bytes32 key = getWearableKey(_wearableId);
        uint256 issuedId = 1;
        uint256 tokenId = this.totalSupply();

        _mint(_beneficiary, tokenId, key, _wearableId, issuedId);

        _setTokenURI(
            tokenId,
            string(abi.encodePacked(_wearableId, "/", issuedId.uintToString()))
        );
    }

    function _setTokenURI(uint256 _tokenId, string memory _uri) internal {
        _tokenPaths[_tokenId] = _uri;
    }
}