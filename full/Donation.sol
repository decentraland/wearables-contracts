
// File: @openzeppelin/contracts/math/SafeMath.sol

pragma solidity ^0.5.0;

/**
 * @dev Wrappers over Solidity's arithmetic operations with added overflow
 * checks.
 *
 * Arithmetic operations in Solidity wrap on overflow. This can easily result
 * in bugs, because programmers usually assume that an overflow raises an
 * error, which is the standard behavior in high level programming languages.
 * `SafeMath` restores this intuition by reverting the transaction when an
 * operation overflows.
 *
 * Using this library instead of the unchecked operations eliminates an entire
 * class of bugs, so it's recommended to use it always.
 */
library SafeMath {
    /**
     * @dev Returns the addition of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `+` operator.
     *
     * Requirements:
     * - Addition cannot overflow.
     */
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");

        return c;
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, reverting on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     * - Subtraction cannot overflow.
     */
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b <= a, "SafeMath: subtraction overflow");
        uint256 c = a - b;

        return c;
    }

    /**
     * @dev Returns the multiplication of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `*` operator.
     *
     * Requirements:
     * - Multiplication cannot overflow.
     */
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
        // benefit is lost if 'b' is also tested.
        // See: https://github.com/OpenZeppelin/openzeppelin-contracts/pull/522
        if (a == 0) {
            return 0;
        }

        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");

        return c;
    }

    /**
     * @dev Returns the integer division of two unsigned integers. Reverts on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     * - The divisor cannot be zero.
     */
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        // Solidity only automatically asserts when dividing by 0
        require(b > 0, "SafeMath: division by zero");
        uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold

        return c;
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     * - The divisor cannot be zero.
     */
    function mod(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b != 0, "SafeMath: modulo by zero");
        return a % b;
    }
}

// File: @openzeppelin/contracts/math/Math.sol

pragma solidity ^0.5.0;

/**
 * @dev Standard math utilities missing in the Solidity language.
 */
library Math {
    /**
     * @dev Returns the largest of two numbers.
     */
    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a >= b ? a : b;
    }

    /**
     * @dev Returns the smallest of two numbers.
     */
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    /**
     * @dev Returns the average of two numbers. The result is rounded towards
     * zero.
     */
    function average(uint256 a, uint256 b) internal pure returns (uint256) {
        // (a + b) / 2 can overflow, so we distribute
        return (a / 2) + (b / 2) + ((a % 2 + b % 2) / 2);
    }
}

// File: contracts/Donation.sol

pragma solidity ^0.5.11;





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
    uint256 public maxNFTsPerCall;
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
     * @param _maxNFTsPerCall - maximum of NFTs issued per transaction
     */
    constructor(
        address payable _fundsRecipient,
        ERC721Collection _erc721Collection,
        uint256 _price,
        uint256 _maxNFTsPerCall
      )
      public {
        fundsRecipient = _fundsRecipient;
        erc721Collection = _erc721Collection;
        price = _price;
        maxNFTsPerCall = _maxNFTsPerCall;
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
     * @notice that there is a maximum amount of NFTs that can be issued per transaction.
     * If the donation greater than `price * maxNFTsPerCall`, all the donation will be used and
     * a maximum of `maxNFTsPerCall` will be issued.
     * @param _wearableId - wearable id
     */
    function donateForNFT(string calldata _wearableId) external payable {
        uint256 NFTsToIssued = Math.min(msg.value / price, maxNFTsPerCall);

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

        return balance >= _amount;
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
