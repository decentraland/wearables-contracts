# Install

```bash
npm i
```

Goes to `/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol` and replace the line 136 with:

```solidity
function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
```

# Tests

```bash
npm run test
```
