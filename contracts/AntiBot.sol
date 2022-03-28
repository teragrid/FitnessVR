// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

contract AntiBot is AccessControlEnumerable {
    enum TradeType {SELL, BUY}

    mapping(address => bool) public blacklist;
    mapping(address => bool) public whitelist;

    uint8 private constant _decimals = 18;

    uint256 public maxBuyAmount = 300 * 10**uint256(_decimals); // 300 token
    uint256 public maxSellAmount = 150 * 10**uint256(_decimals); // 150 token

    uint256 public buyCoolDown = 1 minutes;
    uint256 public sellCoolDown = 3 minutes;

    uint256 public buyFee; // Buy fee percentage
    uint256 public sellFee; // Sell fee percentage

    address public lpPair;
    bool public whitelistEnabled;

    bytes32 private constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    mapping(address => mapping(TradeType => uint256)) private lastTrade;

    event SetMaxSellAmount(uint256 _maxSellAmount);
    event SetSellCoolDown(uint256 _sellCooldown);
    event SetMaxBuyAmount(uint256 _maxBuyAmount);
    event SetBuyCoolDown(uint256 _buyCooldown);
    event SetLpPairAddress(address _lpPair);
    event SetBuyFee(uint256 _buyFee);
    event SetSellFee(uint256 _sellFee);

    event AntiBotLog(address indexed sender, address indexed recipient, uint256 amount);

    constructor(address owner) {
        _setupRole(DEFAULT_ADMIN_ROLE, owner);
        _setupRole(OPERATOR_ROLE, owner);
    }

    function enableWhitelist(bool _enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        whitelistEnabled = _enabled;
    }

    function setLpPair(address _lpPair) external onlyRole(DEFAULT_ADMIN_ROLE) {
        lpPair = _lpPair;
        emit SetLpPairAddress(_lpPair);
    }

    function setSellCoolDown(uint256 _sellCoolDown) external onlyRole(DEFAULT_ADMIN_ROLE) {
        sellCoolDown = _sellCoolDown;
        emit SetSellCoolDown(_sellCoolDown);
    }

    function setMaxSellAmount(uint256 _maxSellAmount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxSellAmount = _maxSellAmount;
        emit SetMaxSellAmount(_maxSellAmount);
    }

    function setBuyCoolDown(uint256 _buyCoolDown) external onlyRole(DEFAULT_ADMIN_ROLE) {
        buyCoolDown = _buyCoolDown;
        emit SetBuyCoolDown(_buyCoolDown);
    }

    function setMaxBuyAmount(uint256 _maxBuyAmount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxBuyAmount = _maxBuyAmount;
        emit SetMaxBuyAmount(_maxBuyAmount);
    }

    function setBuyFee(uint256 _buyFee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        buyFee = _buyFee;
        emit SetBuyFee(_buyFee);
    }

    function setSellFee(uint256 _sellFee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        sellFee = _sellFee;
        emit SetSellFee(_sellFee);
    }

    /**
     * BLACKLIST functions
     */

    function manualBlacklist(address _user) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (whitelist[_user] == true) {
            delete whitelist[_user];
        }
        blacklist[_user] = true;
    }

    function removeFromBlacklist(address _user) external onlyRole(DEFAULT_ADMIN_ROLE) {
        delete blacklist[_user];
    }

    function multiBlacklist(address[] memory _users) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_users.length > 0, "no address to add to blacklist");
        for (uint256 index; index < _users.length; index++) {
            if (whitelist[_users[index]] == true) {
                delete whitelist[_users[index]];
            }
            blacklist[_users[index]] = true;
        }
    }

    function multiRemoveFromBlacklist(address[] memory _users) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_users.length > 0, "no address to remove from blacklist");
        for (uint256 index; index < _users.length; index++) {
            if (blacklist[_users[index]]) {
                delete blacklist[_users[index]];
            }
        }
    }

    /**
     * WHITELIST functions
     */

    function manualWhitelist(address _user) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (blacklist[_user] == true) {
            delete blacklist[_user];
        }
        whitelist[_user] = true;
    }

    function removeFromWhitelist(address _user) external onlyRole(DEFAULT_ADMIN_ROLE) {
        delete whitelist[_user];
    }

    function multiWhitelist(address[] memory _users) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_users.length > 0, "no address to add to whitelist");
        for (uint256 index; index < _users.length; index++) {
            if (blacklist[_users[index]] == true) {
                delete blacklist[_users[index]];
            }
            if (_users[index] != lpPair) {
                whitelist[_users[index]] = true;
            }
        }
    }

    function multiRemoveFromWhitelist(address[] memory _users) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_users.length > 0, "no address to remove from whitelist");
        for (uint256 index; index < _users.length; index++) {
            if (whitelist[_users[index]]) {
                delete whitelist[_users[index]];
            }
        }
    }

    function protect(
        address _sender,
        address _recipient,
        uint256 _amount
    ) external onlyRole(OPERATOR_ROLE) returns (uint256 fee) {
        require(_sender != address(0), "zero address");
        require(_recipient != address(0), "zero address");
        require(!blacklist[_sender], "blacklist sender");
        require(!blacklist[_recipient], "blacklist recipient");

        fee = 0;

        if (whitelistEnabled) {
            if (whitelist[_sender] || whitelist[_recipient]) {
                emit AntiBotLog(_sender, _recipient, _amount);
                return fee;
            }
        }

        if (_sender == lpPair) {
            _canBuy(_recipient, _amount);
            lastTrade[_recipient][TradeType.BUY] = block.timestamp;
            fee = (_amount * buyFee) / 100;
        } else if (_recipient == lpPair) {
            _canSell(_sender, _amount);
            lastTrade[_sender][TradeType.SELL] = block.timestamp;
            fee = (_amount * sellFee) / 100;
        }

        emit AntiBotLog(_sender, _recipient, _amount);
        return (fee);
    }

    function _canBuy(address _buyer, uint256 _amount) private view {
        require(_amount <= maxBuyAmount, "buy limit exceeded");
        require(block.timestamp - lastTrade[_buyer][TradeType.BUY] >= buyCoolDown, "slow down buying");
    }

    function _canSell(address _seller, uint256 _amount) private view {
        require(_amount <= maxSellAmount, "sell limit exceeded");
        require(block.timestamp - lastTrade[_seller][TradeType.SELL] >= sellCoolDown, "slow down selling");
    }
}