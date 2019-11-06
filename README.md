# Set Up a Factory

A factory contract is used to sell wearables at OpenSea. The interface is defined [here](./contracts/interfaces/Factory.sol).

Every _optionId_ is the index of a _wearableId_ in the `wearables` array of an [ERC721Collection](https://github.com/decentraland/wearables-contracts/blob/master/contracts/ERC721Collection.sol#L13)

_ERC721CollectionFactory.sol_

```javascript
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
```

OpenSea uses the Wyvern Protocol https://docs.opensea.io/docs/opensea-partners-program. Only one address will be allowed to create option orders.
A proxy to this address will be created once the address first interacts with OpenSea.

The contracts for the ProxyRegistry can be seen [here](https://github.com/ProjectOpenSea/opensea-creatures/blob/master/migrations/2_deploy_contracts.js). Calling `proxies` on the Mainnet contract, the user can check if a proxy address was created for her address.
