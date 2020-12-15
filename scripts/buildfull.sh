#! /bin/bash

ERC721_COLLECTION=ERC721Collection.sol
ERC721_DETERMINISTIC_COLLECTION=ERC721DeterministicCollection.sol
ERC721_COLLECTION_FACTORY=ERC721CollectionFactory.sol
ERC721_COLLECTION_V2=ERC721CollectionV2.sol
ERC721_COLLECTION_FACTORY_V2=ERC721CollectionFactoryV2.sol

DONATION=Donation.sol
BURNING_STORE=BurningStore.sol
COLLECTION_V2_STORE=CollectionStore.sol

COMMITTEE=Committee.sol
FORWARDER=Forwarder.sol
COLLECTION_MANAGER=CollectionManager.sol


OUTPUT=full

npx truffle-flattener contracts/collections/v1/$ERC721_COLLECTION > $OUTPUT/$ERC721_COLLECTION
npx truffle-flattener contracts/collections/v1/$ERC721_DETERMINISTIC_COLLECTION > $OUTPUT/$ERC721_DETERMINISTIC_COLLECTION
npx truffle-flattener contracts/factories/v1/$ERC721_COLLECTION_FACTORY > $OUTPUT/$ERC721_COLLECTION_FACTORY
npx truffle-flattener contracts/markets/$DONATION > $OUTPUT/$DONATION
npx truffle-flattener contracts/markets/$BURNING_STORE > $OUTPUT/$BURNING_STORE
npx truffle-flattener contracts/markets/v2/$COLLECTION_V2_STORE > $OUTPUT/$COLLECTION_V2_STORE
npx truffle-flattener contracts/collections/v2/$ERC721_COLLECTION_V2 > $OUTPUT/$ERC721_COLLECTION_V2
npx truffle-flattener contracts/factories/v2/$ERC721_COLLECTION_FACTORY_V2 > $OUTPUT/$ERC721_COLLECTION_FACTORY_V2
npx truffle-flattener contracts/commons/$FORWARDER > $OUTPUT/$FORWARDER
npx truffle-flattener contracts/managers/$COMMITTEE > $OUTPUT/$COMMITTEE
npx truffle-flattener contracts/managers/$COLLECTION_MANAGER > $OUTPUT/$COLLECTION_MANAGER



