// 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
// 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
// 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
// 0x90F79bf6EB2c4f870365E785982E1f101E93b906
// 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65
// 0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc
// 0x976EA74026E726554dB657fA54763abd0C3a0aa9
// 0x14dC79964da2C08b23698B3D3cc7Ca32193d9955
// 0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f
// 0xa0Ee7A142d267C1f36714E4a8F75612F20a79720
// 0xBcd4042DE499D14e55001CcbB24a551F3b954096
// 0x71bE63f3384f5fb98995898A86B02Fb2426c5788
// 0xFABB0ac9d68B0B445fB7357272Ff202C5651694a
// 0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec
// 0xdF3e18d64BC6A983f673Ab319CCaE4f1a57C7097
// 0xcd3B766CCDd6AE721141F452C550Ca635964ce71
// 0x2546BcD3c84621e976D8185a91A922aE77ECEc30
// 0xbDA5747bFD65F08deb54cb465eB87D40e51B197E
// 0xdD2FD4581271e230360230F9337D5c0430Bf44C0
// 0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199
const { advanceBlock, advanceBlockTo } = require("@openzeppelin/test-helpers/src/time");
const { expect } = require("chai");
const { ethers } = require("hardhat");

const current = Math.floor(Date.now() / 1000);


let token;
    let pool;
    let snapshot;
    let snapshotId;
    let today;

    const SECONDS_IN_DAY = 86400;
    const MILISECONDS_IN_DAY = 86400000;
    const ONE_MILLION = 1000000;

    describe("test logic: ", async() =>{
        let today;

        beforeEach(async() => {
            let vests = [9 * ONE_MILLION, 81 * ONE_MILLION, 81 * ONE_MILLION, 18 * ONE_MILLION, 288 * ONE_MILLION, 27 * ONE_MILLION, 198 * ONE_MILLION, 9 * ONE_MILLION, 144 * ONE_MILLION, 45 * ONE_MILLION];
            let types = [false, false, false, true, true, false, true, false, true, false];
            let MUUVToken = await ethers.getContractFactory('MUUV');
            let Vesting = await ethers.getContractFactory('Vesting');
            token = await MUUVToken.deploy("MultiWorld", "MUUV");
            pool = await Vesting.deploy(token.address, vests, types);
        });
    
        it('1.1: mint token', async () => {

            let x = await token.balanceOf("0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266");
            console.log("x: " + parseInt(x));

            expect(x).to.equal(900000000);
        });

        it('1.2: transfer token to Vesting', async () => {
            await token.transfer(pool.address, 900000000);
            let x = await token.balanceOf(pool.address);
            console.log("x: " + parseInt(x));

            expect(x).to.equal(900000000);
        });
        
        it('1.3: withdraw tge before cliff - monthly', async () => {
            const blockNumAfter = await ethers.provider.getBlockNumber();
            const blockAfter = await ethers.provider.getBlock(blockNumAfter);
            const timestamp = blockAfter.timestamp;
            let today = Math.floor(timestamp/86400);
    
            const [owner, acc1] = await ethers.getSigners();
            await token.transfer(pool.address, 900000000);
        
            await pool.setVestingSchedule(3, today + 30, 30, 30, 6, 0);
            await pool.setTGEUnlock(3, 20, today + 40);
            await pool.addOneUser(3, acc1.address, 30000);
            console.log("start: " + (today + 30));

            await ethers.provider.send('evm_increaseTime', [86400 * 40]);

            try{
                await pool.connect(acc1).withdraw(3);
            } catch (e) {
                throw e;
            }

            let y;
            y= await pool.vestingOf(3, acc1.address);
            console.log("----withdraw tge before cliff");
            console.log("u amount: " + y.amount);
            console.log("u amount claimed: " + y.amountClaimed);
            console.log("u tge amount: " + y.tgeAmountClaimed);

            await ethers.provider.send('evm_increaseTime', [86400 * 50]);

            await pool.connect(acc1).withdraw(3);

            y = await pool.vestingOf(3, acc1.address);
            console.log("----withdraw milestone2");
            console.log("u amount: " + y.amount);
            console.log("u amount claimed: " + y.amountClaimed);
            console.log("u tge amount: " + y.tgeAmountClaimed);

            await ethers.provider.send('evm_increaseTime', [86400 * 90]);

            await pool.connect(acc1).withdraw(3);

            y = await pool.vestingOf(3, acc1.address);
            console.log("----withdraw milestone5");
            console.log("u amount: " + y.amount);
            console.log("u amount claimed: " + y.amountClaimed);
            console.log("u tge amount: " + y.tgeAmountClaimed);


            let x = await token.balanceOf(acc1.address);
            console.log("x: " + parseInt(x));

            expect(x).to.equal(26000);
        });
        
        it('1.4: withdraw tge after cliff - monthly', async () => {
            const blockNumAfter = await ethers.provider.getBlockNumber();
            const blockAfter = await ethers.provider.getBlock(blockNumAfter);
            const timestamp = blockAfter.timestamp;
            let today = Math.floor(timestamp/86400);
    
            const [owner, acc1] = await ethers.getSigners();
            await token.transfer(pool.address, 900000000);
        
            await pool.setVestingSchedule(3, today + 30, 30, 30, 6, 0);
            await pool.setTGEUnlock(3, 20, today + 40);
            await pool.addOneUser(3, acc1.address, 30000);
            console.log("start: " + (today + 30));

            await ethers.provider.send('evm_increaseTime', [86400 * 60]);

            try{
                await pool.connect(acc1).withdraw(3);
            } catch (e) {
                throw e;
            }

            let y;
            y= await pool.vestingOf(3, acc1.address);
            console.log("----withdraw tge after cliff, milestone 1");
            console.log("u amount: " + y.amount);
            console.log("u amount claimed: " + y.amountClaimed);
            console.log("u tge amount: " + y.tgeAmountClaimed);


            let x = await token.balanceOf(acc1.address);
            console.log("x: " + parseInt(x));

            expect(x).to.equal(10000);
        });

        
        
        it('1.5: withdraw monthly but edit schedule', async () => {
            const blockNumAfter = await ethers.provider.getBlockNumber();
            const blockAfter = await ethers.provider.getBlock(blockNumAfter);
            const timestamp = blockAfter.timestamp;
            let today = Math.floor(timestamp/86400);
    
            const [owner, acc1] = await ethers.getSigners();
            await token.transfer(pool.address, 900000000);
        
            await pool.setVestingSchedule(3, today + 30, 30, 30, 6, 0);
            await pool.addOneUser(3, acc1.address, 30000);
            console.log("start: " + (today + 30));
            await pool.setVestingSchedule(3, today + 30, 15, 15, 6, 0);

            await ethers.provider.send('evm_increaseTime', [86400 * 60]);

            try{
                await pool.connect(acc1).withdraw(3);
            } catch (e) {
                throw e;
            }

            let y;
            y= await pool.vestingOf(3, acc1.address);
            console.log("----withdraw tge after cliff, milestone 1");
            console.log("u amount: " + y.amount);
            console.log("u amount claimed: " + y.amountClaimed);
            console.log("u tge amount: " + y.tgeAmountClaimed);


            let x = await token.balanceOf(acc1.address);
            console.log("x: " + parseInt(x));

            expect(x).to.equal(10000);
        });

        
        
        it('1.6: withdraw tge + monthly after cliff but edit schedule', async () => {
            const blockNumAfter = await ethers.provider.getBlockNumber();
            const blockAfter = await ethers.provider.getBlock(blockNumAfter);
            const timestamp = blockAfter.timestamp;
            let today = Math.floor(timestamp/86400);
    
            const [owner, acc1] = await ethers.getSigners();
            await token.transfer(pool.address, 900000000);
        
            await pool.setVestingSchedule(3, today + 30, 30, 30, 6, 0);
            await pool.setTGEUnlock(3, 20, today + 40);
            await pool.addOneUser(3, acc1.address, 30000);
            console.log("start: " + (today + 30));
            await pool.setVestingSchedule(3, today + 30, 15, 15, 6, 0);

            await ethers.provider.send('evm_increaseTime', [86400 * 60]);

            try{
                await pool.connect(acc1).withdraw(3);
            } catch (e) {
                throw e;
            }

            let y;
            y= await pool.vestingOf(3, acc1.address);
            console.log("----withdraw tge after cliff, milestone 1");
            console.log("u amount: " + y.amount);
            console.log("u amount claimed: " + y.amountClaimed);
            console.log("u tge amount: " + y.tgeAmountClaimed);


            let x = await token.balanceOf(acc1.address);
            console.log("x: " + parseInt(x));

            expect(x).to.equal(14000);
        });
        
        
        it('1.7: withdraw tge + monthly after cliff but edit schedule and tge', async () => {
            const blockNumAfter = await ethers.provider.getBlockNumber();
            const blockAfter = await ethers.provider.getBlock(blockNumAfter);
            const timestamp = blockAfter.timestamp;
            let today = Math.floor(timestamp/86400);
    
            const [owner, acc1] = await ethers.getSigners();
            await token.transfer(pool.address, 900000000);
        
            await pool.setVestingSchedule(3, today + 30, 30, 30, 6, 0);
            await pool.setTGEUnlock(3, 20, today + 40);
            await pool.addOneUser(3, acc1.address, 30000);
            console.log("start: " + (today + 30));
            await pool.setVestingSchedule(3, today + 30, 15, 15, 6, 0);
            await pool.editTGEUnlock(3, 10, today + 40);

            await ethers.provider.send('evm_increaseTime', [86400 * 60]);

            try{
                await pool.connect(acc1).withdraw(3);
            } catch (e) {
                throw e;
            }

            let y;
            y= await pool.vestingOf(3, acc1.address);
            console.log("----withdraw tge after cliff, milestone 1");
            console.log("u amount: " + y.amount);
            console.log("u amount claimed: " + y.amountClaimed);
            console.log("u tge amount: " + y.tgeAmountClaimed);


            let x = await token.balanceOf(acc1.address);
            console.log("x: " + parseInt(x));

            expect(x).to.equal(3000 + 4500 * 2);
        });

        
        it('2.1: withdraw tge after cliff', async () => {
            const blockNumAfter = await ethers.provider.getBlockNumber();
            const blockAfter = await ethers.provider.getBlock(blockNumAfter);
            const timestamp = blockAfter.timestamp;
            let today = Math.floor(timestamp/86400);
    
            const [owner, acc1] = await ethers.getSigners();
            await token.transfer(pool.address, 900000000);
        
            await pool.setVestingSchedule(3, today + 30, 30, 30, 6, 0);
            await pool.setTGEUnlock(3, 20, today + 40);
            await pool.addOneUser(3, acc1.address, 30000);
            console.log("start: " + (today + 30));

            await ethers.provider.send('evm_increaseTime', [86400 * 60]);

            try{
                await pool.connect(acc1).withdraw(3);
            } catch (e) {
                throw e;
            }

            let y;
            y= await pool.vestingOf(3, acc1.address);
            console.log("----withdraw tge after cliff, milestone 1");
            console.log("u amount: " + y.amount);
            console.log("u amount claimed: " + y.amountClaimed);
            console.log("u tge amount: " + y.tgeAmountClaimed);


            let x = await token.balanceOf(acc1.address);
            console.log("x: " + parseInt(x));

            expect(x).to.equal(10000);
        });
        
        
        it('3.1: withdraw linearly', async () => {
            const blockNumAfter = await ethers.provider.getBlockNumber();
            const blockAfter = await ethers.provider.getBlock(blockNumAfter);
            const timestamp = blockAfter.timestamp;
            let today = Math.floor(timestamp/86400);
    
            const [owner, acc1] = await ethers.getSigners();
            await token.transfer(pool.address, 900000000);
        
            await pool.setVestingSchedule(7, today + 30, 30, 0, 0, 300);
            let vestingData = await pool.getLinearlyVestingData(7);
            console.log("block goal: " + vestingData.totalLinearBlock);
            await pool.addOneUser(7, acc1.address, 30000);
            let blockN;

            //withdraw 1

            await ethers.provider.getBlockNumber().then((blockNumber) => {
                blockN = blockNumber;
                console.log("Current block number: " + blockNumber);
              });
            await advanceBlockTo(blockN + 200);
            
            await ethers.provider.getBlockNumber().then((blockNumber) => {
                console.log("Current block number 2: " + blockNumber);
              });
            await ethers.provider.send('evm_increaseTime', [86400 * 60]);
            await pool.connect(acc1).withdraw(7);

            let y;
            y= await pool.vestingOf(7, acc1.address);
            console.log("----withdraw tge after cliff linearly");
            console.log("u amount: " + y.amount);
            console.log("u amount claimed: " + y.amountClaimed);
            console.log("u tge amount: " + y.tgeAmountClaimed);

            //withdraw 2

            await ethers.provider.getBlockNumber().then((blockNumber) => {
                blockN = blockNumber;
                console.log("Current block number 3: " + blockNumber);
              });
            await advanceBlockTo(blockN + 100);
            
            await ethers.provider.getBlockNumber().then((blockNumber) => {
                console.log("Current block number 4: " + blockNumber);
              });
            await pool.connect(acc1).withdraw(7);

            y= await pool.vestingOf(7, acc1.address);
            console.log("----withdraw tge after cliff linearly");
            console.log("u amount: " + y.amount);
            console.log("u amount claimed: " + y.amountClaimed);
            console.log("u tge amount: " + y.tgeAmountClaimed);


            let x = await token.balanceOf(acc1.address);
            console.log("x: " + parseInt(x));

            expect(x).to.equal(30000);
        });
        
        it('3.2: withdraw tge after cliff linearly', async () => {
            const blockNumAfter = await ethers.provider.getBlockNumber();
            const blockAfter = await ethers.provider.getBlock(blockNumAfter);
            const timestamp = blockAfter.timestamp;
            let today = Math.floor(timestamp/86400);
    
            const [owner, acc1] = await ethers.getSigners();
            await token.transfer(pool.address, 900000000);
        
            await pool.setVestingSchedule(7, today + 30, 30, 0, 0, 300);
            await pool.setTGEUnlock(7, 20, today + 40);
            let vestingData = await pool.getLinearlyVestingData(7);
            console.log("block goal: " + vestingData.totalLinearBlock);
            await pool.addOneUser(7, acc1.address, 30000);
            let blockN;

            //withdraw 1

            await ethers.provider.getBlockNumber().then((blockNumber) => {
                blockN = blockNumber;
                console.log("Current block number: " + blockNumber);
              });
            await advanceBlockTo(blockN + 200);
            
            await ethers.provider.getBlockNumber().then((blockNumber) => {
                console.log("Current block number 2: " + blockNumber);
              });
            await ethers.provider.send('evm_increaseTime', [86400 * 60]);
            await pool.connect(acc1).withdraw(7);

            let y;
            y= await pool.vestingOf(7, acc1.address);
            console.log("----withdraw tge after cliff linearly");
            console.log("u amount: " + y.amount);
            console.log("u amount claimed: " + y.amountClaimed);
            console.log("u tge amount: " + y.tgeAmountClaimed);

            //withdraw 2

            await ethers.provider.getBlockNumber().then((blockNumber) => {
                blockN = blockNumber;
                console.log("Current block number 3: " + blockNumber);
              });
            await advanceBlockTo(blockN + 100);
            
            await ethers.provider.getBlockNumber().then((blockNumber) => {
                console.log("Current block number 4: " + blockNumber);
              });
            await pool.connect(acc1).withdraw(7);

            y= await pool.vestingOf(7, acc1.address);
            console.log("----withdraw tge after cliff linearly");
            console.log("u amount: " + y.amount);
            console.log("u amount claimed: " + y.amountClaimed);
            console.log("u tge amount: " + y.tgeAmountClaimed);


            let x = await token.balanceOf(acc1.address);
            console.log("x: " + parseInt(x));

            expect(x).to.equal(30000);
        });
    });
