// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract AccountStub is IERC1271 {
    using ECDSA for bytes32;

    address public owner;

    // bytes4(keccak256("isValidSignature(bytes,bytes)")
    bytes4 internal constant MAGICVALUE = 0x1626ba7e;
    bytes4 internal constant INVALID_SIGNATURE = 0xffffffff;

    constructor(address _owner) {
        owner = _owner;
    }

    function isValidSignature(bytes32 _messageHash, bytes memory _signature)
        public
        view
        override
        returns (bytes4 magicValue)
    {
        address signer = _messageHash.recover(_signature);
        if (signer == owner) {
            return MAGICVALUE;
        } else {
            return INVALID_SIGNATURE;
        }
    }
}
