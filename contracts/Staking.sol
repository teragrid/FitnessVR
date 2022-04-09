// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./MUUV.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract Staking is AccessControl {
    using SafeERC20 for IERC20;

    uint32 private constant SECONDS_PER_DAY = 24 * 60 * 60;
    IERC20 private _MUUVToken;
    uint256 private _enableStakeDate;
    uint256 private _disableStakingDate;
    bytes32 public constant STAKER_ROLE = keccak256("STAKER_ROLE");
    
    struct StakingModel {
        uint256 amount;
        uint256 amountClaimed;
        uint256 totalReward;
        uint256 startStakingTime;
        uint256 lastClaimedTime;
        uint256 totalMonthStake;
        uint256 apy;
        uint256 stakingId;
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

    function stake(uint256 _amount, uint256 _apy, uint256 _duration) external {
        require(block.timestamp > _enableStakeDate, "Staking/stake: must stake before start enable stake date");
        require(block.timestamp < _disableStakingDate, "Staking/stake: must stake after start disable stake date");
        require(_amount > 0 && _apy > 0 && _duration > 0, "Staking/stake: invalid params input");
        
        uint256 _stakeId;
        if(_stakingInfo[msg.sender].length > 0) {
            _stakeId = _stakingInfo[msg.sender][_stakingInfo[msg.sender].length - 1].stakingId + 1;
        }
        uint256 _apyPerMonth = (_apy * 1e12) / _duration;
        uint256 totalReward;
        for(uint256 i = 1; i <= _duration; i++) {
            totalReward = totalReward + ((_amount + totalReward) * _apyPerMonth) / (1e12 * 100);
        }
        totalReward += _amount;

        _stakingInfo[msg.sender].push(StakingModel(_amount, 0, totalReward, block.timestamp, 0, _duration, _apy, _stakeId));
        _MUUVToken.safeTransferFrom(msg.sender, address(this), _amount);
        _grantRole(STAKER_ROLE, msg.sender);
        emit Staked(msg.sender, _amount, _stakeId);
    }
    
    function stakeInfo(address user, uint256 _stakeId) external view returns (uint256 amount, uint256 amountClaimed, uint256 totalReward) {
        StakingModel storage stakingModel = _stakingInfo[user][_stakeId];
        return (stakingModel.amount, stakingModel.amountClaimed, stakingModel.totalReward);
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
        if(stakingModel.lastClaimedTime == 0) {
            passedPeriod = (block.timestamp - stakingModel.startStakingTime) / (30 * SECONDS_PER_DAY);
            if(passedPeriod > stakingModel.totalMonthStake) {
                passedPeriod = stakingModel.totalMonthStake;
            }
        } else {
            uint256 totalPeriodClaimed = stakingModel.amountClaimed / (stakingModel.totalReward/ stakingModel.totalMonthStake);
            if((block.timestamp - stakingModel.lastClaimedTime) / (30 * SECONDS_PER_DAY) + totalPeriodClaimed >= stakingModel.totalMonthStake) {
                passedPeriod = stakingModel.totalMonthStake - totalPeriodClaimed;
            } else {
                passedPeriod = (block.timestamp - stakingModel.lastClaimedTime) / (30 * SECONDS_PER_DAY);
            }
        }

        totalClaim += (stakingModel.totalReward * passedPeriod)/stakingModel.totalMonthStake;
        stakingModel.amountClaimed += totalClaim;
        stakingModel.lastClaimedTime = block.timestamp;
        return totalClaim;
    }

}