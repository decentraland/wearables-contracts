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

    event AddRarity(string _name, uint256 _maxSupply, uint256 _price);
    event UpdateRarity(string _name, uint256 _price);


   /**
    * @notice Create the contract
    * @param _owner - owner of the contract
    */
    constructor(address _owner, uint256 _initialPrice) public {
        // EIP712 init
        _initializeEIP712('Decentraland Rarities', '1');
        // Ownable init
        _initOwnable();
        transferOwnership(_owner);


        _addRarity("common", 100000, _initialPrice);
        _addRarity("uncommon", 10000, _initialPrice);
        _addRarity("rare", 5000, _initialPrice);
        _addRarity("epic", 1000, _initialPrice);
        _addRarity("legendary", 100, _initialPrice);
        _addRarity("mythic", 10, _initialPrice);
        _addRarity("unique", 1, _initialPrice);
    }

    function updatePrice(string[] calldata _rarities, uint256[] calldata _prices) external onlyOwner {
        for (uint256 i = 0; i < _rarities.length; i++) {
            string memory rarity = _rarities[i];
            uint256 price = _prices[i];
            bytes32 rarityKey = keccak256(bytes(rarity));
            uint256 index = rarityIndex[rarityKey];

            require(rarityIndex[rarityKey] > 0, "Rarities#addRarity: INVALID_RARITY");

            rarities[index - 1].price = price;

            emit UpdateRarity(rarity, price);
        }
    }

    function addRarity(string[] calldata _rarities, uint256[] calldata _maxSupplies, uint256[] calldata _prices) external onlyOwner {
        for (uint256 i = 0; i < _rarities.length; i++) {
            _addRarity(_rarities[i].toLowerCase(), _maxSupplies[i], _prices[i]);
        }
    }

    function _addRarity(string memory _rarity, uint256 _maxSupply, uint256 _price) internal {
        uint256 rarityLength = bytes(_rarity).length;
        require(rarityLength > 0 && rarityLength <= 32, "Rarities#_addRarity: INVALID_LENGTH");

        bytes32 rarityKey = keccak256(bytes(_rarity));
        require(rarityIndex[rarityKey] == 0, "Rarities#_addRarity: RARITY_ALREADY_ADDED");

        rarities.push(Rarity ({ name: _rarity, maxSupply: _maxSupply, price: _price }));

        rarityIndex[rarityKey] = rarities.length;

        emit AddRarity(_rarity, _maxSupply, _price);
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
        bytes32 rarityKey = keccak256(bytes(_rarity));

        uint256 index = rarityIndex[rarityKey];

        require(rarityIndex[rarityKey] > 0, "Rarities#getRarityByName: INVALID_RARITY");

        return rarities[index - 1];
    }
}
