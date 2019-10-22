import { testContract } from './helpers/tests'

const ExclusiveMasks = artifacts.require('ExclusiveMasks')

const MASKS = [
  { name: 'bird_mask', max: 100 },
  { name: 'classic_mask', max: 100 },
  { name: 'clown_nose', max: 100 },
  { name: 'asian_fox', max: 100 },
  { name: 'killer_mask', max: 100 },
  { name: 'serial_killer_mask', max: 100 },
  { name: 'theater_mask', max: 100 },
  { name: 'tropical_mask', max: 100 }
]

describe('ExclusiveTokens', function() {
  testContract(ExclusiveMasks, 'exclusive-masks', 'DCLXM', MASKS)
})
