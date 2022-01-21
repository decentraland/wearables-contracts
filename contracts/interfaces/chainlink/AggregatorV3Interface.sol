// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

/**
 * @notice Interface used by Chainlink Data Feeds
 * @dev Obtained from https://github.com/smartcontractkit/chainlink/blob/develop/contracts/src/v0.7/interfaces/AggregatorV3Interface.sol
 *      Not using @chainlink/contracts because of the amount of unnecessary stuff it installs while only this interface is required
 *      Natspec added from https://docs.chain.link/docs/price-feeds-api-reference/
 *      getRoundData and latestRoundData should both raise "No data present"
 *      if they do not have data to report, instead of returning unset values
 *      which could be misinterpreted as actual reported values.
 */
interface AggregatorV3Interface {
    /**
     * @notice Get the number of decimals present in the response value
     * @return The number of decimals
     */
    function decimals() external view returns (uint8);

    /**
     * @notice Get the description of the underlying aggregator that the proxy points to
     * @return The description of the underlying aggregator
     */
    function description() external view returns (string memory);

    /**
     * @notice The version representing the type of aggregator the proxy points to
     * @return The version number
     */
    function version() external view returns (uint256);

    /**
     * @notice Get data about a specific round, using the roundId
     * @param _roundId - The round ID
     * @return roundId - The round ID
     * @return answer - The price 
     * @return startedAt - Timestamp of when the round started
     * @return updatedAt - Timestamp of when the round was updated
     * @return answeredInRound - The round ID of the round in which the answer was computed
     */
    function getRoundData(uint80 _roundId)
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );

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
