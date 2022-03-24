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
    uint8 private _tgeUnlockPercent;
    uint32 private _tgeUnlockDate;

    struct User {
        uint256 amount;
        uint256 amountClaimed;
        uint256 tgeAmountClaimed;
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
    event SetTGE(uint8 percent, uint32 tgeUnlockDate);
    event SetVestingSchedule(
        uint32 startDate,
        uint32 cliffPeriodDate,
        uint32 interval,
        uint32 milestones
    );
    event WithdrawTGEUnlock(address indexed user, uint256 amount);
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

    modifier isVestingScheduled() {
        require(_isSetSchedule, "Vesting/setVestingSchedule: vesting need to be scheduled!");
        _;
    }

    function setTGEUnlock(uint8 _percent, uint32 _tgeDate) public onlyOwner isVestingScheduled(){
        require(_percent > 0, "Vesting/setTGEUnlock: TGE unlock percent must greater than 0");
        require(_tgeDate < _schedule.cliffPeriodDate, "Vesting/setTGEUnlock: TGE unlock date must before cliff period date");
        _tgeUnlockPercent = _percent;
        _tgeUnlockDate = _tgeDate;
        emit SetTGE(_percent, _tgeDate);
    }

    function setVestingSchedule(
        uint32 _startDate,
        uint32 _cliffPeriod,
        uint32 _interval,
        uint32 _milestones
    ) public onlyOwner {
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
        isVestingScheduled()
    {
        require(amount > 0, "Vesting/addOneUser: insufficient amount");
        require(block.timestamp / SECONDS_PER_DAY < _schedule.startDate, "Vesting/addOneUser: can not add subscriber after vesting started");
        require(_users[account].amount == 0, "Vesting/addOneUser: user is already in vesting");
        require(_token.balanceOf(address(this)) >= _totalAmountInvested + amount, "Vesting/addOneUser: not enough supply in pool");

        _totalAmountInvested += amount;
        _users[account] = User(amount, 0, 0);
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

        delete _users[account];

        emit RemoveUser(account);
    }

    function withdraw() external isUserInVesting(msg.sender) isVestingScheduled(){
        uint32 releaseTime = uint32(block.timestamp / SECONDS_PER_DAY);
        User memory user = _users[msg.sender];
        uint256 possibleWithdrawAmount;

        if(_tgeUnlockPercent > 0) {
            require(releaseTime >= _tgeUnlockDate, "Vesting/withdraw: can not withdraw TGE token before TGE unlock date");
            if(user.tgeAmountClaimed == 0) {
                uint256 tgeAmountClaim = (user.amount / _tgeUnlockPercent) / 100;
                possibleWithdrawAmount += tgeAmountClaim;
                user.tgeAmountClaimed += tgeAmountClaim;
                emit WithdrawTGEUnlock(msg.sender, tgeAmountClaim);
            }
        } else {
            require(releaseTime >= _schedule.cliffPeriodDate, "Vesting/withdraw: cliffPeriod not expired");
        }
    
        if (releaseTime >= _schedule.startDate + _schedule.interval * _schedule.milestones) {
            possibleWithdrawAmount += (user.amount - (user.amountClaimed + user.tgeAmountClaimed));
        } else if (releaseTime >= _schedule.cliffPeriodDate) {

            uint32 milestonesVested = (releaseTime - _schedule.cliffPeriodDate) / _schedule.interval + 1;
            if(milestonesVested > _schedule.milestones) {
                milestonesVested = _schedule.milestones;
            }
            uint256 vested = ((user.amount- user.tgeAmountClaimed) * milestonesVested) / _schedule.milestones;
            possibleWithdrawAmount = vested - user.amountClaimed;
        }

        require(possibleWithdrawAmount > 0, "Vesting/withdraw: user withdraw zero token");

        _users[msg.sender].amountClaimed += (possibleWithdrawAmount - user.tgeAmountClaimed);

        _token.safeTransfer(msg.sender, possibleWithdrawAmount);

        emit WithdrawToken(msg.sender, possibleWithdrawAmount);
    }

}
