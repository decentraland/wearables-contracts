import hr from 'hardhat'

async function main() {
  await hr.run('verify:verify', {
    address: '0x...',
    constructorArguments: [],
  })
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
