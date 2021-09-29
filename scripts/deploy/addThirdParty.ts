import { run, ethers } from "hardhat"

enum NETWORKS {
  'MUMBAI' = 'MUMBAI',
  'MATIC' = 'MATIC',
  'GOERLI' = 'GOERLI',
  'LOCALHOST' = 'LOCALHOST',
  'BSC_TESTNET' = 'BSC_TESTNET',
}

enum THIRD_PARTY_REGISTRY {
  'MUMBAI' = '0xC6349360CF0143Bf54FDC376060532C044883b8C',
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
  const thirdParty = [
    'urn:decentraland:matic:ext-thirdparty1',
    'tp:1:third party 1: the third party 1 desc',
    'https://api.thirdparty1.com/v1/',
    process.env['COMMITTEE_MEMBERS']?.split(','),
    [],
  ]

  const network = NETWORKS[(process.env['NETWORK'] || 'LOCALHOST') as NETWORKS]
  if (!network) {
    throw ('Invalid network')
  }

  // Attach the TPR contract
  const ThirdPartyRegistry = await ethers.getContractFactory("ThirdPartyRegistry")
  const tpr = await ThirdPartyRegistry.attach(THIRD_PARTY_REGISTRY[network])

  console.log('TPR:', tpr.address)

  await tpr.addThirdParties([thirdParty])

  console.log('Third Party successfully added')
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })