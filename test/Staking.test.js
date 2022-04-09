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
            
            await pool.connect(acc1).stake(100000, 50, 12);

            let info = await pool.stakeInfo(acc1.address, 0);
            console.log("info amount: " + info.amount);
            console.log("info amountClaimed: " + info.amountClaimed);
            console.log("info totalReward: " + info.totalReward);
            // console.log("start: " + (today + 30));

            // await ethers.provider.send('evm_increaseTime', [2000000]);
            await ethers.provider.send('evm_increaseTime', [SECONDS_IN_DAY * 130]);
            await pool.connect(acc1).claim(0);

            info = await pool.stakeInfo(acc1.address, 0);
            console.log("info amount: " + info.amount);
            console.log("info amountClaimed: " + info.amountClaimed);
            console.log("info totalReward: " + info.totalReward);
            // console.log("start: " + (today + 30));

            // await ethers.provider.send('evm_increaseTime', [2000000]);
            await ethers.provider.send('evm_increaseTime', [SECONDS_IN_DAY * 200]);
            await pool.connect(acc1).claim(0);

            info = await pool.stakeInfo(acc1.address, 0);
            console.log("info amount: " + info.amount);
            console.log("info amountClaimed: " + info.amountClaimed);
            console.log("info totalReward: " + info.totalReward);

            await ethers.provider.send('evm_increaseTime', [SECONDS_IN_DAY * 60]);
            await pool.connect(acc1).claim(0);

            info = await pool.stakeInfo(acc1.address, 0);
            console.log("info amount: " + info.amount);
            console.log("info amountClaimed: " + info.amountClaimed);
            console.log("info totalReward: " + info.totalReward);

            let x = await token.balanceOf(acc1.address);
            console.log("x: " + parseInt(x));

            expect(parseInt(x)).to.greaterThan(150000);
        });
    });