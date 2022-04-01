// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MUUV.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Vesting is Ownable {
    using SafeERC20 for IERC20;

    enum Type{Linearly, Monthly}

    uint32 private constant SECONDS_PER_DAY = 24 * 60 * 60;

    IERC20 private _token;
    uint256 private _maxSupply = 900000000;

    struct TGE {
        uint32 tgeUnlockPercent;
        uint32 tgeUnlockDate;
    }

    struct User {
        uint256 amount;
        uint256 amountClaimed;
        uint256 tgeAmountClaimed;
        uint256 lastBlockClaimed;
    }

    struct Schedule {
        uint32 startDate;
        uint32 cliffPeriodDate;
        uint32 interval;
        uint32 milestones;
    }

    struct VestingModel {
        Type vestingType;
        TGE tge;
        Schedule schedule;
        uint256 totalSupply;
        uint256 totalAmountInvested;
        uint256 totalLinearBlock;
        mapping(address => User) users;
    }

    mapping(uint32 => VestingModel) private _idToVesting;

    event AddUser(uint32 idVesting, address indexed account, uint256 amount);
    event AddManyUser(uint32 idVesting, address[] indexed accounts, uint256[] amounts);
    event RemoveUser(uint32 idVesting, address indexed account);
    event SetTGE(uint32 idVesting, uint32 percent, uint32 tgeUnlockDate);
    event SetVestingSchedule(
        uint32 idVesting,
        uint32 startDate,
        uint32 cliffPeriodDate,
        uint32 interval,
        uint32 milestones,
        uint32 linearDuration
    );
    event WithdrawTGEUnlock(uint32 idVesting, address indexed user, uint256 amount);
    event WithdrawToken(uint32 idVesting, address indexed user, uint256 amount);

    constructor(address token, uint256[] memory totalSupplies, bool[] memory isMonthly) {
        require(token != address(0), "Vesting/constructor: token address must not be 0");
        _token = IERC20(token);
        uint256 _totalVestingSupply;
        for (uint32 i = 0; i < totalSupplies.length; i ++) {
            require(totalSupplies[i] > 0, "Vesting/constructor: totalSupplies's element must greater than 0");
            VestingModel storage _vestingModel = _idToVesting[i];
            if(isMonthly[i]) {
                _vestingModel.vestingType = Type.Monthly;
            }
            _vestingModel.tge = TGE(0,0);
            _vestingModel.schedule = Schedule(0,0,0,0);
            _vestingModel.totalSupply = totalSupplies[i];
            _totalVestingSupply += totalSupplies[i];
        }
        require(_maxSupply == _totalVestingSupply, "Vesting/constructor: sum of totalSupplies not equals max supply");
    }

    modifier isUserInVesting(uint32 _idVesting, address _addr) {
        require(_idToVesting[_idVesting].users[_addr].amount > 0, "Vesting/modifier: user is not in vesting");
        _;
    }

    modifier isVestingScheduled(uint32 _idVesting) {
        require(_idToVesting[_idVesting].schedule.startDate > 0, "Vesting/setVestingSchedule: vesting need to be scheduled!");
        _;
    }

    function getMonthlyVestingData(uint32 _idVesting) public view isVestingScheduled(_idVesting) returns (
        uint256 totalSupply,
        uint256 totalAmountInvested,
        uint32 percent, uint32 tgeUnlockdate,
        uint32 startDate, uint32 cliffPeriodDate, uint32 milestones, uint32 interval
         ) {
        VestingModel storage vestingModel = _idToVesting[_idVesting];
        return (
            vestingModel.totalSupply,
            vestingModel.totalAmountInvested,
            vestingModel.tge.tgeUnlockPercent, vestingModel.tge.tgeUnlockDate,
            vestingModel.schedule.startDate, vestingModel.schedule.cliffPeriodDate, vestingModel.schedule.milestones, vestingModel.schedule.interval);
    }

    function getLinearlyVestingData(uint32 _idVesting) public view isVestingScheduled(_idVesting) returns (
        uint256 totalSupply,
        uint256 totalAmountInvested,
        uint32 percent, uint32 tgeUnlockdate,
        uint32 startDate, uint32 cliffPeriodDate, uint256 totalLinearBlock
         ) {
        VestingModel storage vestingModel = _idToVesting[_idVesting];
        return (
            vestingModel.totalSupply,
            vestingModel.totalAmountInvested,
            vestingModel.tge.tgeUnlockPercent, vestingModel.tge.tgeUnlockDate,
            vestingModel.schedule.startDate, vestingModel.schedule.cliffPeriodDate, vestingModel.totalLinearBlock);
    }

    function setVestingSchedule(
        uint32 _idVesting,
        uint32 _startDate,
        uint32 _cliffPeriod,
        uint32 _interval,
        uint32 _milestones,
        uint32 _linearDuration
    ) public onlyOwner {
        require(_idVesting >= 0 && _idVesting <= 9, "Vesting/setVestingSchedule: idVesting must from 0 to 9!");
        require(_startDate > 0, "Vesting/setVestingSchedule: invalid startDate!");
        require((block.timestamp / SECONDS_PER_DAY) < _startDate, "Vesting/setVestingSchedule: schedule start date after current date");

        if(_idToVesting[_idVesting].vestingType == Type.Linearly) {
            require(_milestones== 0 && _interval ==0, "Vesting/setVestingSchedule: schedule linearly milestones and interval must be zero");
            _idToVesting[_idVesting].schedule = Schedule(_startDate, _startDate + _cliffPeriod, 0, 0);
            _idToVesting[_idVesting].totalLinearBlock = block.number + _linearDuration;
        } else {
            require(_linearDuration == 0, "Vesting/setVestingSchedule: schedule monthly linear duration must be zero");
            _idToVesting[_idVesting].schedule = Schedule(_startDate, _startDate + _cliffPeriod, _interval, _milestones);
        }

        emit SetVestingSchedule(_idVesting, _startDate, _startDate + _cliffPeriod, _interval, _milestones, _linearDuration);
    }

    function editVestingSchedule(
        uint32 _idVesting,
        uint32 _startDate,
        uint32 _cliffPeriod,
        uint32 _interval,
        uint32 _milestones,
        uint32 _linearDuration
    ) public onlyOwner isVestingScheduled(_idVesting) {
        Schedule memory schedule = _idToVesting[_idVesting].schedule;
        require((block.timestamp / SECONDS_PER_DAY) < schedule.startDate, "Vesting/editVestingSchedule: only edit schedule before vesting started");

        if(_idToVesting[_idVesting].vestingType == Type.Linearly) {
            require(_startDate != schedule.startDate ||
            (_startDate + _cliffPeriod) != schedule.cliffPeriodDate ||
            (block.number + _linearDuration) != _idToVesting[_idVesting].totalLinearBlock,
            "Vesting/editVestingSchedule: must edit at least one value of linearly vesting schedule");
        } else {
            require(_startDate != schedule.startDate ||
            (_startDate + _cliffPeriod) != schedule.cliffPeriodDate ||
            _interval != schedule.interval ||
            _milestones != schedule.milestones,
            "Vesting/editVestingSchedule: must edit at least one value of monthly vesting schedule");
        }

        if(_idToVesting[_idVesting].tge.tgeUnlockDate > 0) {
            require(_startDate < _idToVesting[_idVesting].tge.tgeUnlockDate, "Vesting/editVestingSchedule: new start date must before tge unlock date");
            require(( _startDate + _cliffPeriod) > _idToVesting[_idVesting].tge.tgeUnlockDate, 
            "Vesting/editVestingSchedule: new cliff period date must after tge unlock date");
        }

        setVestingSchedule(_idVesting, _startDate, _cliffPeriod, _interval, _milestones, _linearDuration);
    }

    function setTGEUnlock(uint32 _idVesting, uint32 _percent, uint32 _tgeDate) public onlyOwner isVestingScheduled(_idVesting){
        require(_percent > 0, "Vesting/setTGEUnlock: TGE unlock percent must greater than 0");
        Schedule memory _schedule = _idToVesting[_idVesting].schedule;
        require((block.timestamp / SECONDS_PER_DAY) < _schedule.startDate, "Vesting/setTGEUnlock: only set up TGE before start date");
        require(_tgeDate < _schedule.cliffPeriodDate, "Vesting/setTGEUnlock: TGE unlock date must before cliff period date");
        _idToVesting[_idVesting].tge = TGE(_percent, _tgeDate);
        emit SetTGE(_idVesting, _percent, _tgeDate);
    }

    function editTGEUnlock(uint32 _idVesting, uint32 _percent, uint32 _tgeDate) public onlyOwner isVestingScheduled(_idVesting) {
        TGE memory tge = _idToVesting[_idVesting].tge;
        Schedule memory schedule = _idToVesting[_idVesting].schedule;
        require((block.timestamp / SECONDS_PER_DAY) < schedule.startDate, "Vesting/editTGEUnlock: only edit tge before vesting started");
        require(tge.tgeUnlockPercent > 0, "Vesting/editTGEUnlock: TGE was not set before");
        require(schedule.startDate < _tgeDate, "Vesting/editVestingSchedule: new tge unlock must after start date");
        require(schedule.cliffPeriodDate > _tgeDate, 
        "Vesting/editVestingSchedule: new tge unlock must before cliff period date");
        require(_percent != tge.tgeUnlockPercent || _tgeDate != tge.tgeUnlockDate, "Vesting/editVestingSchedule: must edit at least one value of tge");

        setTGEUnlock(_idVesting, _percent, _tgeDate);
    }

    function addOneUser(uint32 _idVesting, address account, uint256 amount)
        public
        onlyOwner
        isVestingScheduled(_idVesting)
    {
        require(amount > 0, "Vesting/addOneUser: insufficient amount");
        VestingModel storage _vestingModel = _idToVesting[_idVesting];
        require(block.timestamp / SECONDS_PER_DAY < _vestingModel.schedule.startDate, "Vesting/addOneUser: can not add subscriber after vesting started");
        require(_vestingModel.users[account].amount == 0, "Vesting/addOneUser: user is already in vesting");
        require(_vestingModel.totalSupply >= _vestingModel.totalAmountInvested + amount, "Vesting/addOneUser: not enough supply in pool");

        _vestingModel.totalAmountInvested += amount;
        _vestingModel.users[account] = User(amount, 0, 0, 0);
        emit AddUser(_idVesting, account, amount);
    }

    function addManyUser(uint32 _idVesting, address[] memory accounts, uint256[] memory amounts)
        public
        onlyOwner
    {
        require(
            accounts.length > 0 && amounts.length > 0,
            "Vesting/addManyUser: accounts and amounts list can not be null"
        );
        require(accounts.length == amounts.length, "Vesting/addManyUser: accounts and amounts's length should equal");

        for (uint256 index = 0; index < accounts.length; index++) {
            addOneUser(_idVesting, accounts[index], amounts[index]);
        }
    }

    function removeOneUser(uint32 _idVesting, address _account) public onlyOwner isUserInVesting(_idVesting, _account) {
        VestingModel storage _vestingModel = _idToVesting[_idVesting];
        require(_vestingModel.schedule.startDate >= uint32(block.timestamp / SECONDS_PER_DAY), "Vesting/removeUser: can't remove user when vesting started");
    
        _vestingModel.totalAmountInvested -= _vestingModel.users[_account].amount;

        delete _vestingModel.users[_account];

        emit RemoveUser(_idVesting, _account);
    }

    function removeManyUser(uint32 _idVesting, address[] memory accounts) external onlyOwner {
        for (uint256 index = 0; index < accounts.length; index++) {
            removeOneUser(_idVesting, accounts[index]);
        }
    }

    function vestingOf(uint32 _idVesting, address _u) external view returns (uint256 amount, uint256 amountClaimed, uint256 tgeAmountClaimed) {
        User memory _user = _idToVesting[_idVesting].users[_u];
        return (_user.amount, _user.amountClaimed, _user.tgeAmountClaimed);
    }

    function withdraw(uint32 _idVesting) external isUserInVesting(_idVesting, msg.sender) isVestingScheduled(_idVesting){
        uint32 releaseTime = uint32(block.timestamp / SECONDS_PER_DAY);
        VestingModel storage _vestingModel = _idToVesting[_idVesting];
        User storage _user = _vestingModel.users[msg.sender];
        uint256 possibleWithdrawAmount;

        if(_vestingModel.tge.tgeUnlockPercent > 0) {
            require(releaseTime >= _vestingModel.tge.tgeUnlockDate, "Vesting/withdraw: can not withdraw TGE token before TGE unlock date");
            if(_user.tgeAmountClaimed == 0) {
                uint256 tgeAmountClaim = (_user.amount * _vestingModel.tge.tgeUnlockPercent) / 100;
                possibleWithdrawAmount += tgeAmountClaim;
                _user.tgeAmountClaimed += tgeAmountClaim;
                emit WithdrawTGEUnlock(_idVesting, msg.sender, tgeAmountClaim);
            }
        } else {
            require(releaseTime >= _idToVesting[_idVesting].schedule.cliffPeriodDate, "Vesting/withdraw: cliffPeriod not expired");
        }

        Schedule memory _schedule = _idToVesting[_idVesting].schedule;

        uint256 vestedWithdrawAmount;

        if(_idToVesting[_idVesting].vestingType == Type.Monthly) {
            if (releaseTime >= _schedule.cliffPeriodDate + _schedule.interval * _schedule.milestones) {
                possibleWithdrawAmount += (_user.amount - (_user.amountClaimed + _user.tgeAmountClaimed));
            } else if (releaseTime >= _schedule.cliffPeriodDate) {

                uint32 milestonesVested = (releaseTime - _schedule.cliffPeriodDate) / _schedule.interval + 1;
                if(milestonesVested > _schedule.milestones) {
                    milestonesVested = _schedule.milestones;
                }
                vestedWithdrawAmount = (((_user.amount- _user.tgeAmountClaimed) * milestonesVested) / _schedule.milestones) - _user.amountClaimed;
                possibleWithdrawAmount += vestedWithdrawAmount;
            }
        } else {
            uint256 currentBlock = block.number;
            require(currentBlock > _user.lastBlockClaimed, "Vesting/withdraw: user last block claimed is invalid");
            if (currentBlock >= _idToVesting[_idVesting].totalLinearBlock) {
                vestedWithdrawAmount += (_user.amount - (_user.amountClaimed + _user.tgeAmountClaimed));
            } else {
                uint256 countBlockFromLastClaimed = currentBlock - _user.lastBlockClaimed;
                vestedWithdrawAmount = ((_user.amount- _user.tgeAmountClaimed) * countBlockFromLastClaimed) / _idToVesting[_idVesting].totalLinearBlock;
            }
            possibleWithdrawAmount += vestedWithdrawAmount;
            _user.lastBlockClaimed = currentBlock;
        }

        require(possibleWithdrawAmount > 0, "Vesting/withdraw: user withdraw zero token");

        _vestingModel.users[msg.sender].amountClaimed += vestedWithdrawAmount;

        _token.safeTransfer(msg.sender, possibleWithdrawAmount);

        emit WithdrawToken(_idVesting, msg.sender, possibleWithdrawAmount);
    }
}
