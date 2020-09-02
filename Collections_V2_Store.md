# Collection V2 Store contract

## Table of Contents

- [Introduction](#introduction)
- [Compatibility](#compatibility)
- [Design](#design)
  - [Store](#store)
  - [Roles](#roles)
    - [Owner](#owner)
- [Specification](#specification)
  - [Events](#events)
  - [Functions](#functions)
    - [Buy](#init)
    - [Roles](#roles-1)
    - [Token utils](#token-utils)
- [Limitations](#limitations)

## Introduction

Based on the new [standard defined for the Decentraland collections](https://github.com/decentraland/wearables-contracts/blob/master/Collections_V2.md), items can support primary sale easily creating a new economic momentum to the Decentraland community.

## Compatibility

The store supports only collections following the [Decentraland collections v2 standard](https://github.com/decentraland/wearables-contracts/blob/master/Collections_V2.md). The token used to buy items is the [MANA token](https://etherscan.io/address/0x0f5d2fb29fb7d3cfee444a200298f468908cc942).

## Design

### Store

The store allows primary sales for collection's items. Collection's creator should set the Store smart contract address as a _`minter`_. That should be possible by calling `setMinters` for all the items in the collection or `setItemsMinters` if wants only specific items for the collection to accept primary sales.

The store can have a fee associated for each sale with a precision of 1 million (maximum value = 1,000,000). The fee could be 0 if the community desides.

### Buy

To reduce gas costs and also to allow users to buy multiple items from multiple collections, the _`buy`_ function expected an array of the following _`struct`_.

```solidity
struct ItemToBuy {
    IERC721CollectionV2 collection;
    uint256[] ids;
    uint256[] prices;
}
```

Where the _`collection`_ is the address of the collection, _`ids`_ is the collection's item ids, and _`prices`_ are the prices in MANA that the user will pay for each item to prevent a price-change front-running.

This can be used by:

```javascript
// One collection with multiple items
await storeContract.buy(
  [
    [
      collection.address,
      [itemId_0, itemId_0, itemId_1], // ids
      [itemId_0_price, itemId_0_price, itemId_1_price], // prices
    ],
  ],
  beneficiary, // items beneficiary
  account // sender
)

// Multiple collection with multiple items
await storeContract.buy(
  [
    [
      collection.address,
      [itemId_0, itemId_0, itemId_1], // ids
      [itemId_0_price, itemId_0_price, itemId_1_price], // prices
    ],
    [
      anotherCollection.address,
      [itemId_0, itemId_1, itemId_2], // ids
      [itemId_0_price, itemId_1_price, itemId_2_price], // prices
    ],
  ],
  beneficiary, // items beneficiary
  account // sender
)
```

### Roles

#### Owner

The owner must be a multisig or a DAO which decides crucial things related to the store:

- **Set the fee owner**: Where the fee will be transferred after each sale.
- **Set fees for each sale**.
- **Transfer ownership role**.

## Specification

### Events

**Bought**

Emitted on items primary sales.

```solidity
Bought(ItemToBuy[] _itemsToBuy, address _beneficiary);
```

**SetFee**

Emitted when the fee changed.

```solidity
SetFee(uint256 _oldFee, uint256 _newFee);
```

**SetFeeOwner**

Emitted when the fee owner changed.

```solidity
SetFeeOwner(address indexed _oldFeeOwner, address indexed _newFeeOwner);
```

_...along with all the Ownable events._

### Functions

### Buy

**buy**

Buy items.

```solidity
function buy(ItemToBuy[] memory _itemsToBuy, address _beneficiary) external
```

### Roles

**setFee**

Set the fee.

```solidity
function setFee(uint256 _newFee) public
```

**setFeeOwner**

Set a fee owner.

```solidity
function setFeeOwner(address _newFeeOwner) external
```

### Item Utils

_**getItemBuyData**_

Get collection item's price and beneficiary

```solidity
function getItemBuyData(IERC721CollectionV2 _collection, uint256 _itemId) public view returns (uint256, address)
```

_...along with all the Ownable functions._

## Limitations

As blocklimit limitation, every transaction which support `many` items manipulation may _run out of gas_. It is strongly recommended to divide the transaction in multiple ones to achieve the same.
