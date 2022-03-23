// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MUUV.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Vesting is Ownable {
    using SafeERC20 for IERC20;

    uint32 private constant SECONDS_PER_DAY = 24 * 60 * 60;

    IERC20 private _token;
    bool private _isSetSchedule;
    uint256 private _totalAmountInvested;
    Schedule private _schedule;

    struct User {
        uint256 amount;
        uint256 amountClaimed;
        uint256 receivedAmountEachMilestone;
        uint256 proccessMilestones;
    }

    struct Schedule {
        uint32 startDate;
        uint32 cliffPeriodDate;
        uint32 interval;
        uint32 milestones;
    }

    mapping(address => User) private _users;

    event AddUser(address indexed account, uint256 indexed amount);
    event AddManyUser(address[] indexed accounts, uint256[] amounts);
    event RemoveUser(address indexed account);
    event SetVestingSchedule(
        uint32 startDate,
        uint32 cliffPeriodDate,
        uint32 interval,
        uint32 milestones
    );
    event WithdrawToken(address indexed user, uint256 amount);

    constructor(address token) {
        require(token != address(0), "Vesting/constructor: token address must not be 0");
        _token = IERC20(token);
        _isSetSchedule = false;
    }

    modifier isUserInVesting(address _addr) {
        require(_users[_addr].amount > 0, "Vesting/modifier: user is not in vesting");
        _;
    }

    function setVestingSchedule(
        uint32 _startDate,
        uint32 _cliffPeriod,
        uint32 _interval,
        uint32 _milestones
    ) public {
        require(!_isSetSchedule, "Vesting/setVestingSchedule: vesting was already scheduled!");
        require(block.timestamp / SECONDS_PER_DAY < _startDate, "Vesting/setVestingSchedule: schedule start date after current date");
        require(_cliffPeriod % _interval == 0, "Vesting/setVestingSchedule: cliff period must divisible by interval");

        _schedule = Schedule(_startDate, _startDate + _cliffPeriod, _interval, _milestones);
        _isSetSchedule = true;
        emit SetVestingSchedule(_startDate, _startDate + _cliffPeriod, _interval, _milestones);
    }

    function addOneUser(address account, uint256 amount)
        public
        onlyOwner
    {
        require(_isSetSchedule, "Vesting/setVestingSchedule: vesting need to be scheduled!");
        require(amount > 0, "Vesting/addOneUser: insufficient amount");
        require(block.timestamp / SECONDS_PER_DAY < _schedule.startDate, "Vesting/addOneUser: can not add subscriber after vesting started");
        require(_users[account].amount == 0, "Vesting/addOneUser: user is already in vesting");
        require(_token.balanceOf(address(this)) >= _totalAmountInvested + amount, "Vesting/addOneUser: not enough supply in pool");

        _totalAmountInvested += amount;
        _users[account] = User(amount, 0, amount / _schedule.milestones, 0);
        emit AddUser(account, amount);
    }

    function addManyUser(address[] memory accounts, uint256[] memory amounts)
        public
        onlyOwner
    {
        //require acc, amount length > 0
        require(
            accounts.length > 0 && amounts.length > 0,
            "Vesting/addManyUser: accounts and amounts list can not be null"
        );
        require(accounts.length == amounts.length, "Vesting/addManyUser: accounts and amounts's length should equal");

        for (uint256 index = 0; index < accounts.length; index++) {
            addOneUser(accounts[index], amounts[index]);
        }
    }

    function removeUser(address account) public onlyOwner isUserInVesting(account) {
        require(!_isSetSchedule || _schedule.startDate >= uint32(block.timestamp / SECONDS_PER_DAY), "Vesting/removeUser: can't remove user when vesting started");
    
        _totalAmountInvested -= _users[account].amount;

        _users[account].amount = 0;
        _users[account].amountClaimed = 0;
        _users[account].receivedAmountEachMilestone = 0;
        _users[account].proccessMilestones = 0;
        emit RemoveUser(account);
    }

    function withdraw() external isUserInVesting(msg.sender) {
        uint256 releaseTime = block.timestamp / SECONDS_PER_DAY;
        require(releaseTime >= _schedule.cliffPeriodDate, "Vesting/withdraw: cliffPeriod not expired");
        uint256 _currentMilestone = (releaseTime - _schedule.cliffPeriodDate) / _schedule.interval + 1;
        if(_currentMilestone > _schedule.milestones) {
            _currentMilestone = _schedule.milestones;
        }
        require(_users[msg.sender].proccessMilestones < _currentMilestone, "Vesting/withdraw: released token this milestone");

        uint256 transferAmount = _users[msg.sender].receivedAmountEachMilestone * (_currentMilestone - _users[msg.sender].proccessMilestones);
        _users[msg.sender].proccessMilestones = _currentMilestone;
        _users[msg.sender].amountClaimed += transferAmount;

        _token.safeTransfer(msg.sender, transferAmount);
    }

}
