
// File: @openzeppelin/contracts/GSN/Context.sol

// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

/*
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with GSN meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address payable) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes memory) {
        this; // silence state mutability warning without generating bytecode - see https://github.com/ethereum/solidity/issues/2691
        return msg.data;
    }
}

// File: @openzeppelin/contracts/access/Ownable.sol

// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * By default, the owner account will be the one that deploys the contract. This
 * can later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
contract Ownable is Context {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    constructor () internal {
        address msgSender = _msgSender();
        _owner = msgSender;
        emit OwnershipTransferred(address(0), msgSender);
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
        require(_owner == _msgSender(), "Ownable: caller is not the owner");
        _;
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions anymore. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby removing any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        emit OwnershipTransferred(_owner, address(0));
        _owner = address(0);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }
}

// File: @openzeppelin/contracts/math/SafeMath.sol

// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

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
     *
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
     *
     * - Subtraction cannot overflow.
     */
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return sub(a, b, "SafeMath: subtraction overflow");
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, reverting with custom message on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     *
     * - Subtraction cannot overflow.
     */
    function sub(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b <= a, errorMessage);
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
     *
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
     *
     * - The divisor cannot be zero.
     */
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        return div(a, b, "SafeMath: division by zero");
    }

    /**
     * @dev Returns the integer division of two unsigned integers. Reverts with custom message on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function div(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b > 0, errorMessage);
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
     *
     * - The divisor cannot be zero.
     */
    function mod(uint256 a, uint256 b) internal pure returns (uint256) {
        return mod(a, b, "SafeMath: modulo by zero");
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts with custom message when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function mod(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b != 0, errorMessage);
        return a % b;
    }
}

// File: contracts/interfaces/IERC20.sol

// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;


interface IERC20 {
    function balanceOf(address from) external view returns (uint256);
    function transferFrom(address from, address to, uint tokens) external returns (bool);
    function transfer(address to, uint tokens) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function burn(uint256 amount) external;
}

// File: contracts/interfaces/IERC721CollectionV2.sol

// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;


interface IERC721CollectionV2 {
    function issueToken(address _beneficiary, uint256 _itemId) external;
    function items(uint256 _itemId) external view returns (uint256, uint256, uint256, address, string memory, bytes32);
}

// File: contracts/markets/v2/CollectionStore.sol

// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;





contract CollectionStore is Ownable {
    using SafeMath for uint256;

    struct ItemToBuy {
        IERC721CollectionV2 collection;
        uint256[] ids;
        uint256[] prices;
    }

    IERC20 public acceptedToken;
    uint256 public fee;
    address public feeOwner;

    event Bought(ItemToBuy[] _itemsToBuy, address _beneficiary);
    event SetFee(uint256 _oldFee, uint256 _newFee);
    event SetFeeOwner(address indexed _oldFeeOwner, address indexed _newFeeOwner);

    /**
    * @notice Constructor of the contract.
    * @param _acceptedToken - Address of the ERC20 token accepted
    * @param _feeOwner - address where fees will be transferred
    * @param _fee - fee to charge for each sale
    */
    constructor(IERC20 _acceptedToken, address _feeOwner, uint256 _fee) public {
        acceptedToken = _acceptedToken;
        feeOwner = _feeOwner;
        setFee(_fee);
    }

    /**
    * @notice Buy collection's items.
    * @dev There is a maximum amount of NFTs that can be issued per call by the block's limit.
    * @param _itemsToBuy - items to buy
    * @param _beneficiary - beneficiary address
    */
    function buy(ItemToBuy[] memory _itemsToBuy, address _beneficiary) external {
        uint256 totalFee = 0;
        for (uint256 i = 0; i < _itemsToBuy.length; i++) {
            ItemToBuy memory itemToBuy = _itemsToBuy[i];
            IERC721CollectionV2 collection = itemToBuy.collection;
            uint256 amountOfItems = itemToBuy.ids.length;

            require(amountOfItems == itemToBuy.prices.length, "CollectionStore#buy: LENGTH_MISMATCH");

            for (uint256 j = 0; j < amountOfItems; j++) {
                uint256 itemId = itemToBuy.ids[j];
                uint256 price = itemToBuy.prices[j];

                (uint256 itemPrice, address itemBeneficiary) = getItemBuyData(collection, itemId);
                require(price == itemPrice, "CollectionStore#buy: ITEM_PRICE_MISMATCH");

                if (itemPrice > 0) {
                    // Calculate sale share
                    uint256 saleShareAmount = itemPrice.mul(fee).div(1000000);
                    totalFee = totalFee.add(saleShareAmount);

                    // Transfer sale amount to the item beneficiary
                    require(
                        acceptedToken.transferFrom(msg.sender, itemBeneficiary, itemPrice.sub(saleShareAmount)),
                        "CollectionStore#buy: TRANSFER_PRICE_FAILED"
                    );
                }

                // Mint Token
                collection.issueToken(_beneficiary, itemId);
            }
        }

        if (totalFee > 0) {
            // Transfer share amount for fees owner
            require(
                acceptedToken.transferFrom(msg.sender, feeOwner, totalFee),
                "CollectionStore#buy: TRANSFER_FEES_FAILED"
            );
        }
        emit Bought(_itemsToBuy, _beneficiary);
    }

    /**
     * @notice Get item's price and beneficiary
     * @param _collection - collection address
     * @param _itemId - item id
     * @return uint256 of the item's price
     * @return address of the item's beneficiary
     */
    function getItemBuyData(IERC721CollectionV2 _collection, uint256 _itemId) public view returns (uint256, address) {
      (,,uint256 price, address beneficiary,,) = _collection.items(_itemId);
       return (price, beneficiary);
    }

    // Owner functions

    /**
     * @notice Sets the fee of the contract that's charged to the seller on each sale
     * @param _newFee - Fee from 0 to 999,999
     */
    function setFee(uint256 _newFee) public onlyOwner {
        require(_newFee < 1000000, "CollectionStore#setFee: FEE_SHOULD_BE_LOWER_THAN_1000000");
        require(_newFee != fee, "CollectionStore#setFee: SAME_FEE");

        emit SetFee(fee, _newFee);
        fee = _newFee;
    }

    /**
     * @notice Set a new fee owner.
    * @param _newFeeOwner - Address of the new fee owner
     */
    function setFeeOwner(address _newFeeOwner) external onlyOwner {
        require(_newFeeOwner != address(0), "CollectionStore#setFeeOwner: INVALID_ADDRESS");
        require(_newFeeOwner != feeOwner, "CollectionStore#setFeeOwner: SAME_FEE_OWNER");

        emit SetFeeOwner(feeOwner, _newFeeOwner);
        feeOwner = _newFeeOwner;
    }
}
