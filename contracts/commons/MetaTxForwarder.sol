// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;


contract MetaTxForwarder {
    /**
    * @notice Create the contract
    */
    constructor() { }

    /**
    * @notice Forward a call
    * @param _target - target address to call
    * @param _data - call data to be used
    * @return response in bytes if any
    */
    function forwardMetaTx(address _target, bytes calldata _data) external payable returns (bytes memory) {
       (bool success, bytes memory res) = _target.call{value: msg.value}(_data);

       require(success, "MetaTxForwarder#forwardMetaTx:  CALL_FAILED");

       return res;
    }
}