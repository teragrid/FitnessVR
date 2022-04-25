const { ethers } = require('hardhat');
const { expect } = require('chai');
const { time, expectRevert } = require('@openzeppelin/test-helpers');

describe('Test LP Farming', async () => {
  let farm, uniPair, muuv, busd, vesting;
  let deployer, alice, bob, jack;
  let startBlock;

  let aliceMuuvBeforeBalance = '1000000000000000000000000';
  let bobLPBeforeBalance = '1000000000000000000';
  let jackLPBeforeBalance = '1000000000000000000';

  let amountToFarm = '2000000000000000000000';
  let rewardPerBlock = '2000000000000000000';

  let firstCycleRate = 6;
  let initRate = 3;
  let reducingRate = 95;
  let reducingCycle = 195000;

  let percentForVesting = 100;
  let vestingDuration = 1170000;
  beforeEach(async () => {
    [deployer, alice, bob, jack] = await ethers.getSigners();

    let TestERC20 = await ethers.getContractFactory('TestERC20');
    muuv = await TestERC20.connect(deployer).deploy('MUUV', 'MUUV');

    let BUSD = await ethers.getContractFactory('MockBUSD');
    busd = await BUSD.connect(deployer).deploy();

    let MockUniV2Pair = await ethers.getContractFactory('MockUniV2Pair');
    uniPair = await MockUniV2Pair.connect(deployer).deploy(
      'MUUV-BUSD LP',
      'MUUV-BUSD',
      muuv.address,
      busd.address
    );

    startBlock = parseInt(await time.latestBlock()) + 100;

    let Farm = await ethers.getContractFactory('Farm');
    farm = await Farm.connect(deployer).deploy();

    await muuv.connect(deployer).mint(deployer.address, amountToFarm);
    await muuv.connect(deployer).approve(farm.address, amountToFarm);

    await farm.connect(deployer).init(
      muuv.address,
      amountToFarm, // 2000 muuv
      uniPair.address,
      rewardPerBlock, // 2 muuv / block
      startBlock,
      [firstCycleRate, initRate, reducingRate, reducingCycle],
      [percentForVesting, vestingDuration]
    );

    vesting = await ethers.getContractAt('FarmVesting', await farm.vesting());
  });

  it('All setup successfully', async () => {
    expect(await farm.lpToken()).to.be.equal(uniPair.address);
    expect(await farm.rewardToken()).to.be.equal(muuv.address);
    expect(parseInt(await farm.startBlock())).to.be.equal(startBlock);
    expect(parseInt(await farm.rewardPerBlock())).to.be.equal(parseInt(rewardPerBlock));
    expect(parseInt(await farm.lastRewardBlock())).to.be.equal(startBlock);
    expect(parseInt(await farm.accRewardPerShare())).to.be.equal(0);
    expect(parseInt(await farm.farmerCount())).to.be.equal(0);
    expect(parseInt(await farm.firstCycleRate())).to.be.equal(firstCycleRate);
    expect(parseInt(await farm.initRate())).to.be.equal(initRate);
    expect(parseInt(await farm.reducingRate())).to.be.equal(reducingRate);
    expect(parseInt(await farm.reducingCycle())).to.be.equal(reducingCycle);
    expect(parseInt(await farm.percentForVesting())).to.be.equal(percentForVesting);
  });

  describe('Check multiplier', async () => {
    it('Check multiplier from startBlock to startBlock', async () => {
      expect(parseInt(await farm.getMultiplier(startBlock, startBlock))).to.be.equal(0);
    });

    it('Check multiplier from startBlock to startBlock + 1', async () => {
      expect(parseInt(await farm.getMultiplier(startBlock, startBlock + 1))).to.be.equal(
        firstCycleRate * 1e12 * 1
      );
    });

    it('Check multiplier from startBlock to startBlock + reducingCycle - 1', async () => {
      expect(
        parseInt(await farm.getMultiplier(startBlock, startBlock + reducingCycle - 1))
      ).to.be.equal(firstCycleRate * 1e12 * (reducingCycle - 1));
    });

    it('Check multiplier from startBlock to startBlock + reducingCycle', async () => {
      expect(
        parseInt(await farm.getMultiplier(startBlock, startBlock + reducingCycle))
      ).to.be.equal(firstCycleRate * 1e12 * reducingCycle);
    });

    it('Check multiplier from startBlock to startBlock + reducingCycle + 100', async () => {
      expect(
        parseInt(await farm.getMultiplier(startBlock, startBlock + reducingCycle + 100))
      ).to.be.equal(firstCycleRate * 1e12 * reducingCycle + 100 * initRate * 1e12);
    });

    it('Check multiplier from startBlock to startBlock + reducingCycle * 2', async () => {
      expect(
        parseInt(await farm.getMultiplier(startBlock, startBlock + reducingCycle * 2))
      ).to.be.equal(firstCycleRate * 1e12 * reducingCycle + initRate * 1e12 * reducingCycle);
    });

    it('Check multiplier from startBlock to startBlock + reducingCycle * 2 + 1000', async () => {
      expect(
        parseInt(await farm.getMultiplier(startBlock, startBlock + reducingCycle * 2 + 1000))
      ).to.be.equal(
        firstCycleRate * 1e12 * reducingCycle +
          initRate * 1e12 * reducingCycle +
          ((1e12 * initRate * reducingRate) / 100) * 1000
      );
    });

    it('Check multiplier from startBlock + reducingCycle + 1 to startBlock + reducingCycle * 2 + 1000', async () => {
      expect(
        parseInt(
          await farm.getMultiplier(
            startBlock + reducingCycle + 1,
            startBlock + reducingCycle * 2 + 1000
          )
        )
      ).to.be.equal(
        parseInt(await farm.getMultiplier(startBlock, startBlock + reducingCycle * 2 + 1000)) -
          parseInt(await farm.getMultiplier(startBlock, startBlock + reducingCycle + 1))
      );
    });
  });

  it('Bob deposit successfully first and only bob in pool', async () => {
    await uniPair.connect(deployer).mint(bob.address, bobLPBeforeBalance);
    await uniPair.connect(bob).approve(farm.address, bobLPBeforeBalance);
    await farm.connect(bob).deposit(bobLPBeforeBalance);
    await time.advanceBlockTo(startBlock + 10);

    expect(parseInt(await farm.pendingReward(bob.address))).to.be.equal(
      10 * firstCycleRate * parseInt(rewardPerBlock)
    );
  });

  it('Bob and Jack deposit successfully before startBlock comes', async () => {
    await uniPair.connect(deployer).mint(bob.address, bobLPBeforeBalance);
    await uniPair.connect(bob).approve(farm.address, bobLPBeforeBalance);

    await uniPair.connect(deployer).mint(jack.address, jackLPBeforeBalance);
    await uniPair.connect(jack).approve(farm.address, jackLPBeforeBalance);

    await farm.connect(bob).deposit(bobLPBeforeBalance);
    await farm.connect(jack).deposit(jackLPBeforeBalance);

    await time.advanceBlockTo(startBlock + 10);
    expect(parseInt(await farm.pendingReward(bob.address))).to.be.equal(
      parseInt(await farm.pendingReward(jack.address))
    );
  });

  it('Bob and Jack deposit successfully first before startBlock comes', async () => {
    await uniPair.connect(deployer).mint(bob.address, bobLPBeforeBalance);
    await uniPair.connect(bob).approve(farm.address, bobLPBeforeBalance);

    await uniPair.connect(deployer).mint(jack.address, jackLPBeforeBalance);
    await uniPair.connect(jack).approve(farm.address, jackLPBeforeBalance);

    await farm.connect(bob).deposit(bobLPBeforeBalance);
    await farm.connect(jack).deposit(jackLPBeforeBalance);

    await time.advanceBlockTo(startBlock + 1);
    expect(parseInt(await farm.pendingReward(bob.address))).to.be.equal(
      (firstCycleRate * parseInt(rewardPerBlock)) / 2
    );
    await time.advanceBlockTo(startBlock + 10);
    expect(parseInt(await farm.pendingReward(bob.address))).to.be.equal(
      (10 * firstCycleRate * parseInt(rewardPerBlock)) / 2
    );
  });

  it('Bob deposit successfully before startBlock comes, Jack deposit successfully at startBlock + 10', async () => {
    await uniPair.connect(deployer).mint(bob.address, bobLPBeforeBalance);
    await uniPair.connect(bob).approve(farm.address, bobLPBeforeBalance);

    await uniPair.connect(deployer).mint(jack.address, jackLPBeforeBalance);
    await uniPair.connect(jack).approve(farm.address, jackLPBeforeBalance);

    await farm.connect(bob).deposit(bobLPBeforeBalance);
    await time.advanceBlockTo(startBlock + 10);

    expect(parseInt(await farm.pendingReward(bob.address))).to.be.equal(
      rewardPerBlock * firstCycleRate * 10
    );

    await farm.connect(jack).deposit(jackLPBeforeBalance);
    await time.advanceBlockTo(startBlock + 20);

    let bobReward = parseInt(await farm.pendingReward(bob.address));
    let jackReward = parseInt(await farm.pendingReward(jack.address));

    expect(bobReward / jackReward).to.be.gt(
      (parseInt(bobLPBeforeBalance) * 20) / (parseInt(jackLPBeforeBalance) * 10)
    );
  });

  it('Bob deposits first time successfully, second time', async () => {
    await uniPair
      .connect(deployer)
      .mint(bob.address, (2 * parseInt(bobLPBeforeBalance)).toString());
    await uniPair.connect(bob).approve(farm.address, (2 * parseInt(bobLPBeforeBalance)).toString());

    await farm.connect(bob).deposit(bobLPBeforeBalance);
    await time.advanceBlockTo(startBlock + 10);

    let bobPendingReward = parseInt(await farm.pendingReward(bob.address));
    expect(bobPendingReward).to.be.equal(10 * firstCycleRate * parseInt(rewardPerBlock));

    await farm.connect(bob).deposit(bobLPBeforeBalance);

    expect(parseInt(await farm.pendingReward(bob.address))).to.be.equal(0);
    expect(parseInt(await muuv.balanceOf(vesting.address))).to.be.equal(
      ((bobPendingReward + 1 * firstCycleRate * parseInt(rewardPerBlock)) * percentForVesting) / 100
    );
  });

  it('Bob deposits successfully, when he deposit seconde time, muuv in Farm less than his pendingReward', async () => {
    await uniPair
      .connect(deployer)
      .mint(bob.address, (2 * parseInt(bobLPBeforeBalance)).toString());
    await uniPair.connect(bob).approve(farm.address, (2 * parseInt(bobLPBeforeBalance)).toString());

    await farm.connect(bob).deposit(bobLPBeforeBalance);
    await time.advanceBlockTo(startBlock + 10);

    let bobPendingReward = parseInt(await farm.pendingReward(bob.address));

    await farm
      .connect(deployer)
      .rescueFunds(muuv.address, deployer.address, '1890000000000000000000');

    let farmRewardBalance = parseInt(await muuv.balanceOf(farm.address));

    expect(farmRewardBalance).to.be.lt(bobPendingReward);

    await farm.connect(bob).deposit(0);
    expect(parseInt(await muuv.balanceOf(vesting.address))).to.be.equal(
      (farmRewardBalance * percentForVesting) / 100
    );

    expect(parseInt(await vesting.getTotalAmountLockedByUser(bob.address))).to.be.equal(
      farmRewardBalance
    );
  });

  it('Bob deposits successfully, when he withdraw, muuv in Farm less than his pendingReward', async () => {
    await uniPair
      .connect(deployer)
      .mint(bob.address, (2 * parseInt(bobLPBeforeBalance)).toString());
    await uniPair.connect(bob).approve(farm.address, (2 * parseInt(bobLPBeforeBalance)).toString());

    await farm.connect(bob).deposit(bobLPBeforeBalance);
    await time.advanceBlockTo(startBlock + 10);

    let bobPendingReward = parseInt(await farm.pendingReward(bob.address));

    await farm
      .connect(deployer)
      .rescueFunds(muuv.address, deployer.address, '1890000000000000000000');

    let farmRewardBalance = parseInt(await muuv.balanceOf(farm.address));

    expect(farmRewardBalance).to.be.lt(bobPendingReward);

    await farm.connect(bob).deposit(0);
    expect(parseInt(await muuv.balanceOf(vesting.address))).to.be.equal(
      (farmRewardBalance * percentForVesting) / 100
    );

    expect(parseInt(await vesting.getTotalAmountLockedByUser(bob.address))).to.be.equal(
      farmRewardBalance
    );
  });

  it('Only farm owner can call updateReducingRate updatePercentForVesting forceEnd transferOwnership', async () => {
    await expectRevert(
      farm.connect(bob).updatePercentForVesting(90),
      'Ownable: caller is not the owner'
    );
    await expectRevert(farm.connect(bob).forceEnd(), 'Ownable: caller is not the owner');
    await expectRevert(
      farm.connect(bob).transferOwnership(bob.address),
      'Ownable: caller is not the owner'
    );
  });

  it('Force end successfully', async () => {
    await uniPair.connect(deployer).mint(bob.address, bobLPBeforeBalance);
    await uniPair.connect(bob).approve(farm.address, bobLPBeforeBalance);

    await farm.connect(bob).deposit(bobLPBeforeBalance);
    await time.advanceBlockTo(startBlock + 10);

    await farm.connect(deployer).forceEnd();
    let oldBobPendingReward = parseInt(await farm.pendingReward(bob.address));

    await time.advanceBlockTo(startBlock + 20);

    let newBobPendingReward = parseInt(await farm.pendingReward(bob.address));
    expect(newBobPendingReward).to.be.equal(oldBobPendingReward);
  });
});
