#! /bin/bash

ERC721_COLLECTION=ERC721Collection.sol
ERC721_DETERMINISTIC_COLLECTION=ERC721DeterministicCollection.sol
ERC721_COLLECTION_FACTORY=ERC721CollectionFactory.sol
DONATION=Donation.sol
SIMPLE_STORE=SimpleStore.sol

OUTPUT=full

npx truffle-flattener contracts/$ERC721_COLLECTION > $OUTPUT/$ERC721_COLLECTION
npx truffle-flattener contracts/$ERC721_DETERMINISTIC_COLLECTION > $OUTPUT/$ERC721_DETERMINISTIC_COLLECTION
npx truffle-flattener contracts/$ERC721_COLLECTION_FACTORY > $OUTPUT/$ERC721_COLLECTION_FACTORY
npx truffle-flattener contracts/$DONATION > $OUTPUT/$DONATION
npx truffle-flattener contracts/$SIMPLE_STORE > $OUTPUT/$SIMPLE_STORE

