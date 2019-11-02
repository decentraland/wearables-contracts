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

OpenSea uses the Wyvern Protocol https://docs.opensea.io/docs/opensea-partners-program. So, to allow an address create option orders the owner of the factory should:

1. Call the factory `proxies` method with the address that will create the order
2. Call the factory `setAllowed` method with the address returned above.

```javascript
// I want to allow the address 0x1234 to create orders for the factory options
const proxyAddress = await Factory.proxies('0x1234')
await Factory.setAllowed(proxyAddress, true, { from: owner })
```

If you want to remove an existing allowed address you can do:

```javascript
await Factory.setAllowed(proxyAddress, false, { from: owner })
```
