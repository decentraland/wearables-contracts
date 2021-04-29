// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;

import "@openzeppelin/contracts/access/Ownable.sol";


contract Forwarder is Ownable {

    address public caller;

    event CallerSet(address indexed _oldCaller, address indexed _newCaller);

    /**
    * @notice Create the contract
    * @param _owner - contract owner
    * @param _caller - target address to call
    */
    constructor(address _owner, address _caller) {
        setCaller(_caller);
        transferOwnership(_owner);
    }

    /**
    * @notice Set the caller allowed to forward calls
    * @param _newCaller - target address to call
    */
    function setCaller(address _newCaller) public onlyOwner {
        emit CallerSet(caller, _newCaller);

        caller = _newCaller;
    }

    /**
    * @notice Forward a call
    * @param _target - target address to call
    * @param _data - call data to be used
    * @return whether the call was a success or not
    * @return response in bytes if any
    */
    function forwardCall(address _target, bytes calldata _data) external payable returns (bool, bytes memory) {
        require(
            msg.sender == caller || msg.sender == owner(),
            "Owner#forwardCall: UNAUTHORIZED_SENDER"
        );

       return _target.call{value: msg.value}(_data);
    }
}