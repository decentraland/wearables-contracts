// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

/**
 * @notice Chainlink Data Feed interface
 * @dev This is a renamed copy of https://github.com/smartcontractkit/chainlink/blob/develop/contracts/src/v0.7/interfaces/AggregatorV3Interface.sol
 * containing only the required functions required by our contracts.
 * We could have imported the chainlink/contracts package but decided not to due to the large amount of things imported we would not need.
 */
interface IDataFeed {
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
