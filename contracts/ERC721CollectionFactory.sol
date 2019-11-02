pragma solidity ^0.5.11;

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./ERC721Collection.sol";
import "./interfaces/Factory.sol";

contract OwnableDelegateProxy { }

contract ProxyRegistry {
    mapping(address => OwnableDelegateProxy) public proxies;
}

contract ERC721CollectionFactory is Ownable, Factory {
    using SafeMath for uint256;

    string public name;
    string public symbol;
    string public baseURI;

    ProxyRegistry public proxyRegistryAddress;
    ERC721Collection public erc721Collection;

    uint256 public optionsCount;

    mapping(uint256 => bool) options;
    mapping(address => bool) public allowed;

    event BaseURI(string _oldBaseURI, string _newBaseURI);
    event Allowed(address indexed _operator, bool _allowed);

    /**
     * @dev Constructor of the contract.
     * @notice that 0xa5409ec958c83c3f309868babaca7c86dcb077c1 is the contract address for _proxyRegistryAddress at mainnet.
     * @param _name - name of the contract
     * @param _symbol - symbol of the contract
     * @param _baseURI - base URI for token URIs
     * @param _operator - Address allowed to mint tokens
     * @param _proxyRegistryAddress - Address of the ProxyRegistry using at OpenSea
     * @param _erc721Collection - Address of the collection
     */
    constructor(
      string memory _name,
      string memory _symbol,
      string memory _baseURI,
      address _operator,
      ProxyRegistry _proxyRegistryAddress,
      ERC721Collection _erc721Collection
      )
      public {
        name = _name;
        symbol = _symbol;
        proxyRegistryAddress = _proxyRegistryAddress;
        erc721Collection = _erc721Collection;
        setAllowed(_operator, true);
        setBaseURI(_baseURI);
    }

    modifier onlyAllowed() {
        require(allowed[msg.sender], "Only an `allowed` address can issue tokens");
        _;
    }

    /**
     * @dev Check if support factory interface.
     * @return always true
     */
    function supportsFactoryInterface() public view returns (bool) {
        return true;
    }

    /**
     * @dev Return the number of options the factory supports.
     * @return supported options count
     */
    function numOptions() public view returns (uint256) {
        return erc721Collection.wearablesCount();
    }

    /**
     * @dev Mints asset(s) in accordance to a specific address with a particular "option". This should be
     * callable only by the contract owner or the owner's Wyvern Proxy (later universal login will solve this).
     * Options should also be delineated 0 - (numOptions() - 1) for convenient indexing.
     * @param _optionId the option id
     * @param _toAddress address of the future owner of the asset(s)
     */
    function mint(uint256 _optionId, address _toAddress) public onlyAllowed  {
        require(canMint(_optionId), "Invalid option");
        string memory wearable = _wearableByOptionId(_optionId);
        erc721Collection.issueToken(_toAddress, wearable);
    }

    /**
    * @dev Returns whether the option ID can be minted. Can return false if the developer wishes to
    * restrict a total supply per option ID (or overall).
    * @param _optionId the option id
    * @return whether an option can be minted
    */
    function canMint(uint256 _optionId) public view returns (bool) {
        string memory wearable = _wearableByOptionId(_optionId);
        bytes32 wearableKey = erc721Collection.getWearableKey(wearable);

        uint256 issued = erc721Collection.issued(wearableKey);
        uint256 maxIssuance = erc721Collection.maxIssuance(wearableKey);
        if (issued >= maxIssuance) {
            return false;
        }
    }

    /**
     * @dev Returns an URI for a given option ID.
     * Throws if the option ID does not exist. May return an empty string.
     * @param _optionId - uint256 ID of the token queried
     * @return token URI
     */
    function tokenURI(uint256 _optionId) external view returns (string memory) {
        string memory wearable = _wearableByOptionId(_optionId);
        return string(abi.encodePacked(baseURI, wearable));
    }

    /**
    * @dev Set Base URI.
    * @param _baseURI - base URI for token URIs
    */
    function setBaseURI(string memory _baseURI) public onlyOwner {
        emit BaseURI(baseURI, _baseURI);
        baseURI = _baseURI;
    }

    /**
     * @dev Set allowed account to issue tokens.
     * @param _operator - Address allowed to issue tokens
     * @param _allowed - Whether is allowed or not
     */
    function setAllowed(address _operator, bool _allowed) public onlyOwner {
        require(_operator != address(0), "Invalid address");
        require(allowed[_operator] != _allowed, "You should set a different value");

        allowed[_operator] = _allowed;
        emit Allowed(_operator, _allowed);
    }

    /**
     * @dev Get the proxy address used at OpenSea.
     * @notice that this address should be used at setAllowed method
     * to allow OpenSea to mint tokens.
     * OpenSea uses the Wyvern Protocol https://docs.opensea.io/docs/opensea-partners-program
     * @param _operator - Address allowed to issue tokens
     */
     // Should be used to return the address to be set as setAllowed
    function proxies(address _operator) public view returns (address) {
        return address(proxyRegistryAddress.proxies(_operator));
    }

    /**
    * Hack to get things to work automatically on OpenSea.
    * Use transferFrom so the frontend doesn't have to worry about different method names.
    */
    function transferFrom(address /*_from*/, address _to, uint256 _tokenId) public {
        mint(_tokenId, _to);
    }

    /**
    * Hack to get things to work automatically on OpenSea.
    * Use isApprovedForAll so the frontend doesn't have to worry about different method names.
    */
    function isApprovedForAll(
        address _owner,
        address _operator
    )
      public
      view
      returns (bool)
    {
        if (owner() == _owner && _owner == _operator) {
            return true;
        }

        if (owner() == _owner && allowed[_operator]) {
            return true;
        }

        return false;
    }

    /**
    * Hack to get things to work automatically on OpenSea.
    * Use isApprovedForAll so the frontend doesn't have to worry about different method names.
    */
    function ownerOf(uint256 /*_tokenId*/) public view returns (address _owner) {
        return owner();
    }

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