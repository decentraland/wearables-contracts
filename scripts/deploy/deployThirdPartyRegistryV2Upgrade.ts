import { ethers, upgrades } from 'hardhat'

enum NETWORKS {
  'MUMBAI' = 'MUMBAI',
  'MATIC' = 'MATIC',
  'GOERLI' = 'GOERLI',
  'LOCALHOST' = 'LOCALHOST',
  'BSC_TESTNET' = 'BSC_TESTNET',
}

enum TPR_PROXY_ADDRESS {
  'MUMBAI' = '0x810d96f82916456F83A0868Df2B8Ce5d5742886B',
  'MATIC' = '',
  'GOERLI' = '',
  'LOCALHOST' = '',
  'BSC_TESTNET' = '',
}

/**
 * @dev Steps:
 * Deploy the Third Party Registry smart contract
 */
async function main() {
  const account = ethers.provider.getSigner()
  const accountAddress = await account.getAddress()

  const network = NETWORKS[(process.env['NETWORK'] || 'LOCALHOST') as NETWORKS]
  if (!network) {
    throw 'Invalid network'
  }

  // Upgrade the TPR contract
  // This is a test one, replace with correct implementation when required
  const DummyThirdPartyRegistryV2Upgrade = await ethers.getContractFactory(
    'DummyThirdPartyRegistryV2Upgrade'
  )

  const proxy = await upgrades.upgradeProxy(
    TPR_PROXY_ADDRESS[network],
    DummyThirdPartyRegistryV2Upgrade
  )

  await proxy.deployed()

  console.log(`Contract upgraded by: ${accountAddress}`)
  console.log('TPR Proxy:', proxy.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
