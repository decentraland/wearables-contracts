# Decentralanad Collection Contracts

- [Collection v2 Specs](https://github.com/decentraland/wearables-contracts/blob/master/Collections_V2.md)
- [Collection Store V2 Specs](https://github.com/decentraland/wearables-contracts/blob/master/Collections_V2_Store.md)

## Install

```bash
npm i
```

## Tests

### Normal

```bash
npm run test
```

### Gas report

```bash
npm run test:gas-report
```

### Deploy

```bash
npx hardhat run --network <network> scripts/deploy/deploy.ts
```

Available networks:

- `localhost`. You need to run a local node with `npx hardhat node`
- `deploy`. You must need to export NETWORK with the desired one. E.g: `NETWORK=MUMBAI npx hardhat run --network deploy scripts/deploy.ts`

## ThirdPartyRegistryV3

Third iteration of the ThirdPartyRegistry deployed at [0x1C436C1EFb4608dFfDC8bace99d2B03c314f3348](https://polygonscan.com/address/0x1C436C1EFb4608dFfDC8bace99d2B03c314f3348#code) (Proxy address).

### Changes in this Version

- `addThirdParties` can now be called by anyone.
- Adding a new Third Party requires paying for the item slots specified during creation.
- Programmatic Third Parties, which have a fixed slot cost set by the `programmaticBasePurchasedSlots` variable, can now be added.
- Managers of Programmatic Third Parties can call `buyItemSlots` to add more slots without cost.
- `setProgrammaticBasePurchasedSlots` has been introduced, allowing the registry owner to define the number of slots required to create a new Programmatic Third Party.

### Upgrade Instructions

1. **Deploy the ThirdPartyRegistryV3 Implementation Contract**:
   - Initialize it with default values.

2. **Upgrade the Proxy to Use ThirdPartyRegistryV3**:
   - As the owner of [0xF44063d872C88eEBab2EFC0318194e75a5218C1E](https://polygonscan.com/address/0xF44063d872C88eEBab2EFC0318194e75a5218C1E#code) (the Proxy Admin of the ThirdPartyRegistry), call the `upgrade(address _proxy, address _implementation)` function.
   - Use `0x1C436C1EFb4608dFfDC8bace99d2B03c314f3348` (The Third Party Registry proxy address) for `_proxy` and the address of the newly deployed ThirdPartyRegistryV3 contract for `_implementation`.

3. **Set the Item Slot Price**:
   - As the owner of the ThirdPartyRegistry contract, call `setItemSlotPrice(uint256 _newPrice)` to define the price of Third Party item slots in USD.
   - The price should be provided in wei, with `100000000000000000000` corresponding to `100` USD.

4. **Set Programmatic Base Purchased Slots**:
   - Call `setProgrammaticBasePurchasedSlots(uint256 _slots)` to define the number of slots required to add a Programmatic Third Party.
   - The default value is `0`, and until this value is set, attempts to add a Third Party will revert.
