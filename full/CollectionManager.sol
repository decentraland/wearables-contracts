// Sources flattened with hardhat v2.0.8 https://hardhat.org

// File contracts/interfaces/IForwarder.sol

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;


interface IForwarder {
   function forwardCall(address _address, bytes calldata _data) external returns (bool, bytes memory);
}


// File contracts/interfaces/IERC20.sol

// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;


interface IERC20 {
    function balanceOf(address from) external view returns (uint256);
    function transferFrom(address from, address to, uint tokens) external returns (bool);
    function transfer(address to, uint tokens) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function burn(uint256 amount) external;
}


// File contracts/interfaces/IERC721CollectionV2.sol

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;


interface IERC721CollectionV2 {
    function COLLECTION_HASH() external view returns (bytes32);

    struct ItemParam {
        string rarity;
        uint256 price;
        address beneficiary;
        string metadata;
    }

    function issueTokens(address[] calldata _beneficiaries, uint256[] calldata _itemIds) external;
    function setApproved(bool _value) external;
    /// @dev For some reason using the Struct Item as an output parameter fails, but works as an input parameter
    function initialize(
        string memory _name,
        string memory _symbol,
        string memory _baseURI,
        address _creator,
        bool _shouldComplete,
        bool _isApproved,
        address _rarities,
        ItemParam[] memory _items
    ) external;
    function items(uint256 _itemId) external view returns (string memory, uint256, uint256, uint256, address, string memory, bytes32);
}


// File contracts/interfaces/IERC721CollectionFactoryV2.sol

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;


interface IERC721CollectionFactoryV2 {
   function createCollection(bytes32 _salt, bytes memory _data) external returns (address addr);
    function transferOwnership(address newOwner) external;
}


// File contracts/interfaces/IRarities.sol

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;


interface IRarities {

    struct Rarity {
        string name;
        uint256 maxSupply;
        uint256 price;
    }

    function getRarityByName(string calldata rarity) external view returns (Rarity memory);
}


// File contracts/commons/ContextMixin.sol

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;


abstract contract ContextMixin {
    function _msgSender()
        internal
        view
        virtual
        returns (address payable sender)
    {
        if (msg.sender == address(this)) {
            bytes memory array = msg.data;
            uint256 index = msg.data.length;
            assembly {
                // Load the 32 bytes word from memory with the address on the lower 20 bytes, and mask those.
                sender := and(
                    mload(add(array, index)),
                    0xffffffffffffffffffffffffffffffffffffffff
                )
            }
        } else {
            sender = payable(msg.sender);
        }
        return sender;
    }
}


// File contracts/commons/OwnableInitializable.sol

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

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
abstract contract OwnableInitializable is ContextMixin {
    address internal _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);


    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    function _initOwnable () internal {
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


// File contracts/commons/EIP712Base.sol

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;


contract EIP712Base {
    struct EIP712Domain {
        string name;
        string version;
        address verifyingContract;
        bytes32 salt;
    }

    bytes32 internal constant EIP712_DOMAIN_TYPEHASH = keccak256(
        bytes(
            "EIP712Domain(string name,string version,address verifyingContract,bytes32 salt)"
        )
    );
    bytes32 public domainSeparator;

    // supposed to be called once while initializing.
    // one of the contractsa that inherits this contract follows proxy pattern
    // so it is not possible to do this in a constructor
    function _initializeEIP712(
        string memory name,
        string memory version
    )
        internal
    {
        domainSeparator = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                address(this),
                bytes32(getChainId())
            )
        );
    }

    function getChainId() public view returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }

    /**
     * Accept message hash and returns hash message in EIP712 compatible form
     * So that it can be used to recover signer from signature signed using EIP712 formatted data
     * https://eips.ethereum.org/EIPS/eip-712
     * "\\x19" makes the encoding deterministic
     * "\\x01" is the version byte to make it compatible to EIP-191
     */
    function toTypedMessageHash(bytes32 messageHash)
        internal
        view
        returns (bytes32)
    {
        return
            keccak256(
                abi.encodePacked("\x19\x01", domainSeparator, messageHash)
            );
    }
}


