// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";

import "../interfaces/IERC20.sol";
import "../interfaces/IERC721Collection.sol";

contract BurningStore is Ownable {
    using SafeMath for uint256;

    struct CollectionData {
        mapping (uint256 => uint256) pricePerOptionId;
        mapping (uint256 => uint256) availableQtyPerOptionId;
    }

    IERC20 public acceptedToken;

    mapping (address => CollectionData) collectionsData;

    event Bought(address indexed _collectionAddress, uint256[] _optionIds, address _beneficiary, uint256 _price);
    event SetCollectionData(address indexed _collectionAddress, uint256[] _optionIds, uint256[] _availableQtys, uint256[] _prices);

    /**
    * @dev Constructor of the contract.
    * @param _acceptedToken - Address of the ERC20 token accepted
    * @param _collectionAddresses - collection addresses
    * @param _collectionOptionIds - collection option ids
    * @param _collectionAvailableQtys - collection available qtys for sale
    * @param _collectionPrices - collection prices
    */
    constructor(
        IERC20 _acceptedToken,
        address[] memory _collectionAddresses,
        uint256[][] memory _collectionOptionIds,
        uint256[][] memory _collectionAvailableQtys,
        uint256[][] memory _collectionPrices
      )
      public {
        acceptedToken = _acceptedToken;

        for (uint256 i = 0; i < _collectionAddresses.length; i++) {
            _setCollectionData(_collectionAddresses[i], _collectionOptionIds[i], _collectionAvailableQtys[i], _collectionPrices[i]);
        }
    }

    /**
    * @dev Donate in exchange for NFTs.
    * @notice that there is a maximum amount of NFTs that can be issued per call.
    * If the donation greater than `price * maxNFTsPerCall`, all the donation will be used and
    * a maximum of `maxNFTsPerCall` will be issued.
    * @param _collectionAddress - collectionn address
    * @param _optionIds - collection option id
    * @param _beneficiary - beneficiary address
    */
    function buy(address _collectionAddress, uint256[] calldata _optionIds, address _beneficiary) external {
        CollectionData storage collection = collectionsData[_collectionAddress];

        uint256 amount = _optionIds.length;
        uint256 finalPrice = 0;
        address[] memory beneficiaries = new address[](amount);
        bytes32[] memory items = new bytes32[](amount);

        for (uint256 i = 0; i < amount; i++) {
            uint256 optionId = _optionIds[i];
            require(collection.availableQtyPerOptionId[optionId] > 0, "Sold out item");

            // Add price
            uint256 itemPrice = collection.pricePerOptionId[optionId];
            finalPrice = finalPrice.add(itemPrice);

            // Add beneneficiary
            beneficiaries[i] = _beneficiary;

            // Add item
            string memory item = itemByOptionId(_collectionAddress, optionId);
            bytes32 itemAsBytes32;
            // solium-disable-next-line security/no-inline-assembly
            assembly {
                itemAsBytes32 := mload(add(item, 32))
            }
            items[i] = itemAsBytes32;
            collection.availableQtyPerOptionId[optionId] = collection.availableQtyPerOptionId[optionId].sub(1);
        }

        // Check if the sender has at least `price` and the contract has allowance to use on its behalf
        _requireBalance(msg.sender, finalPrice);

        // Debit `price` from sender
        require(
            acceptedToken.transferFrom(msg.sender, address(this), finalPrice),
            "Transfering finalPrice to this contract failed"
        );

        // Burn it
        acceptedToken.burn(finalPrice);

        // Mint NFT
        IERC721Collection(_collectionAddress).issueTokens(beneficiaries, items);

        emit Bought(_collectionAddress, _optionIds, _beneficiary, finalPrice);
    }

    /**
    * @dev Returns whether the wearable can be minted.
    * @param _collectionAddress - collectionn address
    * @param _optionId - item option id
    * @return whether a wearable can be minted
    */
    function canMint(address _collectionAddress, uint256 _optionId, uint256 _amount) public view returns (bool) {
        CollectionData storage collection = collectionsData[_collectionAddress];

        return collection.availableQtyPerOptionId[_optionId] >= _amount;
    }

    /**
     * @dev Returns a wearable's available supply .
     * Throws if the option ID does not exist. May return 0.
     * @param _collectionAddress - collectionn address
     * @param _optionId - item option id
     * @return wearable's available supply
     */
    function balanceOf(address _collectionAddress, uint256 _optionId) public view returns (uint256) {
        CollectionData storage collection = collectionsData[_collectionAddress];

        return collection.availableQtyPerOptionId[_optionId];
    }

    /**
    * @dev Get item id by option id
    * @param _collectionAddress - collectionn address
    * @param _optionId - collection option id
    * @return string of the item id
    */
    function itemByOptionId(address _collectionAddress, uint256 _optionId) public view returns (string memory) {
       /* solium-disable-next-line */
        (bool success, bytes memory data) = address(_collectionAddress).staticcall(
            abi.encodeWithSelector(
                IERC721Collection(_collectionAddress).wearables.selector,
                _optionId
            )
        );

        require(success, "Invalid wearable");

        return abi.decode(data, (string));
    }

    /**
    * @dev Get collection data by option id
    * @param _collectionAddress - collectionn address
    * @param _optionId - collection option id
    * @return availableQty - collection option id available qty
    * @return price - collection option id price
    */
    function collectionData(address _collectionAddress, uint256 _optionId) external view returns (
        uint256 availableQty, uint256 price
    ) {
        availableQty = collectionsData[_collectionAddress].availableQtyPerOptionId[_optionId];
        price = collectionsData[_collectionAddress].pricePerOptionId[_optionId];
    }

    /**
    * @dev Sets the beneficiary address where the sales amount
    *  will be transferred on each sale for a collection
    * @param _collectionAddress - collectionn address
    * @param _collectionOptionIds - collection option ids
    * @param _collectionAvailableQtys - collection available qtys for sale
    * @param _collectionPrices - collectionn prices
    */
    function setCollectionData(
        address _collectionAddress,
        uint256[] calldata _collectionOptionIds,
        uint256[] calldata _collectionAvailableQtys,
        uint256[] calldata _collectionPrices
    ) external onlyOwner {
        _setCollectionData(_collectionAddress, _collectionOptionIds, _collectionAvailableQtys, _collectionPrices);
    }

    /**
    * @dev Sets the beneficiary address where the sales amount
    *  will be transferred on each sale for a collection
    * @param _collectionAddress - collectionn address
    * @param _collectionOptionIds - collection option ids
    * @param _collectionAvailableQtys - collection available qtys for sale
    * @param _collectionPrices - collectionn prices
    */
    function _setCollectionData(
        address _collectionAddress,
        uint256[] memory _collectionOptionIds,
        uint256[] memory _collectionAvailableQtys,
        uint256[] memory _collectionPrices
    ) internal {
        // emit ChangedCollectionBeneficiary(_collectionAddress, collectionBeneficiaries[_collectionAddress], _beneficiary);
        CollectionData storage collection = collectionsData[_collectionAddress];

        for (uint256 i = 0; i < _collectionOptionIds.length; i++) {
            collection.availableQtyPerOptionId[_collectionOptionIds[i]] = _collectionAvailableQtys[i];
            collection.pricePerOptionId[_collectionOptionIds[i]] = _collectionPrices[i];
        }

        emit SetCollectionData(_collectionAddress, _collectionOptionIds, _collectionAvailableQtys, _collectionPrices);
    }

    /**
    * @dev Validate if a user has balance and the contract has enough allowance
    * to use user's accepted token on his belhalf
    * @param _user - address of the user
    */
    function _requireBalance(address _user, uint256 _price) internal view {
        require(
            acceptedToken.balanceOf(_user) >= _price,
            "Insufficient funds"
        );
        require(
            acceptedToken.allowance(_user, address(this)) >= _price,
            "The contract is not authorized to use the accepted token on sender behalf"
        );
    }
}
