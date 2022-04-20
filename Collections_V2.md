<pre>
  Title: Collection V2 contract
  Author: Ignacio Mazzara <nacho@decentraland.org>
  Type: Standards
  Created: 2020-08-28
</pre>

# Collection V2 contract

## Table of Contents

- [Introduction](#introduction)
- [Abstract](#abstract)
- [Compatibility](#compatibility)
- [Terminology](#terminology)
- [Design](#design)
  - [Collection](#collection)
  - [Items](#items)
    - [Rarity](#rarity)
    - [Content](#edit-items)
    - [Metadata](#item-metadata)
  - [Tokens](#tokens)
  - [Roles](#roles)
    - [Owner](#owner)
    - [Creator](#creator)
    - [Minter](#minter)
    - [Manager](#manager)
  - [Status](#status)
    - [Initialized](#intialized)
    - [Approved](#approved)
    - [Completed](#completed)
    - [Editable](#editable)
  - [Factory](#factory)
- [Specification](#specification)
  - [Events](#events)
  - [Functions](#functions)
    - [Init](#init)
    - [Roles](#roles-1)
    - [Items](#items-1)
    - [Status](#status-1)
    - [URI](#uri)
    - [batch-transfers](#batch-transfer)
    - [Token utils](#token-utils)
- [Limitations](#limitations)

## Introduction

Every item as wearable, emotes, 3d object, etc in Decentraland's world is represented by a non-fungible token ERC #721 that is indivisible and unique. Those items together defines a collection which works as a registry powered by a smart contract where it is defined all the information. A collection can be built by anyone but approved by a governance system (committee).

## Abstract

One of Decentraland's most important digital assets are collections. Every collection has a bunch of items where each item is defined by its type, rarity, and metadata. The items can be used accross Decentraland as wearables, emotes, 3d models, etc. Also, the items are a key piece of the Decentralad marketplace where users can buy/sell them.

The collections exist within a EVM blockchain (currently Ethereum).

This document describes the structure, and the expected behavior and functionality of interacting components provided by the Base Collection V2 contract.

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 8174](https://tools.ietf.org/html/rfc8174) when, and only when, they appear in all capitals, as shown here.

## Compatibility

Every Collection contract is compliant with the [ERC721 Ethereum standard](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-721.md), and implements the [ERC721Base interface](https://github.com/decentraland/erc721/blob/master/contracts/IERC721Base.sol), as well as the [ERC721Enumerable interface](https://github.com/decentraland/erc721/blob/master/contracts/IERC721Enumerable.sol).

Its implementation could be find [here](https://github.com/decentraland/wearables-contracts/blob/master/full/ERC721BaseCollectionV2.sol).

## Terminology

**Collection**: group/registry of items.

**Item**: an object is something that can be minted as a token. Each object has its own maximum supply (defined by its [rarity](#rarity)), total supply, price & beneficiary for each sale, metadata, and its content hash. Each item is represented by its unique id.

**Token**: an item emission, a ERC721 token.

**Account**: an Ethereum address.

**Issuance number**: the emission number of the token. E.g: 1/100.

**Content hash**: hash of the entity id at the content server.

## Design

### Collection

A collection is a group of items. The contract implementation is followed by version and deployed by using the [beacon proxy pattern](https://eips.ethereum.org/EIPS/eip-1967). Once a collection contract proxy is deployed, the `initialized` method should be called to simulate the constructor. By using the beacon proxy pattern, every collection uses the same implementation which is set in a upgradeable beacon contract. It means that the collection logic can be upgraded by changing the implementation in the upgradeable beacon contract.

A collection can be created by anyone. The creators must pay an amount of MANA, which is the sum of reach item plus its rarity price, to deploy a collection. The collection will be valid only if it was deployed by the collection factory; This factory keeps a record of each deployed collection.

Prior {date} and {block number}: the collections had been using the [minimal proxy pattern](https://eips.ethereum.org/EIPS/eip-1167). It means that those collections can't be upgraded.

### Items

A collection has items reflecting different assets. Each item is represented by a unique identifier (ID) stored on-chain. E.g: If the collection has `red_hat`; `awesome_pants`; `dracula_t_shirt`; `decentraland_shoes` it means that it has 4 items. Also, each item will have a URI stored on-chain. That URI will point to the content of that item, in short, how the item looks and its metadata. This URI can be queried on-chain. It will be useful for Decentraland and other third parties to know how a token looks like.

The collection owner can add items along with its rarity, price, beneficiary and metadata until he explicitly completes the collection. This action will be done on-chain and once the collection is complete, no more items can be added but edited ONLY in terms of its price and beneficiary on-chain and content off-chain by [_managers_](#manager) or the [_creator_](#creator).The id and rarity never change.

The emission number of each item is a key important concept called _issued id_. It means that if a collection has an item with rarity Legendary (max supply 100) every emission will be auto-incremented following: 1/100; 2/100; 3/100;...; 100/100.

The item in the collection is an `Struct` with the following properties:

```solidity
struct Item {
    string rarity;
    uint256 maxSupply; // rarity max supply
    uint256 totalSupply; // current supply
    uint256 price;
    address beneficiary;
    string metadata;
    string contentHash;
}
```

#### Rarities

Each item has a rarity. The rarity represents the maximum supply available. The rarities smart contract has all the rarities information: name, maximum supply, and its price. The price is the amount of MANA the creator needs to pay in order to add an item with that rarity to his collection.

The contract will be depoyed with the following started rarities:

- **common**: Max supply 100000
- **uncommon**: Max supply 10000
- **rare**: Max supply 5000
- **epic**: Max supply 1000
- **legendary**: Max supply 100
- **mythic**: Max supply 10
- **unique**: Max supply 1

The smart contract will be owned by a DAO, which means that new rarities can be added in the future by community votes. Rarities can't be removed once they are added and the only thing available to be changed is its price. Name and max supply are immutable.

If a creator tries to use a collection that is not added in the rarities smart contract, the transaction must fail.

#### Content

How an item looks like: .gltf files, representations, overrides, etc is stored in a `.json` file, as we do for the parcel's scenes, in the Decentraland content-server. The content-server will check if the user about to update the item's content of a specific collection is a [_creator_](#creator) or [_manager_](#manager); it will fail if it is not authorized.

On-chain, every token will have a URI, queried by `tokenURI` (ERC721 standard function) pointing to the content-server (`.json` file).

#### Content Dispute

<p align="center">
<img width="646" alt="Screen Shot 2020-08-27 at 20 35 40" src="https://user-images.githubusercontent.com/7549152/91504980-e277bd00-e8a4-11ea-8cc7-e948a4b5c44c.png">
<p>

In case of a dispute about the content of an item, the [_owner of the collection_](#owner) will be able to set a _content hash_. Every item at the content server has its own entity id which is a deterministic hash based on its content as IPFS does. So, if for some reason an item was corrupted, the owner of the collection will be able to set this hash on-chain. If an item has the _content hash_ property filled, not zero, the content server will return that instead of the current content.

Also, the owner can set the collection as `not editable` and therefore creators and managers won't be able to update new content for the collection's items.

#### Metadata

Each item will have metadata on-chain describing important aspects. The metadata will follow a protocol: `version:type:name:description:data`. Where data could be useful information about the type. In the case of Decentraland wearables an example can be:

- version: 1
- type: w (wearable)
- name: red_hat
- description: the red hat description
- data: category:bodyShape (hat:female,male)

In the contract will looks like: `1:w:red_hat:the red hat description:hat:female,male`.

This metadata will be primarly used by the indexers work as filters. Also, this metadata will be backed up by the content stored in the Decentraland content-server

### Tokens

Every token id is composed by two **key aspects**: the item id and the issued id (issuance number) packed in 32-bytes. E.g: if the item id is `1` and the issued id is `10` then the token id will be: `0x000000000100000000000000000000000000000000000000000000000000000A`.

### Roles

#### Owner

The owner must be a multisig or a DAO which decides crucial things related to the collection and its items:

- **Approve the collection**: Once a collection is created, the collection should be approved to allow the minting of its tokens.
- **Rescue items**: If for some reason an items was uploaded wrong to the contract, the creator and the managers lose their credentials and/or a maliciosus actor try to break items. The owner can override an item metadata and/or content hash.
- **Change base URI**.
- **Transfer Creator role**.
- **Transfer ownership role**.

#### Creator

Account who deploys the collection. The creator is responsible for:

- **Add items**
- **Edit items price & beneficiary**
- **Edit items content off-chain**
- **Mint tokens**
- **Assign/Unassign minters and managers**
- **Transfer creator role**

#### Minter

A minter can only mint new tokens. It can be set global or per item.

#### Manager

A manager is used off-chain to allow accounts to update the content of an item. They can be set global or per item.

### Status

#### Initialized

Once the `initialize` function is called. It can't be initialized more than once.

#### Completed

Once the collection is _completed_, new items can't be added to the collection. There is no rollback once the collection is completed.

#### Approved

Collections can be approved or rejected at any time. Once the collection is _approved_, tokens can be minted.

#### Editable

The status _editable_ is used off-chain to allow the creator and/or managers to edit the content of an item.

### Factory

<p align="center">
<img width="766" alt="Screen Shot 2020-08-27 at 21 54 48" src="https://user-images.githubusercontent.com/7549152/91509192-ef4dde00-e8af-11ea-967a-57029c2efdf2.png">
</p>

In order to reduce costs deploying the same contract multiple times, we have decided to implement the [minimal proxy pattern](https://eips.ethereum.org/EIPS/eip-1167). Every time a collection is created, it is being created as minimal contract which use the collection implementation storage slot. Even the collections are using a proxy pattern, they can not be upgraded. There is not way to modify the code of the already deployed collection, but new collections can be deployed with a new implementation by deploying another one on-chain, and set that implementation in the factory contract.

The factory is using [`CREATE2`](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1014.md) to deploy every collection, so everyone can know in advance the address of the collection without the need of deploying it.

## Specification

### Events

**BaseURI**

Emitted when the base URI changed.

```solidity
BaseURI(string _oldBaseURI, string _newBaseURI);
```

**SetGlobalMinter**

Emitted when a global minter is set or removed.

```solidity
SetGlobalMinter(address indexed _minter, bool _value);
```

**SetGlobalManager**

Emitted when a global manager is set or removed.

```solidity
SetGlobalManager(address indexed _manager, bool _value);
```

**SetItemMinter**

Emitted when a minter for a specific item is set or removed.

```solidity
SetItemMinter(uint256 indexed _itemId, address indexed _minter, bool _value);
```

**SetItemManager**

Emitted when a manager for a specific item is set or removed.

```solidity
SetItemManager(uint256 indexed _itemId, address indexed _manager, _value);
```

**AddItem**

Emitted when an item is added.

```solidity
AddItem(uint256 indexed _itemId, Item _item);
```

**RescueItem**

[Emitted when an item is rescue](#owner)

```solidity
RescueItem(uint256 indexed _itemId, string _contentHash, string _metadata)
```

**Issue**

Emitted when a token is minted.

```solidity
Issue(
  address indexed _beneficiary,
  uint256 indexed _tokenId,
  uint256 indexed _itemId,
  uint256 _issuedId
);
```

**UpdateItemData**

Emitted when the price, beneficiary and metadata of an item is updated.

```solidity
UpdateItemData(uint256 indexed _itemId, uint256 _price, address _beneficiary);
```

**CreatorshipTransferred**

Emitted when the creator role is transferred.

```solidity
CreatorshipTransferred(address indexed _previousCreator, address indexed _ newCreator);
```

**Approve**

Emitted when the collection is approved.

```solidity
Approve()
```

**SetEditable**

Emitted when the collection is set to editable or not.

```solidity
SetEditable(bool _previousValue, bool _newValue);
```

**Complete**

Emitted when the collection is completed.

```solidity
Complete()
```

_...along with all the ERC721 & Ownable events._

### Functions

### Init

**initialize**

Initialize the collection

```solidity
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
```

### Roles

**setMinters**

Set a global minter.

```solidity
setMinters(address[] calldata _minters, bool[] calldata _values) external
```

**setItemsMinters**

Set a minter for an specific item.

```solidity
function setItemsMinters(
  uint256[] calldata _itemIds,
  address[] calldata _minters,
  bool[] calldata _values
) external
```

**setManagers**

Set a global manager.

```solidity
setManagers(address[] calldata _managers, bool[] calldata _values) external
```

**setItemsManagers**

Set a manager for an specific item.

```solidity
function setItemsManagers(
  uint256[] calldata _itemIds,
  address[] calldata _managers,
  bool[] calldata _values
) external
```

**transferCreatorship**

Transfer the creator role.

```solidity
function transferCreatorship(address _newCreator) public
```

### Items

_**addItems**_

Add items to the collections.

```solidity
addItems(ItemParam[] memory _items) external
```

_**issueTokens**_

Mints token of multiple item ids.

```solidity
 function issueTokens(address[] calldata _beneficiaries, uint256[] calldata _itemIds) external
```

_**editItemsData**_

Edit the price, beneficiary and metadata of multiple items.

```solidity
function editItemsSalesData(
  uint256[] calldata _itemIds,
  uint256[] calldata _prices,
  address[] calldata _beneficiaries,
  string[] calldata _metadatas
) external
```

_**rescueItems**_

Override the metadata and/or content hash of multiple items.

```solidity
 function rescueItems(
  uint256[] calldata _itemIds,
  string[] memory calldata _contentHashes,
  string[] calldata _metadatas
) external
```

_**itemsCount**_

Get the amount of items in the collection.

```solidity
function itemsCount() external view returns (uint256)
```

### Status

_**completeCollection**_

Set the collection as completed.

```solidity
function completeCollection() external
```

_**approveCollection**_

Set the collection as approved.

```solidity
function approveCollection() external
```

_**setEditable**_

Set the collection as editable or not.

```solidity
function setEditable() external
```

-**isMintingAllowed**

Check whether a collection can be minted or not

```solidity
function isMintingAllowed() external view returns (bool)
```

### URI

_**setBaseURI**_

Set the base URI of the collection.

```solidity
function setBaseURI(string memory _baseURI) public
```

_**tokenURI**_

Get the URI of an specific token.

```solidity
function tokenURI(uint256 _tokenId) public view virtual override returns (string memory)
```

### Batch Transfer

_**batchTransferFrom**_

Transfer a batch of tokens to another address. Discourage method, please use `safeTransferFrom`

```solidity
function batchTransferFrom(address _from, address _to, uint256[] calldata _tokenIds) external
```

_**safeTransferFrom**_

Safe transfer a batch of tokens to another address with bytes.

```solidity
function safeBatchTransferFrom(address _from, address _to, uint256[] memory _tokenIds, bytes memory _data) public
```

### Token Utils

_**encodeTokenId**_

[Encode a token id](#tokens). It will pack the item id and the issued id in 32-bytes.

```solidity
function encodeTokenId(uint256 _itemId, uint256 _issuedId) public pure returns (uint256 id)
```

_**decodeTokenId**_

[Decode a token id](#tokens). It will unpack the item id and the issued id in from a 32-bytes uint.

```solidity
function decodeTokenId(uint256 _id) public pure returns (uint256 itemId, uint256 issuedId)
```

_...along with all the ERC721 & Ownable functions._

## Limitations

As blocklimit limitation, every transaction which support `many` items manipulation may _run out of gas_. It is strongly recommended to divide the transaction in multiple ones to achieve the same.
