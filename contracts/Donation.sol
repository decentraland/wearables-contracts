pragma solidity ^0.5.11;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";



interface ERC721Collection {
    function issueToken(address _beneficiary, string calldata _wearableId) external;
    function getWearableKey(string calldata _wearableId) external view returns (bytes32);
    function issued(bytes32 _wearableKey) external view returns (uint256);
    function maxIssuance(bytes32 _wearableKey) external view returns (uint256);
    function issueTokens(address[] calldata _beneficiaries, bytes32[] calldata _wearableIds) external;
}

contract Donation {
    using SafeMath for uint256;

    ERC721Collection public erc721Collection;

    address payable public fundsRecipient;

    uint256 public price;
    uint256 public maxNFTsPerTx;
    uint256 public donations;

    event DonatedForNFT(
        address indexed _caller,
        uint256 indexed _value,
        uint256 _issued,
        string _wearable
    );

    event Donated(address indexed _caller, uint256 indexed _value);

    /**
     * @dev Constructor of the contract.
     * @param _fundsRecipient - Address of the recipient of the funds
     * @param _erc721Collection - Address of the collection
     * @param _price - minimum acceptable donation in WEI in exchange for an NFT (1e18 = 1eth)
     * @param _maxNFTsPerTx - maximum of NFTs issued per transaction
     */
    constructor(
        address payable _fundsRecipient,
        ERC721Collection _erc721Collection,
        uint256 _price,
        uint256 _maxNFTsPerTx
      )
      public {
        fundsRecipient = _fundsRecipient;
        erc721Collection = _erc721Collection;
        price = _price;
        maxNFTsPerTx = _maxNFTsPerTx;
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
        uint256 NFTsToIssued = Math.min(msg.value / price, maxNFTsPerTx);

        require(NFTsToIssued > 0, "The donation should be higher or equal than the price");
        require(
            canMint(_wearableId, NFTsToIssued),
            "The amount of wearables to issue is higher than its available supply"
        );

        fundsRecipient.transfer(msg.value);

        donations += msg.value;

        for (uint256 i = 0; i < NFTsToIssued; i++) {
            erc721Collection.issueToken(msg.sender, _wearableId);
        }

        emit DonatedForNFT(msg.sender, msg.value, NFTsToIssued, _wearableId);
    }

    /**
    * @dev Returns whether the wearable can be minted.
    * @param _wearableId - wearable id
    * @return whether a wearable can be minted
    */
    function canMint(string memory _wearableId, uint256 _amount) public view returns (bool) {
        uint256 balance = balanceOf(_wearableId);

        return balance >= _amount ? true : false;
    }

    /**
     * @dev Returns a wearable's available supply .
     * Throws if the option ID does not exist. May return 0.
     * @param _wearableId - wearable id
     * @return wearable's available supply
     */
    function balanceOf(string memory _wearableId) public view returns (uint256) {
        bytes32 wearableKey = erc721Collection.getWearableKey(_wearableId);

        uint256 issued = erc721Collection.issued(wearableKey);
        uint256 maxIssuance = erc721Collection.maxIssuance(wearableKey);

        return maxIssuance.sub(issued);
    }
}
