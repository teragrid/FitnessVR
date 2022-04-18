// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./MUUV.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract Staking is AccessControl {
    using SafeERC20 for IERC20;

    IERC20 private _MUUVToken;
    uint256 private _enableStakeDate;
    uint256 private _disableStakingDate;
    uint256 private _totalRewardToken;
    uint32 private constant SECONDS_PER_DAY = 24 * 60 * 60;
    bytes32 public constant STAKER_ROLE = keccak256("STAKER_ROLE");
    
    struct StakingModel {
        uint256 amount;
        uint256 amountClaimed;
        uint256 totalReward;
        uint256 startStakingTime;
        uint256 lastMilestoneClaimed;
        uint256 totalMonthStake;
        uint256 interval;
        uint256 apy;
    }

    mapping (address => StakingModel[]) private _stakingInfo;

    event Claimed(address user, uint256 amount, uint256 stakeId);
    event Staked(address user, uint256 amount, uint256 stakeId);

    constructor(address token, uint256 enableStakeDate, uint256 disableStakingDate) {
        require(token != address(0), "Staking/constructor: token address must not be 0");
        require(enableStakeDate > block.timestamp, "Staking/constructor: period date must after current time");
        require(disableStakingDate > enableStakeDate, "Staking/constructor: stop staking date must after period date");
        _MUUVToken = IERC20(token);
        _enableStakeDate = enableStakeDate;
        _disableStakingDate = disableStakingDate;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function stake(uint256 _amount, uint256 _apy, uint256 _totalMonthStake, uint256 _interval) external {
        require(block.timestamp > _enableStakeDate, "Staking/stake: must stake before start enable stake date");
        require(block.timestamp < _disableStakingDate, "Staking/stake: must stake after start disable stake date");
        require(_amount > 0 && _apy > 0 && _totalMonthStake > 0 && _totalMonthStake > _interval, "Staking/stake: invalid params input");
        require(_totalMonthStake % _interval == 0, "Staking/stake: interval must be divisor of duration");
        
        uint256 milestones = _totalMonthStake / _interval;
        uint256 _apyPerInterval = (_apy * 1e12) / milestones;
        uint256 totalReward;
        for(uint256 i = 1; i <= milestones; i++) {
            totalReward = totalReward + ((_amount + totalReward) * _apyPerInterval) / (1e12 * 100);
        }
        totalReward += _amount;

        require(_MUUVToken.balanceOf(address(this)) >= _totalRewardToken + totalReward, "Staking/stake: not enough reward for this stake");

        _totalRewardToken += totalReward;
        _stakingInfo[msg.sender].push(StakingModel(_amount, 0, totalReward, block.timestamp, 0, _totalMonthStake, _interval, _apy));
        uint256 _stakeId = _stakingInfo[msg.sender].length - 1;
        _MUUVToken.safeTransferFrom(msg.sender, address(this), _amount);
        _grantRole(STAKER_ROLE, msg.sender);
        emit Staked(msg.sender, _amount, _stakeId);
    }
    
    function stakeInfo(address user, uint256 _stakeId) external view returns (uint256 amount, uint256 amountClaimed, uint256 totalReward, uint256 milestones,uint256 lastmilestones) {
        StakingModel storage stakingModel = _stakingInfo[user][_stakeId];
        return (stakingModel.amount, stakingModel.amountClaimed, stakingModel.totalReward, stakingModel.totalMonthStake / stakingModel.interval, stakingModel.lastMilestoneClaimed);
    }

    function claim(uint256 _stakeId) external onlyRole(STAKER_ROLE) {
        uint256 amountClaimed = _calculateClaimToken(_stakeId);
        if(amountClaimed > 0) {
            _MUUVToken.safeTransfer(msg.sender, amountClaimed);
            emit Claimed(msg.sender, amountClaimed, _stakeId);
        }
    }

    function _calculateClaimToken(uint256 _stakeId) internal returns (uint256 amount) {
        StakingModel storage stakingModel = _stakingInfo[msg.sender][_stakeId];
        require(block.timestamp > stakingModel.startStakingTime, "Staking/_calculateClaimToken: current claim must after start staking time");
        uint256 totalClaim;
        uint256 passedPeriod;
        uint256 milestones = stakingModel.totalMonthStake/ stakingModel.interval;
        uint256 currrentMilestone = (block.timestamp - stakingModel.startStakingTime) / (stakingModel.interval * 30 * SECONDS_PER_DAY);
        if(stakingModel.lastMilestoneClaimed == 0) {
            passedPeriod = (block.timestamp - stakingModel.startStakingTime) / (stakingModel.interval * 30 * SECONDS_PER_DAY);
            if(passedPeriod > milestones) {
                passedPeriod = milestones;
                currrentMilestone = milestones;
            }
            totalClaim = (stakingModel.totalReward * passedPeriod)/milestones;
        } else {
            if((block.timestamp - stakingModel.startStakingTime) / (stakingModel.interval * 30 * SECONDS_PER_DAY) >= milestones) {
                passedPeriod = milestones - stakingModel.lastMilestoneClaimed;
                currrentMilestone = milestones;
            } else {
                passedPeriod = currrentMilestone - stakingModel.lastMilestoneClaimed;
            }
            totalClaim = (stakingModel.totalReward * passedPeriod)/milestones;
        }

        stakingModel.amountClaimed += totalClaim;
        stakingModel.lastMilestoneClaimed = currrentMilestone;
        return totalClaim;
    }

}