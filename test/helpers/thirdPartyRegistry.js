// Artifacts usedby hardhat-upgrades to deploy the ProxyAdmin and TransparentUpgradeableProxy when running `upgrades.deployProxy`
// @openzeppelin/hardhat-upgrades/src/utils/factories.ts
import ProxyAdmin from '@openzeppelin/upgrades-core/artifacts/@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol/ProxyAdmin.json'
import TransparentUpgradeableProxy from '@openzeppelin/upgrades-core/artifacts/@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol/TransparentUpgradeableProxy.json'
import { web3 } from 'hardhat'

export { ProxyAdmin, TransparentUpgradeableProxy }

export async function getSignature(
  contract,
  thirdPartyId,
  qty,
  salt,
  signer,
  domain,
  version
) {
  const chainId = await contract.getChainId()

  const domainType = [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'verifyingContract', type: 'address' },
    { name: 'salt', type: 'bytes32' },
  ]

  const domainData = {
    name: domain,
    verifyingContract: contract.address,
    salt: web3.utils.padLeft(web3.utils.toHex(chainId), 64),
    version,
  }

  const consumeSlotsType = [
    { name: 'thirdPartyId', type: 'string' },
    { name: 'qty', type: 'uint256' },
    { name: 'salt', type: 'bytes32' },
  ]

  let message = {
    thirdPartyId,
    qty,
    salt,
  }

  const dataToSign = {
    types: {
      EIP712Domain: domainType,
      ConsumeSlots: consumeSlotsType,
    },
    domain: domainData,
    primaryType: 'ConsumeSlots',
    message: message,
  }

  let signature = await new Promise((res, rej) =>
    web3.currentProvider.send(
      {
        method: 'eth_signTypedData_v4',
        params: [signer, dataToSign],
        jsonrpc: '2.0',
        id: 999999999999,
      },
      function (err, result) {
        if (err || result.error) {
          return rej(err || result.error)
        }
        return res(result.result)
      }
    )
  )

  signature = signature.substring(2)

  const r = '0x' + signature.substring(0, 64)
  const s = '0x' + signature.substring(64, 128)
  const v = '0x' + signature.substring(128, 130)

  return {
    r,
    s,
    v,
  }
}

export async function getMessageHash(
  name,
  version,
  thirdPartyId,
  qty,
  salt,
  contract
) {
  const dataHash = web3.utils.keccak256(
    web3.eth.abi.encodeParameters(
      ['bytes32', 'bytes32', 'uint256', 'bytes32'],
      [
        web3.utils.keccak256(
          'ConsumeSlots(string thirdPartyId,uint256 qty,bytes32 salt)'
        ),
        web3.utils.keccak256(thirdPartyId),
        qty,
        salt,
      ]
    )
  )

  const domainHash = web3.utils.keccak256(
    web3.eth.abi.encodeParameters(
      ['bytes32', 'bytes32', 'bytes32', 'address', 'bytes32'],
      [
        web3.utils.keccak256(
          'EIP712Domain(string name,string version,address verifyingContract,bytes32 salt)'
        ),
        web3.utils.keccak256(name),
        web3.utils.keccak256(version),
        contract.address,
        web3.utils.padLeft(web3.utils.toHex(await contract.getChainId()), 64),
      ]
    )
  )

  return web3.utils.soliditySha3('\x19\x01', domainHash, dataHash)
}
