import { ethers } from "hardhat"

const TIERS = [
  { price: ethers.utils.parseEther('1'), value: 10 },
  { price: ethers.utils.parseEther('10'), value: 100 },
  { price: ethers.utils.parseEther('20'), value: 1000 },
  { price: ethers.utils.parseEther('30'), value: 10000 },
  { price: ethers.utils.parseEther('0'), value: 1 },
]

enum NETWORKS {
  'MUMBAI' = 'MUMBAI',
  'MATIC' = 'MATIC',
  'GOERLI' = 'GOERLI',
  'LOCALHOST' = 'LOCALHOST',
  'BSC_TESTNET' = 'BSC_TESTNET',
}

/**
 * @dev Steps:
 * Deploy the Tiers smart contract
 */
async function main() {
  const owner = process.env['OWNER']

  const account = ethers.provider.getSigner()
  const accountAddress = await account.getAddress()

  const network = NETWORKS[(process.env['NETWORK'] || 'LOCALHOST') as NETWORKS]
  if (!network) {
    throw ('Invalid network')
  }

  // Deploy the Tiers contract
  const Tiers = await ethers.getContractFactory("Tiers")
  const tiers = await Tiers.deploy(owner, (TIERS).map((tier) => [
    tier.value,
    tier.price
  ]))

  console.log(`Contract deployed by: ${accountAddress}`)
  console.log('Tiers:', tiers.address)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })