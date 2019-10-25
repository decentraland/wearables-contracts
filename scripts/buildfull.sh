#! /bin/bash

ERC721_COLLECTION=ERC721Collection.sol

OUTPUT=full

npx truffle-flattener contracts/$ERC721_COLLECTION > $OUTPUT/$ERC721_COLLECTION