// File contracts/commons/NativeMetaTransaction.sol

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract NativeMetaTransaction is EIP712Base {
    bytes32 private constant META_TRANSACTION_TYPEHASH = keccak256(
        bytes(
            "MetaTransaction(uint256 nonce,address from,bytes functionSignature)"
        )
    );
    event MetaTransactionExecuted(
        address userAddress,
        address relayerAddress,
        bytes functionSignature
    );
    mapping(address => uint256) nonces;

    /*
     * Meta transaction structure.
     * No point of including value field here as if user is doing value transfer then he has the funds to pay for gas
     * He should call the desired function directly in that case.
     */
    struct MetaTransaction {
        uint256 nonce;
        address from;
        bytes functionSignature;
    }

    function executeMetaTransaction(
        address userAddress,
        bytes memory functionSignature,
        bytes32 sigR,
        bytes32 sigS,
        uint8 sigV
    ) public payable returns (bytes memory) {
        MetaTransaction memory metaTx = MetaTransaction({
            nonce: nonces[userAddress],
            from: userAddress,
            functionSignature: functionSignature
        });

        require(
            verify(userAddress, metaTx, sigR, sigS, sigV),
            "NMT#executeMetaTransaction: SIGNER_AND_SIGNATURE_DO_NOT_MATCH"
        );

        // increase nonce for user (to avoid re-use)
        nonces[userAddress] = nonces[userAddress] + 1;

        emit MetaTransactionExecuted(
            userAddress,
            msg.sender,
            functionSignature
        );

        // Append userAddress and relayer address at the end to extract it from calling context
        (bool success, bytes memory returnData) = address(this).call(
            abi.encodePacked(functionSignature, userAddress)
        );
        require(success, "NMT#executeMetaTransaction: CALL_FAILED");

        return returnData;
    }

    function hashMetaTransaction(MetaTransaction memory metaTx)
        internal
        pure
        returns (bytes32)
    {
        return
            keccak256(
                abi.encode(
                    META_TRANSACTION_TYPEHASH,
                    metaTx.nonce,
                    metaTx.from,
                    keccak256(metaTx.functionSignature)
                )
            );
    }

    function getNonce(address user) public view returns (uint256 nonce) {
        nonce = nonces[user];
    }

    function verify(
        address signer,
        MetaTransaction memory metaTx,
        bytes32 sigR,
        bytes32 sigS,
        uint8 sigV
    ) internal view returns (bool) {
        require(signer != address(0), "NMT#verify: INVALID_SIGNER");
        return
            signer ==
            ecrecover(
                toTypedMessageHash(hashMetaTransaction(metaTx)),
                sigV,
                sigR,
                sigS
            );
    }
}


// File contracts/managers/CollectionManager.sol

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;







