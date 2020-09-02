const should = require('chai').should()

export default async function assertRevert(promise, message) {
  try {
    await promise
  } catch (error) {
    const withMessage = message
      ? message.indexOf('invalid opcode') !== -1
        ? `VM Exception while processing transaction: ${message}`
        : `VM Exception while processing transaction: revert ${message}`
      : 'revert'

    error.message.should.include(
      withMessage,
      `Expected "revert", got ${error} instead`
    )
    return
  }
  should.fail('Expected revert not received')
}
