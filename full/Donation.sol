
// File: contracts/Donation.sol

pragma solidity ^0.5.11;

interface ERC721Collection {
    function wearables(uint256 _index) external view returns (string memory);
    function issueToken(address _beneficiary, string calldata _wearableId) external;
    function wearablesCount() external view returns (uint256);
}

contract Donation {
    ERC721Collection public erc721Collection;

    address payable public fundsRecipient;

    uint256 public maxOptions;
    uint256 public maxIssuance;
    uint256 public lastOptionIssued;
    uint256 public issued;
    uint256 public minDonation;
    uint256 public donations;

    event DonatedForNFT(address indexed _caller, uint256 indexed _value, uint256 indexed _optionId, string _wearable);
    event Donated(address indexed _caller, uint256 indexed _value);

    /**
     * @dev Constructor of the contract.
     * @param _fundsRecipient - Address of the recipient of the funds
     * @param _erc721Collection - Address of the collection
     * @param _minDonation - minimum acceptable donation in WEI in exchange for an NFT (1e18 = 1eth)
     * @param _rarity - issuance for each wearable based on its unique rarity
     */
    constructor(
        address payable _fundsRecipient,
        ERC721Collection _erc721Collection,
        uint256 _minDonation,
        uint256 _rarity
      )
      public {
        fundsRecipient = _fundsRecipient;
        erc721Collection = _erc721Collection;
        minDonation = _minDonation;
        maxOptions = erc721Collection.wearablesCount();
        maxIssuance = maxOptions * _rarity;
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
     */
    function donateForNFT() external payable {
        require(msg.value >= minDonation, "The donation should be higher or equal than the minimum donation ETH");
        require(issued < maxIssuance, "All wearables have been minted");

        uint256 optionToMint;
        if (lastOptionIssued == 0 && issued == 0) {
            optionToMint = 0;
        } else {
            optionToMint = (++lastOptionIssued % maxOptions);
        }

        string memory wearable = _wearableByOptionId(optionToMint);
        erc721Collection.issueToken(msg.sender, wearable);

        issued++;

        fundsRecipient.transfer(msg.value);

        donations += msg.value;

        emit DonatedForNFT(msg.sender, msg.value, optionToMint, wearable);
    }

    /**
     * @dev Get a wearable string by its optionId
     * @param _optionId - Option id
     * @return wearable name
     */
    function _wearableByOptionId(uint256 _optionId) internal view returns (string memory){
       /* solium-disable-next-line */
        (bool success, bytes memory data) = address(erc721Collection).staticcall(
            abi.encodeWithSelector(
                erc721Collection.wearables.selector,
                _optionId
            )
        );

        require(success, "Invalid wearable");
        return abi.decode(data, (string));
    }
}
