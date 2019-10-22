pragma solidity ^0.5.11;

import "./commons/ExclusiveERC721.sol";


contract ExclusiveMasks is ExclusiveERC721 {
     /**
     * @dev Create the contract.
     * @param _allowed - Address allowed to mint tokens
     * @param _baseURI - base URI for token URIs
     */
    constructor(address _allowed, string memory _baseURI) public ExclusiveERC721("exclusive-masks", "DCLXM") {
        allowed = _allowed;
        baseURI = _baseURI;

        maxIssuance[keccak256("bird_mask")] = 100;
        maxIssuance[keccak256("classic_mask")] = 100;
        maxIssuance[keccak256("clown_nose")] = 100;
        maxIssuance[keccak256("asian_fox")] = 100;
        maxIssuance[keccak256("killer_mask")] = 100;
        maxIssuance[keccak256("serial_killer_mask")] = 100;
        maxIssuance[keccak256("theater_mask")] = 100;
        maxIssuance[keccak256("tropical_mask")] = 100;
    }
}
