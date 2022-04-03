// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface AntiBot {
    function protect(
        address sender,
        address receiver,
        uint256 amount
    ) external returns (uint256 fee);
}

contract MUUV is Ownable, ERC20 {
    AntiBot public ab;
    bool public abEnabled;
    address private _devAddress;

    uint256 private constant INITIAL_SUPPLY = 9 * 10**(8 + 18); // 1B tokens

    constructor() ERC20("MUUV Token", "MUUV") {
        _mint(_msgSender(), INITIAL_SUPPLY);
        _devAddress = _msgSender();
    }

    function setABAddress(address _ab) external onlyOwner {
        ab = AntiBot(_ab);
    }

    function setABEnabled(bool _enabled) external onlyOwner {
        require(address(ab) != address(0), "MUUV: Anti bot not found");
        abEnabled = _enabled;
    }

    function setDevAddress(address _dev) external onlyOwner {
        _devAddress = _dev;
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override(ERC20) {
        if (abEnabled) {
            uint256 fee = ab.protect(from, to, amount);

            if (fee > 0) {
                super._transfer(from, _devAddress, fee);
            }

            super._transfer(from, to, amount - fee);
        } else {
            super._transfer(from, to, amount);
        }
    }
}
