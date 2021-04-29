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
