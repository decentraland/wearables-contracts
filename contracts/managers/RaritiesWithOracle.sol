// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";

import '../interfaces/ICollectionManager.sol';
import '../interfaces/IOracle.sol';
import '../commons/OwnableInitializable.sol';
import '../commons/NativeMetaTransaction.sol';
import '../libs/String.sol';

contract RaritiesWithOracle is OwnableInitializable, NativeMetaTransaction {
    using String for string;
    using SafeMath for uint256;

    struct Rarity {
        string name;
        uint256 maxSupply;
        uint256 price;
    }

    Rarity[] public rarities;

    /// @dev indexes will start in 1
    mapping(bytes32 => uint256) rarityIndex;

    IOracle public oracle;

    event AddRarity(Rarity _rarity);
    event UpdatePrice(string _name, uint256 _price);
    event OracleSet(IOracle indexed _oldOracle, IOracle indexed _newOracle);

    /**
     * @notice Create the contract
     * @dev Rarity price is the price of a rarity in the rate returned by the oracle.
     *      For example if the oracle returns the rate of USD by MANA, then the price of the rarity
     *      has to be in USD
     * @param _owner - owner of the contract
     */
    constructor(
        address _owner,
        Rarity[] memory _rarities,
        IOracle _oracle
    ) {
        // EIP712 init
        _initializeEIP712('Decentraland Rarities', '1');
        // Ownable init
        _initOwnable();
        setOracle(_oracle);
        transferOwnership(_owner);

        for (uint256 i = 0; i < _rarities.length; i++) {
            _addRarity(_rarities[i]);
        }
    }

    /**
     * @notice Set the oracle
     * @param _newOracle - oracle contract
     */
    function setOracle(IOracle _newOracle) public onlyOwner {
        require(
            address(_newOracle) != address(0),
            'Rarities#setOracle: INVALID_ORACLE'
        );

        emit OracleSet(oracle, _newOracle);
        oracle = _newOracle;
    }

    function updatePrices(string[] calldata _names, uint256[] calldata _prices)
        external
        onlyOwner
    {
        require(
            _names.length == _prices.length,
            'Rarities#updatePrices: LENGTH_MISMATCH'
        );

        for (uint256 i = 0; i < _names.length; i++) {
            string memory name = _names[i];
            uint256 price = _prices[i];
            bytes32 rarityKey = keccak256(bytes(name.toLowerCase()));
            uint256 index = rarityIndex[rarityKey];

            require(
                rarityIndex[rarityKey] > 0,
                'Rarities#updatePrices: INVALID_RARITY'
            );

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
        require(
            rarityLength > 0 && rarityLength <= 32,
            'Rarities#_addRarity: INVALID_LENGTH'
        );

        bytes32 rarityKey = keccak256(bytes(_rarity.name.toLowerCase()));
        require(
            rarityIndex[rarityKey] == 0,
            'Rarities#_addRarity: RARITY_ALREADY_ADDED'
        );

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
     * @notice Returns a rarity with the price updated to reflect its price
     *         in the expected token. For example, the price is set in USD 
     *         but it has to be paid in MANA so the price will be returned 
     *         rated in MANA instead.
     * @dev will revert if the rarity is out of bounds
     * @return rarity for the given index
     */
    function getRarityByName(string memory _rarity)
        public
        view
        returns (Rarity memory)
    {
        bytes32 rarityKey = keccak256(bytes(_rarity.toLowerCase()));

        uint256 index = rarityIndex[rarityKey];

        require(
            rarityIndex[rarityKey] > 0,
            'Rarities#getRarityByName: INVALID_RARITY'
        );

        Rarity memory rarity = rarities[index - 1];

        uint256 originalPrice = rarity.price;
        uint256 rate = _getRateFromOracle();
        uint256 finalPrice = originalPrice.mul(1 ether).div(rate);

        rarity.price = finalPrice;

        return rarity;
    }

    /**
    * @dev Safely call Oracle.getRate
    * @return Rate
    */
    function _getRateFromOracle() internal view returns(uint256) {
        /* solium-disable-next-line */
        (bool success, bytes memory data) = address(oracle).staticcall(
            abi.encodeWithSelector(oracle.getRate.selector)
        );

        require(success, "Rarities#_getRateFromOracle: INVALID_RATE_FROM_ORACLE");

        return abi.decode(data, (uint256));
    }
}
