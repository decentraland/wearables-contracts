pragma solidity ^0.5.11;


import "../../contracts/SimpleStore.sol";

interface EventsInterface {
    event Issue(address indexed _beneficiary, uint256 indexed _tokenId, bytes32 indexed _wearableIdKey, string _wearableId, uint256 _issuedId);
    event Burn(address indexed burner, uint256 value);
}

contract DummySimpleStore is SimpleStore, EventsInterface {

    constructor(
        IERC20 _acceptedToken,
        uint256 _price,
        uint256 _ownerCutPerMillion,
        address[] memory _collectionAddresses,
        address[] memory _collectionBeneficiaries
    )  SimpleStore (
        _acceptedToken,
        _price,
        _ownerCutPerMillion,
        _collectionAddresses,
        _collectionBeneficiaries
    ) public {}
}