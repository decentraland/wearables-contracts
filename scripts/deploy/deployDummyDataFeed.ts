import { ethers } from 'hardhat'

/**
 * @dev This contracts purpose is to function as a mock for when there is no
 * data feed on test chains
 * Steps:
 * Deploy the DummyDataFeed smart contract
 */
async function main() {
  const account = ethers.provider.getSigner()
  const accountAddress = await account.getAddress()

  const DummyDataFeed = await ethers.getContractFactory(
    'DummyDataFeed'
  )

  const decimals = 8
  const answer = 10 ** decimals // 100000000

  const dataFeed = await DummyDataFeed.deploy(decimals, answer)

  console.log(`Contract deployed by: ${accountAddress}`)
  console.log('DummyDataFeed:', dataFeed.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
