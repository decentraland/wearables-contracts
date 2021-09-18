// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../commons/OwnableInitializable.sol";
import "../commons/NativeMetaTransaction.sol";

contract Tiers is OwnableInitializable, NativeMetaTransaction {
    struct Tier {
        uint256 value;
        uint256 price;
    }

    Tier[] public tiers;

    event TierAdded(Tier _tier);
    event TierPriceUpdated(uint256 _tierIndex, uint256 _price);


   /**
    * @notice Create the contract
    * @param _owner - owner of the contract
    * @param _tiers - tiers
    */
    constructor(address _owner,  Tier[] memory _tiers) {
        // EIP712 init
        _initializeEIP712('Decentraland Tiers', '1');
        // Ownable init
        _initOwnable();
        transferOwnership(_owner);

        for (uint256 i = 0 ; i < _tiers.length; i++) {
            _addTier(_tiers[i]);
        }
    }

    /**
    * @notice Update tier prices
    * @param _indexes - index of the tiers to be updated
    * @param _prices - new prices
    */
    function updatePrices(uint256[] calldata _indexes, uint256[] calldata _prices) external onlyOwner {
        require(_indexes.length == _prices.length, "Tiers#updatePrices: LENGTH_MISMATCH");

        for (uint256 i = 0; i < _indexes.length; i++) {
            uint256 index = _indexes[i];
            uint256 price = _prices[i];

            Tier storage tier = tiers[index];
            require(tier.value > 0, "Tiers#updatePrices: INVALID_TIER");

            tiers[index].price = price;

            emit TierPriceUpdated(index, price);
        }
    }

    /**
    * @notice Add tiers
    * @param _tiers - tiers to be added
    */
    function addTiers(Tier[] memory _tiers) external onlyOwner {
        for (uint256 i = 0; i < _tiers.length; i++) {
            _addTier(_tiers[i]);
        }
    }

    /**
    * @notice Add tiers
    * @param _tier - tier to be added
    */
    function _addTier(Tier memory _tier) internal {
        require(_tier.value > 0, "Tiers#_addTier: INVALID_AMOUNT");

        tiers.push(_tier);

        emit TierAdded(_tier);
    }

    /**
     * @notice Returns the value of tiers
     * @return Amount of tiers
     */
    function tiersCount() external view returns (uint256) {
        return tiers.length;
    }
}
