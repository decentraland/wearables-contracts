import hr from 'hardhat'

import { ethers } from "hardhat"


const TIERS = [
  { price: ethers.utils.parseEther('1'), value: 10 },
  { price: ethers.utils.parseEther('10'), value: 100 },
  { price: ethers.utils.parseEther('20'), value: 1000 },
  { price: ethers.utils.parseEther('30'), value: 10000 },
  { price: ethers.utils.parseEther('0'), value: 1 },
]

async function main() {
  await hr.run("verify:verify", {
    address: '0xdC899B9c1Fa80292606C3cfbA88bbBf0935c2e48',
    constructorArguments: [
      '0xc002A074c59DD45dDb52334f2ef8fb743A579c89',
      TIERS.map((tier) => [
        tier.value,
        tier.price
      ])
    ],
  })
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })