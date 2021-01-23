// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/ICollectionManager.sol";
import "../commons/OwnableInitializable.sol";
import "../commons/NativeMetaTransaction.sol";
import "../libs/String.sol";

contract Rarities is OwnableInitializable, NativeMetaTransaction {
    using String for string;

    struct Rarity {
        string name;
        uint256 maxSupply;
        uint256 price;
    }

    Rarity[] public rarities;

    /// @dev indexes will start in 1
    mapping(bytes32 => uint256) rarityIndex;

    event AddRarity(Rarity _rarity);
    event UpdatePrice(string _name, uint256 _price);


   /**
    * @notice Create the contract
    * @param _owner - owner of the contract
    */
    constructor(address _owner,  Rarity[] memory _rarities) public {
        // EIP712 init
        _initializeEIP712('Decentraland Rarities', '1');
        // Ownable init
        _initOwnable();
        transferOwnership(_owner);

        for (uint256 i = 0 ; i < _rarities.length; i++) {
            _addRarity(_rarities[i]);
        }
    }

    function updatePrices(string[] calldata _names, uint256[] calldata _prices) external onlyOwner {
        require(_names.length == _prices.length, "Rarities#updatePrices: LENGTH_MISMATCH");

        for (uint256 i = 0; i < _names.length; i++) {
            string memory name = _names[i];
            uint256 price = _prices[i];
            bytes32 rarityKey = keccak256(bytes(name.toLowerCase()));
            uint256 index = rarityIndex[rarityKey];

            require(rarityIndex[rarityKey] > 0, "Rarities#updatePrices: INVALID_RARITY");

            rarities[index - 1].price = price;

            emit UpdatePrice(name, price);
        }
    }

    function addRarities(Rarity[] memory _rarities) external onlyOwner {
        for (uint256 i = 0; i < _rarities.length; i++) {
            _addRarity(_rarities[i]);
        }
    }

    function _addRarity(Rarity memory _rarity) internal {
        uint256 rarityLength = bytes(_rarity.name).length;
        require(rarityLength > 0 && rarityLength <= 32, "Rarities#_addRarity: INVALID_LENGTH");

        bytes32 rarityKey = keccak256(bytes(_rarity.name.toLowerCase()));
        require(rarityIndex[rarityKey] == 0, "Rarities#_addRarity: RARITY_ALREADY_ADDED");

        rarities.push(_rarity);

        rarityIndex[rarityKey] = rarities.length;

        emit AddRarity(_rarity);
    }

    /**
     * @notice Returns the amount of item in the collection
     * @return Amount of items in the collection
     */
    function raritiesCount() external view returns (uint256) {
        return rarities.length;
    }

    /**
     * @notice Returns a rarity
     * @dev will revert if the rarity is out of bounds
     * @return rarity for the given index
     */
    function getRarityByName(string memory _rarity) public view returns (Rarity memory) {
        bytes32 rarityKey = keccak256(bytes(_rarity.toLowerCase()));

        uint256 index = rarityIndex[rarityKey];

        require(rarityIndex[rarityKey] > 0, "Rarities#getRarityByName: INVALID_RARITY");

        return rarities[index - 1];
    }
}
