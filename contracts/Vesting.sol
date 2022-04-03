// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MUUV.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Vesting is Ownable {
    using SafeERC20 for IERC20;

    enum VestingType {
        MONTHLY,
        NEARLY
    }

    struct UserVestingInfo {
        uint256 amount;
        uint256 tgeUnlockPercentage;
        uint256 amountClaimed;
        uint256 cliffPeriod; // calculated by the number of blocks
        uint256 vestingDuration; // calculated by the number of unlock period
        VestingType vestingType;
        bool exist;
    }

    uint256 public unlockPeriod; // calculated by the number of blocks

    uint32 public constant SECONDS_PER_BLOCK = 3;

    IERC20 public token;

    uint256 public tgeTimestamp;

    uint256 public totalVesting;

    mapping(address => UserVestingInfo) public userToVesting;

    event AddUser(address indexed account, uint256 indexed amount);
    event RemoveUser(address indexed account);
    event Claim(address indexed account, uint256 indexed amount);

    constructor(
        address _token,
        uint256 _tgeTimestamp,
        uint256 _unlockPeriod
    ) {
        require(
            _token != address(0),
            "Vesting/constructor: Token address must not be zero address"
        );
        require(
            _tgeTimestamp > block.timestamp,
            "Vesting/constructor: TGE timestamp must be greater than block timestamp"
        );
        require(
            _unlockPeriod > 0,
            "Vesting/constructor: Unlock Period must be greater than zero"
        );

        token = IERC20(_token);
        tgeTimestamp = _tgeTimestamp;
        unlockPeriod = _unlockPeriod;
    }

    modifier mustNotAfterTge() {
        require(!afterTge(), "Vesting: TGE happened");
        _;
    }

    function afterTge() public view returns (bool) {
        if (block.timestamp < tgeTimestamp) return false;
        else return true;
    }

    function setTGETimestamp(uint256 _tgeTimestamp)
        public
        onlyOwner
        mustNotAfterTge
    {
        require(
            _tgeTimestamp > block.timestamp,
            "Vesting/constructor: TGE timestamp must be greater than block timestamp"
        );

        tgeTimestamp = _tgeTimestamp;
    }

    function addUser(
        address _account,
        uint256 _amount,
        uint256 _tgeUnlockPercentage,
        uint256 _cliffPeriod,
        uint256 _vestingDuration,
        VestingType _vestingType
    ) public onlyOwner {
        _addUser(
            _account,
            _amount,
            _tgeUnlockPercentage,
            _cliffPeriod,
            _vestingDuration,
            _vestingType
        );
    }

    function addManyUser(
        address[] memory _accounts,
        uint256[] memory _amounts,
        uint256[] memory _tgeUnlockPercentages,
        uint256[] memory _cliffPeriods,
        uint256[] memory _vestingDurations,
        VestingType[] memory _vestingTypes
    ) public onlyOwner {
        require(
            _accounts.length > 0 &&
                _accounts.length == _amounts.length &&
                _amounts.length == _tgeUnlockPercentages.length &&
                _tgeUnlockPercentages.length == _cliffPeriods.length &&
                _cliffPeriods.length == _vestingDurations.length &&
                _vestingDurations.length == _vestingTypes.length,
            "Vesting: Invalid parameters"
        );

        for (uint256 i = 0; i < _accounts.length; i++) {
            _addUser(
                _accounts[i],
                _amounts[i],
                _tgeUnlockPercentages[i],
                _cliffPeriods[i],
                _vestingDurations[i],
                _vestingTypes[i]
            );
        }
    }

    function _addUser(
        address _account,
        uint256 _amount,
        uint256 _tgeUnlockPercentage,
        uint256 _cliffPeriod,
        uint256 _vestingDuration,
        VestingType _vestingType
    ) internal {
        require(
            _account != address(0),
            "Vesting: User must be not zero address"
        );
        require(
            userToVesting[_account].exist == false,
            "Vesting: User already exists"
        );
        require(
            _tgeUnlockPercentage <= 100,
            "Vesting: TGE unlock percentage must be less than 100"
        );

        userToVesting[_account].amount = _amount;
        userToVesting[_account].tgeUnlockPercentage = _tgeUnlockPercentage;
        userToVesting[_account].cliffPeriod = _cliffPeriod;
        userToVesting[_account].vestingDuration = _vestingDuration;
        userToVesting[_account].vestingType = _vestingType;
        userToVesting[_account].exist = true;

        totalVesting += _amount;

        if (token.balanceOf(address(this)) < totalVesting) {
            token.safeTransferFrom(
                _msgSender(),
                address(this),
                totalVesting - token.balanceOf(address(this))
            );
        }

        emit AddUser(_account, _amount);
    }

    function removeUser(address _account) public onlyOwner {
        require(
            userToVesting[_account].exist == true,
            "Vesting: User does not exist"
        );

        token.safeTransfer(
            owner(),
            userToVesting[_account].amount -
                userToVesting[_account].amountClaimed
        );

        totalVesting -= (userToVesting[_account].amount -
            userToVesting[_account].amountClaimed);

        delete userToVesting[_account];

        emit RemoveUser(_account);
    }

    function claim() public {
        require(
            userToVesting[_msgSender()].exist == true,
            "Vesting: User does not exist"
        );

        uint256 claimableAmount = _getVestingClaimableAmount(_msgSender());

        require(claimableAmount > 0, "Vesting: Nothing to claim");

        userToVesting[_msgSender()].amountClaimed += claimableAmount;

        totalVesting -= claimableAmount;

        token.safeTransfer(_msgSender(), claimableAmount);

        emit Claim(_msgSender(), claimableAmount);
    }

    function getVestingClaimableAmount(address _user)
        external
        view
        returns (uint256)
    {
        return _getVestingClaimableAmount(_user);
    }

    function _getVestingClaimableAmount(address _user)
        internal
        view
        returns (uint256 claimableAmount)
    {
        UserVestingInfo memory info = userToVesting[_user];

        if (block.timestamp < tgeTimestamp) return 0;

        uint256 totalUnlock = (info.tgeUnlockPercentage * info.amount) / 100;

        if (info.vestingType == VestingType.NEARLY) {
            uint256 passedBlocks = (block.timestamp - tgeTimestamp) /
                SECONDS_PER_BLOCK;

            if (passedBlocks == 0) return totalUnlock;

            totalUnlock =
                totalUnlock +
                ((((100 - info.tgeUnlockPercentage) * info.amount) / 100) *
                    passedBlocks) /
                (unlockPeriod * info.vestingDuration);

            return totalUnlock - info.amountClaimed;
        } else if (info.vestingType == VestingType.MONTHLY) {
            uint256 passedBlocks = (block.timestamp - tgeTimestamp) /
                SECONDS_PER_BLOCK;

            if (passedBlocks == 0) return totalUnlock;

            uint256 passedPeriods = passedBlocks / unlockPeriod;

            totalUnlock =
                totalUnlock +
                ((((100 - info.tgeUnlockPercentage) * info.amount) / 100) *
                    passedPeriods) /
                info.vestingDuration;

            return totalUnlock - info.amountClaimed;
        }
    }
}
