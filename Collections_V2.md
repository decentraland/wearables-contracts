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
  - [Contract](#contract)
  - [Items](#items)
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
- [Specification](#specification)
  - [Events](#events)
  - [Functions](#functions)
    - [Init](#init)
    - [Roles](#roles-1)
    - [Items](#tems-1)
    - [Status](#status-1)
    - [URI](#uri)
    - [batch-transfers](#batch-transfer)
    - [Token utils](#token-utils)
- [Limitations](#limitations)

## Introduction

Every item as wearable, emotes, 3d object, etc in Decentraland's world is represented by a non-fungible token ERC #721 that is indivisible and unique. Those items together defines a collection which works as a registry powered by a smart contract where it is defined all the information. A collection can be built by anyone but approved by a governance system.

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

**Item**: an object is something that can be minted as a token. Each object has its own maximum supply (defined by its rarity), total supply, price & beneficiary for each sale, metadata, and its content hash. Each item is represented by its unique id.

**Token**: an item emission, a ERC721 token.

**Account**: an Ethereum address.

**Issuance number**: the emission number of the token. E.g: 1/100.

**Content hash**: hash of the entity id at the content server.

## Design

### Collection

A collection contract is ready to use with the [minimal proxy pattern](https://eips.ethereum.org/EIPS/eip-1167). Once the contract is deployed the `initialized` method should be called to simulate the constructor.

### Items

A collection has items reflecting different assets. Each item is represented by a unique identifier (ID) stored on-chain. E.g: If the collection has `red_hat`; `awesome_pants`; `dracula_t_shirt`; `decentraland_shoes` it means that it has 4 items. Also, each item will have a URI stored on-chain. That URI will point to the content of that item, in short, how the item looks and its metadata. This URI can be queried on-chain. It will be useful for Decentraland and other third parties to know how a token looks like.

The collection owner can add items along with its rarity, price, beneficiary and metadata until he explicitly completes the collection. This action will be done on-chain and once the collection is complete, no more items can be added but edited ONLY in terms of its price by the collection [_creator_](#creator) and content off-chain by [_managers_](#manager) or the [_creator_](#creator). This means that its id and rarity (maximum total supply available) never change.

The emission order of each item is a key important concept called _issued id_. It means that if a collection has an item with rarity Legendary (max supply 100) every emission will be auto-incremented following: 1/100; 2/100; 3/100;...; 100/100.

#### Content

How an item looks like: .gltf files, representations, overrides, etc is stored in a `.json` file, as we do for the parcel's scenes, in the Decentraland content-server. The content-server will check if the user about to update the item's content of a specific collection is a [_creator_](#creator) or [_manager_](#manager); it will fail if it is not authorized.

On-chain, every token will have a URI, queried by `tokenURI` (ERC721 standard function) pointing to the content-server (`.json` file).

#### Content Dispute

<p align="center">
<img width="565" alt="Screen Shot 2020-08-27 at 17 47 26" src="https://user-images.githubusercontent.com/7549152/91493509-cf0d2780-e88d-11ea-817e-e13376295e4f.png">
<p>

In case of a dispute about the content of an item, the [_owner of the collection_](#owner) will be able to set a _content hash_. Every item at the content server has its own entity id which is a deterministic hash based on its content as IPFS does. So, if for some reason an item was corrupted, the owner of the collection will be able to set this hash on-chain. If an item has the _content hash_ property filled, not zero, the content server will return that instead of the current content.

#### Metadata

Each item will have metadata on-chain describing important aspects. The metadata will follow a protocol: `version:type:name:data`. Where data could be useful information about the type. In the case of Decentraland wearables an example can be:

- version: 1
- type: w (wearable)
- name: red_hat
- data: category,bodyShape = (hat:female,male)

In the contract will looks like: `1:w:red_hat:hat:female,male`.

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

Once the collection is _approved_, tokens can start being minted. There is no rollback once the collection is approved.

#### Editable

The status _editable_ is used off-chain to allow the creator and/or managers to edit the content of an item.

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
RescueItem(uint256 indexed _itemId, bytes32 _contentHash, string _metadata)
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

**UpdateItem**

Emitted when the price and beneficiary of an item is updated.

```solidity
UpdateItem(uint256 indexed _itemId, uint256 _price, address _beneficiary);
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

Emitted when the base URI metadata changed.

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
  address _creator,
  bool _shouldComplete,
  string memory _baseURI,
  Item[] memory _items
)
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
addItems(Item[] memory _items) external
```

_**issueToken**_

Mint a token of an specific item id.

```solidity
function issueToken(address _beneficiary,  uint256 _itemId) external
```

_**issueTokens**_

Mints token of multiple item ids.

```solidity
 function issueTokens(address[] calldata _beneficiaries, uint256[] calldata _itemIds) external
```

_**editItems**_

Edit the price and beneficiary of multiple items.

```solidity
function editItems(
  uint256[] calldata _itemIds,
  uint256[] calldata _prices,
  address[] calldata _beneficiaries
) external
```

_**rescueItems**_

Override the metadata and/or content hash of multiple items.

```solidity
 function rescueItems(
  uint256[] calldata _itemIds,
  bytes32[] calldata _contentHashes,
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

```
function batchTransferFrom(address _from, address _to, uint256[] calldata _tokenIds) external
```

_**safeTransferFrom**_

Safe transfer a batch of tokens to another address.

```
function safeBatchTransferFrom(address _from, address _to, uint256[] memory _tokenIds) public
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
