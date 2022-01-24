// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

/**
 * @notice Reduced interface used by Chainlink Data Feeds
 * @dev Obtained from https://github.com/smartcontractkit/chainlink/blob/develop/contracts/src/v0.7/interfaces/AggregatorV3Interface.sol
 *      Not using chainlink/contracts lib because of the amount of unnecessary stuff it installs while only this interface is required
 *      Only required functions are defined
 */
interface AggregatorV3Interface {
    /**
     * @notice Get the number of decimals present in the response value
     * @return The number of decimals
     */
    function decimals() external view returns (uint8);

    /**
     * @notice Get the price from the latest round
     * @return roundId - The round ID
     * @return answer - The price 
     * @return startedAt - Timestamp of when the round started
     * @return updatedAt - Timestamp of when the round was updated
     * @return answeredInRound - The round ID of the round in which the answer was computed
     */
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}
