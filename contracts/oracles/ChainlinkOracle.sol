// SPDX-License-Identifier: MIT

pragma solidity ^0.7.3;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/math/SafeMath.sol';

import '../interfaces/IOracle.sol';
import '../interfaces/IChainlinkOracle.sol';

contract ChainlinkOracle is IOracle {
    using SafeMath for uint256;

    IChainlinkOracle public immutable oracle;
    uint256 public immutable returnDecimals;
    uint256 public immutable tokenDecimals;

    constructor(
        IChainlinkOracle _oracle,
        uint256 _returnDecimals,
        uint256 _tokenDecimals
    ) {
        oracle = _oracle;
        returnDecimals = _returnDecimals;
        tokenDecimals = _tokenDecimals;
    }

    /**
     * @notice Get price
     * @return rate in the expected token decimals
     */
    function getRate() external view override returns (uint256) {
        (, int256 rate, , , ) = oracle.latestRoundData();

        if (rate < 0) {
            revert('ChainlinkOracle#getRate: RATE_BELOW_0');
        }

        return uint256(rate).mul(10**(tokenDecimals.sub(returnDecimals)));
    }
}
