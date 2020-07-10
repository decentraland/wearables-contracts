const BN = web3.utils.BN
const expect = require('chai').use(require('bn-chai')(BN)).expect

export async function balanceSnap(token, address, account = '') {
  const snapBalance = await token.balanceOf(address)
  return {
    requireConstant: async function () {
      expect(snapBalance, `${account} balance should remain constant`).to.eq.BN(
        await token.balanceOf(address)
      )
    },
    requireIncrease: async function (delta) {
      const realincrease = (await token.balanceOf(address)).sub(snapBalance)
      expect(
        snapBalance.add(delta),
        `${account} should increase by ${delta} - but increased by ${realincrease}`
      ).to.eq.BN(await token.balanceOf(address))
    },
    requireDecrease: async function (delta) {
      const realdecrease = snapBalance.sub(await token.balanceOf(address))
      expect(
        snapBalance.sub(delta),
        `${account} should decrease by ${delta} - but decreased by ${realdecrease}`
      ).to.eq.BN(await token.balanceOf(address))
    },
    restore: async function () {
      await token.setBalance(snapBalance, address)
    },
  }
}
