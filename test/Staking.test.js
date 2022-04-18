const { expect } = require("chai");
const { ethers } = require("hardhat");

const current = Math.floor(Date.now() / 1000);


let token;
    let pool;

    const SECONDS_IN_DAY = 86400;
    const MILISECONDS_IN_DAY = 86400000;
    const ONE_MILLION = 1000000;

    describe("test logic: ", async() =>{

        beforeEach(async() => {
            const blockNumAfter = await ethers.provider.getBlockNumber();
            const blockAfter = await ethers.provider.getBlock(blockNumAfter);
            const timestamp = blockAfter.timestamp;
            let today = timestamp;
            console.log(today);
            let MUUVToken = await ethers.getContractFactory('MUUV');
            let Staking = await ethers.getContractFactory('Staking');
            token = await MUUVToken.deploy();
            pool = await Staking.deploy(token.address, today + 30 * SECONDS_IN_DAY, today + 60 * SECONDS_IN_DAY);
            console.log("enable : " + (today + 30 * SECONDS_IN_DAY));
            console.log("disable : " + (today + 60 * SECONDS_IN_DAY));
        });

        it('1.2: transfer token to Vesting', async () => {
            await token.transfer(pool.address, 198000000);
            let x = await token.balanceOf(pool.address);
            console.log("x: " + parseInt(x));

            expect(x).to.equal(198000000);
        });
        
        it('1.3: staking 50% APY in 2 years. 1 month interval', async () => {
            const blockNumAfter = await ethers.provider.getBlockNumber();
            const blockAfter = await ethers.provider.getBlock(blockNumAfter);
            const timestamp = blockAfter.timestamp;
            let today = timestamp;
    
            const [owner, acc1] = await ethers.getSigners();
            await token.transfer(pool.address, 198000000);
            await token.transfer(acc1.address, 100000);

            await ethers.provider.send('evm_increaseTime', [SECONDS_IN_DAY * 45]);
            console.log((timestamp + SECONDS_IN_DAY * 45));
            await token.connect(acc1).approve(pool.address, 100000);
            
            await pool.connect(acc1).stake(100000, 50, 12, 1);

            let info = await pool.stakeInfo(acc1.address, 0);
            console.log("info amount: " + info.amount);
            console.log("info amountClaimed: " + info.amountClaimed);
            console.log("info totalReward: " + info.totalReward);
            console.log("info totalmilestones: " + info.milestones);
            console.log("info lastMilestoneClaimed: " + info.lastmilestones);
            // console.log("start: " + (today + 30));

            // await ethers.provider.send('evm_increaseTime', [2000000]);
            await ethers.provider.send('evm_increaseTime', [SECONDS_IN_DAY * 130]);
            await pool.connect(acc1).claim(0);

            info = await pool.stakeInfo(acc1.address, 0);
            console.log("info amount: " + info.amount);
            console.log("info amountClaimed: " + info.amountClaimed);
            console.log("info totalReward: " + info.totalReward);
            console.log("info lastMilestoneClaimed: " + info.lastmilestones);
            // console.log("start: " + (today + 30));

            // await ethers.provider.send('evm_increaseTime', [2000000]);
            await ethers.provider.send('evm_increaseTime', [SECONDS_IN_DAY * 200]);
            await pool.connect(acc1).claim(0);

            info = await pool.stakeInfo(acc1.address, 0);
            console.log("info amount: " + info.amount);
            console.log("info amountClaimed: " + info.amountClaimed);
            console.log("info totalReward: " + info.totalReward);
            console.log("info lastMilestoneClaimed: " + info.lastmilestones);

            await ethers.provider.send('evm_increaseTime', [SECONDS_IN_DAY * 60]);
            await pool.connect(acc1).claim(0);

            info = await pool.stakeInfo(acc1.address, 0);
            console.log("info amount: " + info.amount);
            console.log("info amountClaimed: " + info.amountClaimed);
            console.log("info totalReward: " + info.totalReward);
            console.log("info lastMilestoneClaimed: " + info.lastmilestones);

            let x = await token.balanceOf(acc1.address);
            console.log("x: " + parseInt(x));

            expect(parseInt(x)).to.greaterThan(150000);
        });
        
        it('1.4: staking 30% APY in 1 years. 3 month interval', async () => {
            const blockNumAfter = await ethers.provider.getBlockNumber();
            const blockAfter = await ethers.provider.getBlock(blockNumAfter);
            const timestamp = blockAfter.timestamp;
            let today = timestamp;
    
            const [owner, acc1] = await ethers.getSigners();
            await token.transfer(pool.address, 198000000);
            await token.transfer(acc1.address, 100000);

            await ethers.provider.send('evm_increaseTime', [SECONDS_IN_DAY * 45]);
            console.log((timestamp + SECONDS_IN_DAY * 45));
            await token.connect(acc1).approve(pool.address, 100000);
            
            await pool.connect(acc1).stake(100000, 30, 12, 3);

            await ethers.provider.send('evm_increaseTime', [SECONDS_IN_DAY * 100]);
            await pool.connect(acc1).claim(0);

            info = await pool.stakeInfo(acc1.address, 0);
            console.log("info amount: " + info.amount);
            console.log("info amountClaimed: " + info.amountClaimed);
            console.log("info totalReward: " + info.totalReward);

            let x = await token.balanceOf(acc1.address);
            console.log("x: " + parseInt(x));

            expect(parseInt(x)).to.lessThan(130000);
        });

        it('1.5: staking 1 100% APY in 1 years. 3 month interval, staking 2 50% APY in 1 years. 1 month interval', async () => {
            const blockNumAfter = await ethers.provider.getBlockNumber();
            const blockAfter = await ethers.provider.getBlock(blockNumAfter);
            const timestamp = blockAfter.timestamp;
            let today = timestamp;
    
            const [owner, acc1] = await ethers.getSigners();
            await token.transfer(pool.address, 198000000);
            await token.transfer(acc1.address, 200000);

            await ethers.provider.send('evm_increaseTime', [SECONDS_IN_DAY * 45]);
            console.log((timestamp + SECONDS_IN_DAY * 45));
            await token.connect(acc1).approve(pool.address, 100000);
            
            await pool.connect(acc1).stake(100000, 100, 12, 3);
            await token.connect(acc1).approve(pool.address, 100000);
            await pool.connect(acc1).stake(100000, 50, 12, 1);

            await ethers.provider.send('evm_increaseTime', [SECONDS_IN_DAY * 100]);
            await pool.connect(acc1).claim(0);
            await pool.connect(acc1).claim(1);

            info = await pool.stakeInfo(acc1.address, 0);
            console.log("info amount: " + info.amount);
            console.log("info amountClaimed: " + info.amountClaimed);
            console.log("info totalReward: " + info.totalReward);

            
            info2 = await pool.stakeInfo(acc1.address, 1);
            console.log("info2 amount: " + info2.amount);
            console.log("info2 amountClaimed: " + info2.amountClaimed);
            console.log("info2 totalReward: " + info2.totalReward);

            let x = await token.balanceOf(acc1.address);
            console.log("x: " + parseInt(x));

            expect(parseInt(x)).to.greaterThan(100000);
        });
    });