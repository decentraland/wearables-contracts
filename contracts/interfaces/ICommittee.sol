// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;


interface ICommittee {
    function members(address _address) external view returns (bool);
}
