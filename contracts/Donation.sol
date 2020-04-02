pragma solidity ^0.5.11;

import "@openzeppelin/contracts/math/SafeMath.sol";


interface ERC721Collection {
    function issueToken(address _beneficiary, string calldata _wearableId) external;
    function getWearableKey(string calldata _wearableId) external view returns (bytes32);
    function issued(bytes32 _wearableKey) external view returns (uint256);
    function maxIssuance(bytes32 _wearableKey) external view returns (uint256);
}

contract Donation {
    using SafeMath for uint256;

    ERC721Collection public erc721Collection;

    address payable public fundsRecipient;

    uint256 public minDonation;
    uint256 public donations;

    event DonatedForNFT(address indexed _caller, uint256 indexed _value, string _wearable);
    event Donated(address indexed _caller, uint256 indexed _value);

    /**
     * @dev Constructor of the contract.
     * @param _fundsRecipient - Address of the recipient of the funds
     * @param _erc721Collection - Address of the collection
     * @param _minDonation - minimum acceptable donation in WEI in exchange for an NFT (1e18 = 1eth)
     */
    constructor(
        address payable _fundsRecipient,
        ERC721Collection _erc721Collection,
        uint256 _minDonation
      )
      public {
        fundsRecipient = _fundsRecipient;
        erc721Collection = _erc721Collection;
        minDonation = _minDonation;
    }

    /**
     * @dev Donate for the cause.
     */
    function donate() external payable {
        require(msg.value > 0, "The donation should be higher than 0");

        fundsRecipient.transfer(msg.value);

        donations += msg.value;

        emit Donated(msg.sender, msg.value);
    }

     /**
     * @dev Donate in exchange for a random NFT.
     * @param _wearableId - wearable id
     */
    function donateForNFT(string calldata _wearableId) external payable {
        require(msg.value >= minDonation, "The donation should be higher or equal than the minimum donation ETH");
        require(canMint(_wearableId), "Exhausted wearable");

        fundsRecipient.transfer(msg.value);

        donations += msg.value;

        erc721Collection.issueToken(msg.sender, _wearableId);

        emit DonatedForNFT(msg.sender, msg.value, _wearableId);
    }

    /**
    * @dev Returns whether the wearable can be minted.
    * @param _wearableId - wearable id
    * @return whether a wearable can be minted
    */
    function canMint(string memory _wearableId) public view returns (bool) {
        return balanceOf(_wearableId) > 0;
    }

    /**
     * @dev Returns the balance.
     * Throws if the option ID does not exist. May return an empty string.
     * @param _wearableId - wearable id
     * @return token URI
     */
    function balanceOf(string memory _wearableId) public view returns (uint256) {
        bytes32 wearableKey = erc721Collection.getWearableKey(_wearableId);

        uint256 issued = erc721Collection.issued(wearableKey);
        uint256 maxIssuance = erc721Collection.maxIssuance(wearableKey);
        return maxIssuance.sub(issued);
    }
}
