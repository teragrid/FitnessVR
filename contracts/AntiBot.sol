// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

contract AntiBot {
    address private _liquidAddress;

    enum TransactionType {Transfer, Purchase}

    constructor(address _address) {
        require(_address != address(0), "AntiBot/constructor: param address must not be 0");
        _liquidAddress = _address;
    }

    function checkTransactionType(address sender, address receiver) public view returns(uint8) {
        if(sender == _liquidAddress || receiver == _liquidAddress) return uint8(TransactionType.Purchase);
        return uint8(TransactionType.Transfer);
    }
}