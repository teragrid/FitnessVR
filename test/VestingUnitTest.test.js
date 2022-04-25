/** @format */

const { ethers } = require('hardhat');
const { expect } = require('chai');
const { time } = require('@openzeppelin/test-helpers');

const MONTHLY = 0;
const LINEARLY = 1;

describe('Vesting', async () => {
  let admin, user1, user2, user3, user4;
  let vesting;
  let muuv;

  let periodDuration = 5;
  let tgeTimestamp;

  let user1Amount = 1000;
  let user1TgeUnlockPercentage = 20;
  let user1CliffDuration = 100;
  let user1NumberOfPeriods = 10;
  let user1VestingType = MONTHLY;

  let user2Amount = 1000;
  let user2TgeUnlockPercentage = 20;
  let user2CliffDuration = 100;
  let user2NumberOfPeriods = 10;
  let user2VestingType = MONTHLY;

  let user3Amount = 2000;
  let user3TgeUnlockPercentage = 20;
  let user3CliffDuration = 100;
  let user3NumberOfPeriods = 10;
  let user3VestingType = LINEARLY;

  let user4Amount = 2000;
  let user4TgeUnlockPercentage = 20;
  let user4CliffDuration = 100;
  let user4NumberOfPeriods = 10;
  let user4VestingType = LINEARLY;

  let fromDeployToTge = 100;

  beforeEach(async () => {
    [admin, user1, user2, user3, user4, user5] = await ethers.getSigners();

    let MUUV = await ethers.getContractFactory('MUUV');
    muuv = await MUUV.connect(admin).deploy();

    let Vesting = await ethers.getContractFactory('Vesting');

    let blockNumber = await ethers.provider.getBlockNumber();
    let blockInfo = await ethers.provider.getBlock(blockNumber);
    let blockTimestamp = blockInfo.timestamp;

    tgeTimestamp = blockTimestamp + fromDeployToTge;

    vesting = await Vesting.connect(admin).deploy(muuv.address, tgeTimestamp, periodDuration);
  });

  it('Deploy successfully', async () => {
    expect(await vesting.token()).to.be.equal(muuv.address);
    expect(await vesting.periodDuration()).to.be.equal(periodDuration);
    expect(await vesting.tgeTimestamp()).to.be.equal(tgeTimestamp);
    expect(await vesting.totalVesting()).to.be.equal(0);
    expect(await vesting.owner()).to.be.equal(admin.address);
  });

  it('Check ownership role', async () => {
    await expect(vesting.connect(user1).addUser(user1.address, 0, 0, 0, 0, 0)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    await expect(
      vesting.connect(user1).addManyUser([user1.address], [0], [0], [0], [0], [0])
    ).to.be.revertedWith('Ownable: caller is not the owner');

    await expect(vesting.connect(user1).removeUser(user1.address)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    await expect(vesting.connect(user1).setTGETimestamp(0)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
  });

  it('Vesting: TGE happened', async () => {
    await ethers.provider.send('evm_increaseTime', [fromDeployToTge]);
    await expect(vesting.connect(admin).setTGETimestamp(tgeTimestamp + 100)).to.be.revertedWith(
      'Vesting: TGE happened'
    );
  });

  it('Vesting/constructor: TGE timestamp must be greater than block timestamp', async () => {
    await expect(vesting.connect(admin).setTGETimestamp(1)).to.be.revertedWith(
      'Vesting/constructor: TGE timestamp must be greater than block timestamp'
    );
  });

  it('Check addUser parameters', async () => {
    await expect(
      vesting.connect(admin).addUser('0x0000000000000000000000000000000000000000', 0, 0, 0, 0, 0)
    ).to.be.revertedWith('Vesting: User must be not zero address');

    await expect(
      vesting
        .connect(admin)
        .addUser(
          user1.address,
          0,
          user1TgeUnlockPercentage,
          user1CliffDuration,
          user1NumberOfPeriods,
          user1VestingType
        )
    ).to.be.revertedWith('Vesting: Amount must be greater than 100 wei');
    await expect(
      vesting
        .connect(admin)
        .addUser(
          user1.address,
          user1Amount,
          101,
          user1CliffDuration,
          user1NumberOfPeriods,
          user1VestingType
        )
    ).to.be.revertedWith('Vesting: TGE unlock percentage must be less than 100');
  });

  context('Check add and remove user', () => {
    beforeEach(async () => {
      await muuv.connect(admin).approve(vesting.address, '1000000000');
      await vesting
        .connect(admin)
        .addUser(
          user1.address,
          user1Amount,
          user1TgeUnlockPercentage,
          user1CliffDuration,
          user1NumberOfPeriods,
          user1VestingType
        );
    });

    it('Add user successfully', async () => {
      let user1Info = await vesting.userToVesting(user1.address);
      expect(parseInt(user1Info.amount)).to.be.equal(user1Amount);
      expect(parseInt(user1Info.tgeUnlockPercentage)).to.be.equal(user1TgeUnlockPercentage);
      expect(parseInt(user1Info.amountClaimed)).to.be.equal(0);
      expect(parseInt(user1Info.cliffDuration)).to.be.equal(user1CliffDuration);
      expect(parseInt(user1Info.numberOfPeriods)).to.be.equal(user1NumberOfPeriods);
      expect(parseInt(user1Info.vestingType)).to.be.equal(user1VestingType);
      expect(user1Info.exist).to.be.equal(true);

      expect(parseInt(await muuv.balanceOf(vesting.address))).to.be.equal(user1Amount);
      expect(parseInt(await vesting.totalVesting())).to.be.equal(user1Amount);
    });

    it('Check Vesting: User already exists', async () => {
      await expect(
        vesting
          .connect(admin)
          .addUser(
            user1.address,
            user1Amount,
            user1TgeUnlockPercentage,
            user1CliffDuration,
            user1NumberOfPeriods,
            user1VestingType
          )
      ).to.be.revertedWith('Vesting: User already exists');

      await expect(
        vesting
          .connect(admin)
          .addManyUser(
            [user1.address],
            [user1Amount],
            [user1TgeUnlockPercentage],
            [user1CliffDuration],
            [user1NumberOfPeriods],
            [user1VestingType]
          )
      ).to.be.revertedWith('Vesting: User already exists');
    });

    it('Add another user', async () => {
      await vesting
        .connect(admin)
        .addUser(
          user2.address,
          user2Amount,
          user2TgeUnlockPercentage,
          user2CliffDuration,
          user2NumberOfPeriods,
          user2VestingType
        );

      expect(parseInt(await muuv.balanceOf(vesting.address))).to.be.equal(
        user1Amount + user2Amount
      );
      expect(parseInt(await vesting.totalVesting())).to.be.equal(user1Amount + user2Amount);
    });

    it('Remove user successfully', async () => {
      await vesting
        .connect(admin)
        .addUser(
          user2.address,
          user2Amount,
          user2TgeUnlockPercentage,
          user2CliffDuration,
          user2NumberOfPeriods,
          user2VestingType
        );

      await vesting.connect(admin).removeUser(user1.address);

      expect(parseInt(await muuv.balanceOf(vesting.address))).to.be.equal(user2Amount);
      expect(parseInt(await vesting.totalVesting())).to.be.equal(user2Amount);

      let user1Info = await vesting.userToVesting(user1.address);

      expect(user1Info.exist).to.be.equal(false);
    });

    it('Add many user', async () => {
      await vesting
        .connect(admin)
        .addManyUser(
          [user3.address, user4.address],
          [user3Amount, user4Amount],
          [user3TgeUnlockPercentage, user4TgeUnlockPercentage],
          [user3CliffDuration, user4CliffDuration],
          [user3NumberOfPeriods, user4NumberOfPeriods],
          [user3VestingType, user4VestingType]
        );

      let user3Info = await vesting.userToVesting(user3.address);
      let user4Info = await vesting.userToVesting(user4.address);

      expect(parseInt(user3Info.amount)).to.be.equal(user3Amount);
      expect(parseInt(user3Info.tgeUnlockPercentage)).to.be.equal(user3TgeUnlockPercentage);
      expect(parseInt(user3Info.amountClaimed)).to.be.equal(0);
      expect(parseInt(user3Info.cliffDuration)).to.be.equal(user3CliffDuration);
      expect(parseInt(user3Info.numberOfPeriods)).to.be.equal(user3NumberOfPeriods);
      expect(parseInt(user3Info.vestingType)).to.be.equal(user3VestingType);
      expect(user3Info.exist).to.be.equal(true);

      expect(parseInt(user4Info.amount)).to.be.equal(user4Amount);
      expect(parseInt(user4Info.tgeUnlockPercentage)).to.be.equal(user4TgeUnlockPercentage);
      expect(parseInt(user4Info.amountClaimed)).to.be.equal(0);
      expect(parseInt(user4Info.cliffDuration)).to.be.equal(user4CliffDuration);
      expect(parseInt(user4Info.numberOfPeriods)).to.be.equal(user4NumberOfPeriods);
      expect(parseInt(user4Info.vestingType)).to.be.equal(user4VestingType);
      expect(user4Info.exist).to.be.equal(true);

      expect(parseInt(await muuv.balanceOf(vesting.address))).to.be.equal(
        user1Amount + user3Amount + user4Amount
      );

      expect(parseInt(await vesting.totalVesting())).to.be.equal(
        user1Amount + user3Amount + user4Amount
      );
    });
  });

  context('Check vesting process', () => {
    beforeEach(async () => {
      await muuv.connect(admin).approve(vesting.address, '1000000000');
      await vesting
        .connect(admin)
        .addManyUser(
          [user1.address, user2.address, user3.address, user4.address],
          [user1Amount, user2Amount, user3Amount, user4Amount],
          [
            user1TgeUnlockPercentage,
            user2TgeUnlockPercentage,
            user3TgeUnlockPercentage,
            user4TgeUnlockPercentage
          ],
          [user1CliffDuration, user2CliffDuration, user3CliffDuration, user4CliffDuration],
          [user1NumberOfPeriods, user2NumberOfPeriods, user3NumberOfPeriods, user4NumberOfPeriods],
          [user1VestingType, user2VestingType, user3VestingType, user4VestingType]
        );
    });

    it('Check claimable amount (MONTHLY)', async () => {
      let blockNumber = await ethers.provider.getBlockNumber();
      let blockInfo = await ethers.provider.getBlock(blockNumber);
      let blockTimestamp = blockInfo.timestamp;
      await ethers.provider.send('evm_increaseTime', [tgeTimestamp - blockTimestamp]);
      await ethers.provider.send('evm_mine'); // mine new empty block
      expect(parseInt(await vesting.getVestingClaimableAmount(user1.address))).to.be.equal(
        (user1Amount * user1TgeUnlockPercentage) / 100
      );

      await ethers.provider.send('evm_increaseTime', [user1CliffDuration]);
      await ethers.provider.send('evm_mine'); // mine new empty block
      expect(parseInt(await vesting.getVestingClaimableAmount(user1.address))).to.be.equal(
        (user1Amount * user1TgeUnlockPercentage) / 100
      );
    });

    it('Check claimable amount (LINEARLY)', async () => {
      let blockNumber = await ethers.provider.getBlockNumber();
      let blockInfo = await ethers.provider.getBlock(blockNumber);
      let blockTimestamp = blockInfo.timestamp;
      await ethers.provider.send('evm_increaseTime', [tgeTimestamp - blockTimestamp]);
      await ethers.provider.send('evm_mine'); // mine new empty block

      expect(parseInt(await vesting.getVestingClaimableAmount(user3.address))).to.be.equal(
        (user3Amount * user3TgeUnlockPercentage) / 100
      );

      await ethers.provider.send('evm_increaseTime', [user3CliffDuration]);
      await ethers.provider.send('evm_mine'); // mine new empty block
      expect(parseInt(await vesting.getVestingClaimableAmount(user3.address))).to.be.equal(
        (user3Amount * user3TgeUnlockPercentage) / 100
      );
    });

    it('Claim at tge (MONTHLY)', async () => {
      let blockNumber = await ethers.provider.getBlockNumber();
      let blockInfo = await ethers.provider.getBlock(blockNumber);
      let blockTimestamp = blockInfo.timestamp;
      await ethers.provider.send('evm_increaseTime', [tgeTimestamp - blockTimestamp]);

      await vesting.connect(user1).claim();

      let user1Info = await vesting.userToVesting(user1.address);

      expect(parseInt(user1Info.amountClaimed)).to.be.equal(
        (user1Amount * user1TgeUnlockPercentage) / 100
      );

      expect(parseInt(await vesting.getVestingClaimableAmount(user1.address))).to.be.equal(0);

      await ethers.provider.send('evm_increaseTime', [user1CliffDuration]);
      await ethers.provider.send('evm_mine'); // mine new empty block
      expect(parseInt(await vesting.getVestingClaimableAmount(user1.address))).to.be.equal(0);
    });

    it('Claim at tge (LINEARLY)', async () => {
      let blockNumber = await ethers.provider.getBlockNumber();
      let blockInfo = await ethers.provider.getBlock(blockNumber);
      let blockTimestamp = blockInfo.timestamp;
      await ethers.provider.send('evm_increaseTime', [tgeTimestamp - blockTimestamp]);

      await vesting.connect(user3).claim();

      let user3Info = await vesting.userToVesting(user3.address);

      expect(parseInt(user3Info.amountClaimed)).to.be.equal(
        (user3Amount * user1TgeUnlockPercentage) / 100
      );

      expect(parseInt(await vesting.getVestingClaimableAmount(user3.address))).to.be.equal(0);

      await ethers.provider.send('evm_increaseTime', [user3CliffDuration]);
      await ethers.provider.send('evm_mine'); // mine new empty block
    });

    it('Claim after cliff (MONTHLY) case 1', async () => {
      let totalVestingBefore = parseInt(await vesting.totalVesting());

      let periodNo = 5;

      let blockNumber = await ethers.provider.getBlockNumber();
      let blockInfo = await ethers.provider.getBlock(blockNumber);
      let blockTimestamp = blockInfo.timestamp;
      await ethers.provider.send('evm_increaseTime', [
        tgeTimestamp - blockTimestamp + user1CliffDuration + periodNo * periodDuration
      ]);

      await ethers.provider.send('evm_mine'); // mine new empty block

      expect(parseInt(await vesting.getVestingClaimableAmount(user1.address))).to.be.equal(
        (user1Amount * user1TgeUnlockPercentage) / 100 +
          ((100 - user1TgeUnlockPercentage) * user1Amount * periodNo) / (100 * user1NumberOfPeriods)
      );

      await vesting.connect(user1).claim();
      expect(parseInt(await muuv.balanceOf(user1.address))).to.be.equal(
        (user1Amount * user1TgeUnlockPercentage) / 100 +
          ((100 - user1TgeUnlockPercentage) * user1Amount * periodNo) / (100 * user1NumberOfPeriods)
      );

      await ethers.provider.send('evm_increaseTime', [
        (user1NumberOfPeriods - periodNo) * periodDuration
      ]);

      await ethers.provider.send('evm_mine'); // mine new empty block

      expect(parseInt(await vesting.getVestingClaimableAmount(user1.address))).to.be.equal(
        ((100 - user1TgeUnlockPercentage) * user1Amount * (user1NumberOfPeriods - periodNo)) /
          (100 * user1NumberOfPeriods)
      );

      await vesting.connect(user1).claim();
      expect(parseInt(await muuv.balanceOf(user1.address))).to.be.equal(user1Amount);

      expect(parseInt(await vesting.totalVesting())).to.be.equal(totalVestingBefore - user1Amount);

      await ethers.provider.send('evm_increaseTime', [1000000000]);

      await ethers.provider.send('evm_mine'); // mine new empty block

      expect(parseInt(await vesting.getVestingClaimableAmount(user1.address))).to.be.equal(0);
    });

    it('Claim after cliff (MONTHLY) case 2', async () => {
      let totalVestingBefore = parseInt(await vesting.totalVesting());

      let blockNumber = await ethers.provider.getBlockNumber();
      let blockInfo = await ethers.provider.getBlock(blockNumber);
      let blockTimestamp = blockInfo.timestamp;
      await ethers.provider.send('evm_increaseTime', [
        tgeTimestamp - blockTimestamp + user1CliffDuration + user1NumberOfPeriods * periodDuration
      ]);

      await ethers.provider.send('evm_mine'); // mine new empty block

      expect(parseInt(await vesting.getVestingClaimableAmount(user1.address))).to.be.equal(
        user1Amount
      );

      await vesting.connect(user1).claim();
      expect(parseInt(await muuv.balanceOf(user1.address))).to.be.equal(user1Amount);

      expect(parseInt(await vesting.totalVesting())).to.be.equal(totalVestingBefore - user1Amount);

      await ethers.provider.send('evm_increaseTime', [1000000000]);

      await ethers.provider.send('evm_mine'); // mine new empty block

      expect(parseInt(await vesting.getVestingClaimableAmount(user1.address))).to.be.equal(0);
    });

    it('Claim after cliff (LINEARLY) case 1', async () => {
      let totalVestingBefore = parseInt(await vesting.totalVesting());

      let periodNo = 5;

      let secondNo = 3;

      let blockNumber = await ethers.provider.getBlockNumber();
      let blockInfo = await ethers.provider.getBlock(blockNumber);
      let blockTimestamp = blockInfo.timestamp;
      await ethers.provider.send('evm_increaseTime', [
        tgeTimestamp - blockTimestamp + user3CliffDuration + periodNo * periodDuration + secondNo
      ]);

      await ethers.provider.send('evm_mine'); // mine new empty block

      expect(parseInt(await vesting.getVestingClaimableAmount(user3.address))).to.be.equal(
        parseInt(
          (user3Amount * user3TgeUnlockPercentage) / 100 +
            (((100 - user3TgeUnlockPercentage) * user3Amount) / 100) *
              ((periodNo * periodDuration + secondNo) / (user3NumberOfPeriods * periodDuration))
        )
      );
      await vesting.connect(user3).claim();
      expect(parseInt(await muuv.balanceOf(user3.address))).to.be.equal(
        parseInt(
          (user3Amount * user3TgeUnlockPercentage) / 100 +
            (((100 - user3TgeUnlockPercentage) * user3Amount) / 100) *
              ((periodNo * periodDuration + secondNo) / (user3NumberOfPeriods * periodDuration))
        )
      );

      await ethers.provider.send('evm_increaseTime', [
        (user3NumberOfPeriods - periodNo) * periodDuration
      ]);

      await ethers.provider.send('evm_mine'); // mine new empty block

      await vesting.connect(user3).claim();
      expect(parseInt(await muuv.balanceOf(user3.address))).to.be.equal(user3Amount);
      expect(parseInt(await vesting.totalVesting())).to.be.equal(totalVestingBefore - user3Amount);

      await ethers.provider.send('evm_increaseTime', [1000000000]);

      await ethers.provider.send('evm_mine'); // mine new empty block
      expect(parseInt(await vesting.getVestingClaimableAmount(user3.address))).to.be.equal(0);
    });

    it('Claim after cliff (MONTHLY) case 2', async () => {
      let totalVestingBefore = parseInt(await vesting.totalVesting());

      let blockNumber = await ethers.provider.getBlockNumber();
      let blockInfo = await ethers.provider.getBlock(blockNumber);
      let blockTimestamp = blockInfo.timestamp;
      await ethers.provider.send('evm_increaseTime', [
        tgeTimestamp - blockTimestamp + user1CliffDuration + user3NumberOfPeriods * periodDuration
      ]);

      await ethers.provider.send('evm_mine'); // mine new empty block

      expect(parseInt(await vesting.getVestingClaimableAmount(user3.address))).to.be.equal(
        user3Amount
      );

      await vesting.connect(user3).claim();
      expect(parseInt(await muuv.balanceOf(user3.address))).to.be.equal(user3Amount);

      expect(parseInt(await vesting.totalVesting())).to.be.equal(totalVestingBefore - user3Amount);

      await ethers.provider.send('evm_increaseTime', [1000000000]);

      await ethers.provider.send('evm_mine'); // mine new empty block
      expect(parseInt(await vesting.getVestingClaimableAmount(user3.address))).to.be.equal(0);
    });

    it('Remove user', async () => {
      await vesting.connect(admin).removeUser(user2.address);
      await expect(vesting.connect(user2).claim()).to.be.revertedWith(
        'Vesting: User does not exist'
      );
    });
  });
});
