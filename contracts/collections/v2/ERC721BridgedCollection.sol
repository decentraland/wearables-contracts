// SPDX-License-Identifier: MIT

pragma solidity  ^0.7.3;
pragma experimental ABIEncoderV2;

import "../../commons//OwnableInitializable.sol";
import "../../commons//NativeMetaTransaction.sol";
import "../../tokens/ERC721Initializable.sol";

contract ERC721BridgedCollection is OwnableInitializable, ERC721Initializable, NativeMetaTransaction {
    bytes32 constant public COLLECTION_HASH = keccak256("Decentraland Collection");

    struct Token {
        address collection;
        uint256 tokenId;
        string tokenURI;
    }

    address public admin;
    mapping(uint256 => Token) public tokens;

    event AdminSet(address _oldValue, address _newValue);


    /**
     * @notice Create the contract
     * @param _owner - owner of the contract
     * @param _admin - admin (minter & burner) of the contract
     * @param _name - name of the contract
     * @param _symbol - symbol of the contract
     */
    constructor (
        address _owner,
        address _admin,
        string memory _name,
        string memory _symbol
    ) {
        _initOwnable();
        _initializeEIP712('Decentraland Bridged Collection', '1');
        _initERC721(_name, _symbol);

        setAdmin(_admin);
        transferOwnership(_owner);
    }

    /*
    * Roles checkers
    */

    modifier onlyAdmin() {
        require(
            _msgSender() == admin,
            "EBC#onlyadmin: CALLER_IS_NOT_ADMIN"
        );
        _;
    }

    /**
    * @notice Set the contract admin
    * @param _newAdmin - new admin
    */
    function setAdmin(address _newAdmin) public onlyOwner {
        emit AdminSet(admin, _newAdmin);

        admin = _newAdmin;
    }

    /**
     * @notice Mint tokens
     * @dev only callable by the admin
     * @param _beneficiary - beneficiary of the tokens
     * @param _tokens - tokens to mint
     */
    function mint(address _beneficiary, Token[] calldata _tokens) onlyAdmin external {
        for (uint256 i = 0; i < _tokens.length; i++) {
            Token memory token = _tokens[i];
            uint256 tokenId = uint256(keccak256(abi.encode(token.collection, token.tokenId)));

            tokens[tokenId] = token;

            super._mint(_beneficiary, tokenId);
        }
    }

    /**
     * @notice Burn tokens
     * @dev only callable by the admin
     * @param _tokenIds - token ids to burn
     */
    function burn(uint256[] calldata _tokenIds) onlyAdmin external {
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            uint256 tokenId = _tokenIds[i];
            delete tokens[tokenId];

            super._burn(tokenId);
        }
    }

    /**
     * @notice Returns an URI for a given token ID.
     * Throws if the token ID does not exist. May return an empty string.
     * @param _tokenId - uint256 ID of the token queried
     * @return token URI
     */
    function tokenURI(uint256 _tokenId) public view virtual override returns (string memory) {
        require(_exists(_tokenId), "EBC#tokenURI: INVALID_TOKEN_ID");

        return tokens[_tokenId].tokenURI;
    }

    /*
    * Batch Transfer functions
    */

    /**
     * @notice Transfers the ownership of given tokens ID to another address.
     * Usage of this method is discouraged, use {safeBatchTransferFrom} whenever possible.
     * Requires the msg.sender to be the owner, approved, or operator.
     * @param _from current owner of the token
     * @param _to address to receive the ownership of the given token ID
     * @param _tokenIds uint256 ID of the token to be transferred
     */
    function batchTransferFrom(address _from, address _to, uint256[] calldata _tokenIds) external {
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            transferFrom(_from, _to, _tokenIds[i]);
        }
    }

    /**
     * @notice Safely transfers the ownership of given token IDs to another address
     * If the target address is a contract, it must implement {IERC721Receiver-onERC721Received},
     * which is called upon a safe transfer, and return the magic value
     * `bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))`; otherwise,
     * the transfer is reverted.
     * Requires the msg.sender to be the owner, approved, or operator
     * @param _from - current owner of the token
     * @param _to - address to receive the ownership of the given token ID
     * @param _tokenIds - uint256 ID of the tokens to be transferred
     * @param _data bytes data to send along with a safe transfer check
     */
    function safeBatchTransferFrom(address _from, address _to, uint256[] memory _tokenIds, bytes memory _data) external {
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            safeTransferFrom(_from, _to, _tokenIds[i], _data);
        }
    }
}
