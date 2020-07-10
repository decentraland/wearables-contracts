pragma solidity >=0.5.11;

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";

import "./interfaces/IERC20.sol";
import "./interfaces/IERC721Collection.sol";

contract SimpleStore is Ownable {
    using SafeMath for uint256;

    IERC20 public acceptedToken;
    uint256 public price;
    uint256 public ownerCutPerMillion;

    mapping (address => address) public collectionBeneficiaries;


    event Bought(address indexed _collectionAddress, uint256[] _optionIds, address _beneficiary, uint256 _price);
    event ChangedCollectionBeneficiary(address indexed _collectionAddress, address _oldBeneficiary, address _newBeneficiary);
    event ChangedOwnerCutPerMillion(uint256 ownerCutPerMillion);

    /**
     * @dev Constructor of the contract.
     * @param _acceptedToken - Address of the ERC20 token accepted
     * @param _price - price in MANA (WEI) in exchange for an NFT
     * @param _ownerCutPerMillion - Share amount, from 0 to 999,999
     * @param _collectionAddresses - collectionn addresses
     * @param _collectionBeneficiaries - collectionn beneficiaries
     */
    constructor(
        IERC20 _acceptedToken,
        uint256 _price,
        uint256 _ownerCutPerMillion,
        address[] memory _collectionAddresses,
        address[] memory _collectionBeneficiaries
      )
      public {
        acceptedToken = _acceptedToken;
        price = _price;
        ownerCutPerMillion = _ownerCutPerMillion;

        for (uint256 i = 0; i < _collectionAddresses.length; i++) {
            _setCollectionnBeneficiary(_collectionAddresses[i], _collectionBeneficiaries[i]);
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
        // Check that the collection has a beneficiary
        address collectionBeneficiary = collectionBeneficiaries[_collectionAddress];
        require(
            collectionBeneficiary != address(0),
            "The collection does not have a beneficiary"
        );

        uint256 amount = _optionIds.length;
        uint256 finalPrice = 0;
        address[] memory beneficiaries = new address[](amount);
        bytes32[] memory items = new bytes32[](amount);

        for (uint256 i = 0; i < amount; i++) {
            // Add price
            finalPrice = finalPrice.add(price);

            // Add beneneficiary
            beneficiaries[i] = _beneficiary;

            // Add item
            string memory item = itemByOptionId(_collectionAddress, _optionIds[i]);
            bytes32 itemAsBytes32;
            // solium-disable-next-line security/no-inline-assembly
            assembly {
                itemAsBytes32 := mload(add(item, 32))
            }
            items[i] = itemAsBytes32;
        }


        // Check if the sender has at least `price` and the contract has allowance to use on its behalf
        _requireBalance(msg.sender, finalPrice);

        // Debit `price` from sender
        require(
            acceptedToken.transferFrom(msg.sender, address(this), finalPrice),
            "Transfering finalPrice to this contract failed"
        );

        uint256 fees = 0;

        if (ownerCutPerMillion > 0) {
            // Calculate fees
            fees = finalPrice.mul(ownerCutPerMillion).div(1000000);

            // Burn it
            acceptedToken.burn(fees);
        }

        // Transfer sale amount to collectionBeneficiary
        require(
            acceptedToken.transfer(collectionBeneficiary, finalPrice.sub(fees)),
            "Transfering the sale amount to the collection beneficiary failed"
        );

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
        uint256 balance = balanceOf(_collectionAddress, _optionId);

        return balance >= _amount;
    }

    /**
     * @dev Returns a wearable's available supply .
     * Throws if the option ID does not exist. May return 0.
     * @param _collectionAddress - collectionn address
     * @param _optionId - item option id
     * @return wearable's available supply
     */
    function balanceOf(address _collectionAddress, uint256 _optionId) public view returns (uint256) {
        IERC721Collection collection = IERC721Collection(_collectionAddress);
        bytes32 wearableKey = collection.getWearableKey(itemByOptionId(_collectionAddress, _optionId));

        uint256 issued = collection.issued(wearableKey);
        uint256 maxIssuance = collection.maxIssuance(wearableKey);

        return maxIssuance.sub(issued);
    }

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
    * @dev Sets the beneficiary address where the sales amount
    *  will be transferred on each sale for a collection
    * @param _collectionAddress - collectionn address
    * @param _beneficiary - beneficiary address
    */
    function setCollectionBeneficiary(address _collectionAddress, address _beneficiary) external onlyOwner {
        _setCollectionnBeneficiary(_collectionAddress,  _beneficiary);
    }

    /**
    * @dev Sets the share cut for the owner of the contract that's
    *  charged to the seller on a successful sale
    * @param _ownerCutPerMillion - Share amount, from 0 to 999,999
    */
    function setOwnerCutPerMillion(uint256 _ownerCutPerMillion) public onlyOwner {
        require(_ownerCutPerMillion < 1000000, "The owner cut should be between 0 and 999,999");

        ownerCutPerMillion = _ownerCutPerMillion;
        emit ChangedOwnerCutPerMillion(ownerCutPerMillion);
    }

    /**
    * @dev Sets the beneficiary address where the sales amount
    *  will be transferred on each sale for a collection
    * @param _collectionAddress - collectionn address
    * @param _beneficiary - beneficiary address
    */
    function _setCollectionnBeneficiary(address _collectionAddress, address _beneficiary) internal {
        emit ChangedCollectionBeneficiary(_collectionAddress, collectionBeneficiaries[_collectionAddress], _beneficiary);

        collectionBeneficiaries[_collectionAddress] = _beneficiary;
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
