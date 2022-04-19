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
RARITIES=Rarities.sol
RARITIES_WITH_ORACLE=RaritiesWithOracle.sol

THIRD_PARTY_REGISTRY=ThirdPartyRegistry.sol
CHAINLINK_ORACLE=ChainlinkOracle.sol

OUTPUT=full

node_modules/.bin/hardhat flatten contracts/collections/v1/$ERC721_COLLECTION > $OUTPUT/$ERC721_COLLECTION
node_modules/.bin/hardhat flatten contracts/collections/v1/$ERC721_DETERMINISTIC_COLLECTION > $OUTPUT/$ERC721_DETERMINISTIC_COLLECTION
node_modules/.bin/hardhat flatten contracts/factories/v1/$ERC721_COLLECTION_FACTORY > $OUTPUT/$ERC721_COLLECTION_FACTORY
node_modules/.bin/hardhat flatten contracts/markets/$DONATION > $OUTPUT/$DONATION
node_modules/.bin/hardhat flatten contracts/markets/$BURNING_STORE > $OUTPUT/$BURNING_STORE
node_modules/.bin/hardhat flatten contracts/markets/v2/$COLLECTION_V2_STORE > $OUTPUT/$COLLECTION_V2_STORE
node_modules/.bin/hardhat flatten contracts/collections/v2/$ERC721_COLLECTION_V2 > $OUTPUT/$ERC721_COLLECTION_V2
node_modules/.bin/hardhat flatten contracts/factories/v2/$ERC721_COLLECTION_FACTORY_V2 > $OUTPUT/$ERC721_COLLECTION_FACTORY_V2
node_modules/.bin/hardhat flatten contracts/commons/$FORWARDER > $OUTPUT/$FORWARDER
node_modules/.bin/hardhat flatten contracts/managers/$COMMITTEE > $OUTPUT/$COMMITTEE
node_modules/.bin/hardhat flatten contracts/managers/$COLLECTION_MANAGER > $OUTPUT/$COLLECTION_MANAGER
node_modules/.bin/hardhat flatten contracts/managers/$RARITIES > $OUTPUT/$RARITIES
node_modules/.bin/hardhat flatten contracts/managers/$RARITIES_WITH_ORACLE > $OUTPUT/$RARITIES_WITH_ORACLE
node_modules/.bin/hardhat flatten contracts/oracles/$CHAINLINK_ORACLE > $OUTPUT/$CHAINLINK_ORACLE
node_modules/.bin/hardhat flatten contracts/registries/$THIRD_PARTY_REGISTRY > $OUTPUT/$THIRD_PARTY_REGISTRY
