// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;

import "@openzeppelin/contracts/utils/Address.sol";

contract MinimalProxyFactory {
    using Address for address;

    address public implementation;
    bytes public code;
    bytes32 public codeHash;

    event ProxyCreated(address indexed _address, bytes32 _salt);
    event ImplementationSet(address indexed _implementation, bytes32 _codeHash, bytes _code);

    /**
    * @notice Create the contract
    * @param _implementation - contract implementation
    */
    constructor(address _implementation) {
        _setImplementation(_implementation);
    }

    /**
    * @notice Create a contract
    * @param _salt - arbitrary 32 bytes hexa
    * @param _data - call data used to call the contract already created if passed
    * @return addr - address of the contract created
    */
    function _createProxy(bytes32 _salt, bytes memory _data) internal virtual returns (address addr) {
        bytes memory slotcode = code;
        bytes32 salt = keccak256(abi.encodePacked(_salt, msg.sender, _data));

        // solium-disable-next-line security/no-inline-assembly
        assembly {
            addr := create2(0, add(slotcode, 0x20), mload(slotcode), salt)
        }
        require(addr != address(0), "MinimalProxyFactory#createProxy: CREATION_FAILED");

        emit ProxyCreated(addr, _salt);

        if (_data.length > 0) {
            (bool success,) = addr.call(_data);
            require(success, "MinimalProxyFactory#createProxy: CALL_FAILED");
        }
    }

    /**
    * @notice Get a deterministics contract address
    * @param _salt - arbitrary 32 bytes hexa
    * @param _address - supposed sender of the transaction
    * @return address of the deterministic contract
    */
    function getAddress(bytes32 _salt, address _address, bytes calldata _data) external view returns (address) {
        return address(
            uint256(
                keccak256(
                    abi.encodePacked(
                        byte(0xff),
                        address(this),
                        keccak256(abi.encodePacked(_salt, _address, _data)),
                        codeHash
                    )
                )
            )
        );
    }

    /**
    * @notice Set the contract implementation
    * @param _implementation - contract implementation
    */
    function _setImplementation(address _implementation) internal {
        require(
            _implementation != address(0) && _implementation.isContract(),
            "MinimalProxyFactoryV2#_setImplementation: INVALID_IMPLEMENTATION"
        );
        // Adapted from https://github.com/optionality/clone-factory/blob/32782f82dfc5a00d103a7e61a17a5dedbd1e8e9d/contracts/CloneFactory.sol
        code = abi.encodePacked(
            hex"3d602d80600a3d3981f3363d3d373d3d3d363d73",
            _implementation,
            hex"5af43d82803e903d91602b57fd5bf3"
        );
        codeHash = keccak256(code);
        implementation = _implementation;

        emit ImplementationSet(implementation, codeHash, code);
    }
}