#! /bin/bash

MASKS=ExclusiveMasks.sol

OUTPUT=full

npx truffle-flattener contracts/$MASKS > $OUTPUT/$MASKS