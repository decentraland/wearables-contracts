// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;


import "../markets/Donation.sol";

interface EventsInterface {
  event Issue(address indexed _beneficiary, uint256 indexed _tokenId, bytes32 indexed _wearableIdKey, string _wearableId, uint256 _issuedId);
}

contract DummyDonation is Donation, EventsInterface {

    constructor(
        address payable fundsRecipient,
        IERC721Collection _erc721Collection,
        uint256 _price,
        uint256 _maxNFTsPerCall
    )  Donation (
          fundsRecipient,
          _erc721Collection,
          _price,
          _maxNFTsPerCall
    ) public {}
}