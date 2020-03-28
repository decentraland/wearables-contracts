pragma solidity ^0.5.11;

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "./ERC721Collection.sol";

contract Donation is Ownable {
    ERC721Collection public erc721Collection;

    address payable public fundsRecipient;

    uint256 public maxOptions;
    uint256 public maxIssuance;
    uint256 public lastOptionIssued;

    uint256 public issued;

    event DonatedForNFT(address indexed _caller, uint256 indexed _value, uint256 indexed _optionId, string _wearable);
    event Donated(address indexed _caller, uint256 indexed _value);

    /**
     * @dev Constructor of the contract.
     * @param _fundsRecipient - Address of the recipient of the funds
     * @param _erc721Collection - Address of the collection
     * @param _rarity - issuance for each wearable based on its unique rarity
     */
    constructor(
        address payable _fundsRecipient,
        ERC721Collection _erc721Collection,
        uint256 _rarity
      )
      public {
        fundsRecipient = _fundsRecipient;
        erc721Collection = _erc721Collection;
        maxOptions = erc721Collection.wearablesCount();
        maxIssuance = maxOptions * _rarity;
    }

    /**
     * @dev Donate for the cause.
     */
    function donate() external payable {
        require(msg.value > 0, "The donation should be higher than 0");

        fundsRecipient.transfer(msg.value);

        emit Donated(msg.sender, msg.value);
    }

     /**
     * @dev Donate in exchange of a random NFT.
     */
    function donateForNFT() external payable {
        require(msg.value >= 0.025 ether, "The donation should be higher or equal than 0.025 ETH");
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