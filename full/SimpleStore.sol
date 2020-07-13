
// File: @openzeppelin/contracts/ownership/Ownable.sol

pragma solidity ^0.5.0;

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be aplied to your functions to restrict their use to
 * the owner.
 */
contract Ownable {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    constructor () internal {
        _owner = msg.sender;
        emit OwnershipTransferred(address(0), _owner);
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(isOwner(), "Ownable: caller is not the owner");
        _;
    }

    /**
     * @dev Returns true if the caller is the current owner.
     */
    function isOwner() public view returns (bool) {
        return msg.sender == _owner;
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions anymore. Can only be called by the current owner.
     *
     * > Note: Renouncing ownership will leave the contract without an owner,
     * thereby removing any functionality that is only available to the owner.
     */
    function renounceOwnership() public onlyOwner {
        emit OwnershipTransferred(_owner, address(0));
        _owner = address(0);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public onlyOwner {
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     */
    function _transferOwnership(address newOwner) internal {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }
}

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

// File: contracts/interfaces/IERC20.sol

pragma solidity ^0.5.11;


contract IERC20 {
    function balanceOf(address from) public view returns (uint256);
    function transferFrom(address from, address to, uint tokens) public returns (bool);
    function transfer(address to, uint tokens) public returns (bool);
    function allowance(address owner, address spender) public view returns (uint256);
    function burn(uint256 amount) public;
}

// File: contracts/interfaces/IERC721Collection.sol

pragma solidity ^0.5.11;


interface IERC721Collection {
    function issueToken(address _beneficiary, string calldata _wearableId) external;
    function getWearableKey(string calldata _wearableId) external view returns (bytes32);
    function issued(bytes32 _wearableKey) external view returns (uint256);
    function maxIssuance(bytes32 _wearableKey) external view returns (uint256);
    function issueTokens(address[] calldata _beneficiaries, bytes32[] calldata _wearableIds) external;
    function owner() external view returns (address);
    function wearables(uint256 _index) external view returns (string memory);
}

// File: contracts/SimpleStore.sol

pragma solidity >=0.5.11;






contract SimpleStore is Ownable {
    using SafeMath for uint256;

    IERC20 public acceptedToken;
    uint256 public price;
    uint256 public ownerCutPerMillion;

    mapping (address => address) public collectionBeneficiaries;

    event Bought(address indexed _collectionAddress, uint256[] _optionIds, address _beneficiary, uint256 _price);
    event ChangedCollectionBeneficiary(address indexed _collectionAddress, address _oldBeneficiary, address _newBeneficiary);
    event ChangedOwnerCutPerMillion(uint256 _oldOwnerCutPerMillion, uint256 _newOwnerCutPerMillion);

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
            _setCollectionBeneficiary(_collectionAddresses[i], _collectionBeneficiaries[i]);
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
        _setCollectionBeneficiary(_collectionAddress,  _beneficiary);
    }

    /**
    * @dev Sets the share cut for the owner of the contract that's
    *  charged to the seller on a successful sale
    * @param _ownerCutPerMillion - Share amount, from 0 to 999,999
    */
    function setOwnerCutPerMillion(uint256 _ownerCutPerMillion) public onlyOwner {
        require(_ownerCutPerMillion < 1000000, "The owner cut should be between 0 and 999,999");

        emit ChangedOwnerCutPerMillion(ownerCutPerMillion, _ownerCutPerMillion);

        ownerCutPerMillion = _ownerCutPerMillion;
    }

    /**
    * @dev Sets the beneficiary address where the sales amount
    *  will be transferred on each sale for a collection
    * @param _collectionAddress - collectionn address
    * @param _beneficiary - beneficiary address
    */
    function _setCollectionBeneficiary(address _collectionAddress, address _beneficiary) internal {
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