contract CollectionManager is OwnableInitializable, NativeMetaTransaction {
    IERC20  public acceptedToken;
    IRarities public rarities;
    address public committee;
    address public feesCollector;
    uint256 public pricePerItem;

    event AcceptedTokenSet(IERC20 indexed _oldAcceptedToken, IERC20 indexed _newAcceptedToken);
    event CommitteeSet(address indexed _oldCommittee, address indexed _newCommittee);
    event FeesCollectorSet(address indexed _oldFeesCollector, address indexed _newFeesCollector);
    event RaritiesSet(IRarities indexed _oldRarities, IRarities indexed _newRarities);

    /**
    * @notice Create the contract
    * @param _owner - owner of the contract
    * @param _acceptedToken - accepted ERC20 token for collection deployment
    * @param _committee - committee contract
    * @param _feesCollector - fees collector
    * @param _rarities - rarities contract
    */
    constructor(address _owner, IERC20 _acceptedToken, address _committee, address _feesCollector, IRarities _rarities) {
        // EIP712 init
        _initializeEIP712('Decentraland Collection Manager', '1');
        // Ownable init
        _initOwnable();

        setAcceptedToken(_acceptedToken);
        setCommittee(_committee);
        setFeesCollector(_feesCollector);
        setRarities(_rarities);

        transferOwnership(_owner);
    }

    /**
    * @notice Set the accepted token
    * @param _newAcceptedToken - accepted ERC20 token for collection deployment
    */
    function setAcceptedToken(IERC20 _newAcceptedToken) onlyOwner public {
        require(address(_newAcceptedToken) != address(0), "CollectionManager#setAcceptedToken: INVALID_ACCEPTED_TOKEN");

        emit AcceptedTokenSet(acceptedToken, _newAcceptedToken);
        acceptedToken = _newAcceptedToken;
    }

    /**
    * @notice Set the committee
    * @param _newCommittee - committee contract
    */
    function setCommittee(address _newCommittee) onlyOwner public {
        require(_newCommittee != address(0), "CollectionManager#setCommittee: INVALID_COMMITTEE");

        emit CommitteeSet(committee, _newCommittee);
        committee = _newCommittee;
    }

    /**
    * @notice Set the fees collector
    * @param _newFeesCollector - fees collector
    */
    function setFeesCollector(address _newFeesCollector) onlyOwner public {
        require(_newFeesCollector != address(0), "CollectionManager#setFeesCollector: INVALID_FEES_COLLECTOR");

        emit FeesCollectorSet(feesCollector, _newFeesCollector);
        feesCollector = _newFeesCollector;
    }

    /**
    * @notice Set the rarities
    * @param _newRarities - price per item
    */
    function setRarities(IRarities _newRarities) onlyOwner public {
        require(address(_newRarities) != address(0), "CollectionManager#setRarities: INVALID_RARITIES");

        emit RaritiesSet(rarities, _newRarities);
        rarities = _newRarities;
    }

    /**
    * @notice Create a collection
    * @param _forwarder - forwarder contract owner of the collection factory
    * @param _factory - collection factory
    * @param _salt - arbitrary 32 bytes hexa
    * @param _name - name of the contract
    * @param _symbol - symbol of the contract
    * @param _baseURI - base URI for token URIs
    * @param _creator - creator address
    * @param _items - items to be added
    */
    function createCollection(
        IForwarder _forwarder,
        IERC721CollectionFactoryV2 _factory,
        bytes32 _salt,
        string memory _name,
        string memory _symbol,
        string memory _baseURI,
        address _creator,
        IERC721CollectionV2.ItemParam[] memory _items
     ) external {
        uint256 amount = 0;

        for (uint256 i = 0; i < _items.length; i++) {
            IERC721CollectionV2.ItemParam memory item = _items[i];

            IRarities.Rarity memory rarity = rarities.getRarityByName(item.rarity);

            amount = amount + rarity.price;
        }

        // Transfer fees to collector
        if (amount > 0) {
            require(
                acceptedToken.transferFrom(_msgSender(), feesCollector, amount),
                "CollectionManager#createCollection: TRANSFER_FEES_FAILED"
            );
        }

        bytes memory data = abi.encodeWithSelector(
            IERC721CollectionV2.initialize.selector,
            _name,
            _symbol,
            _baseURI,
            _creator,
            true, // Collection should be completed
            false, // Collection should start disapproved
            rarities,
            _items
        );

        (bool success,) = _forwarder.forwardCall(address(_factory), abi.encodeWithSelector(_factory.createCollection.selector, _salt, data));
        require(
            success,
             "CollectionManager#createCollection: FORWARD_FAILED"
        );
    }

    /**
    * @notice Manage a collection
    * @param _forwarder - forwarder contract owner of the collection factory
    * @param _collection - collection to be managed
    * @param _data - call data to be used
    */
    function manageCollection(IForwarder _forwarder, IERC721CollectionV2 _collection, bytes calldata _data) public {
        require(
            _msgSender() == committee,
            "CollectionManager#manageCollection: UNAUTHORIZED_SENDER"
        );

        bool success;
        bytes memory res;

        (success, res) = address(_collection).staticcall(abi.encodeWithSelector(_collection.COLLECTION_HASH.selector));
        require(
            success && abi.decode(res, (bytes32)) == keccak256("Decentraland Collection"),
            "CollectionManager#manageCollection: INVALID_COLLECTION"
        );

        (success,) = _forwarder.forwardCall(address(_collection), _data);
        require(
            success,
            "CollectionManager#manageCollection: FORWARD_FAILED"
        );
    }
}
