// const timeMachine = require('ganache-time-traveler');
const { expect } = require("chai");
const { ethers } = require("hardhat");


let token;
    let pool;
    let snapshot;
    let snapshotId;
    let today;

    const SECONDS_IN_DAY = 86400;
    const MILISECONDS_IN_DAY = 86400000;
    const ONE_MILLION = 1000000;
 
    describe("test logic: ", async() =>{

        // beforeEach(async() => {
        //     const [owner] = await ethers.getSigners();
        //     let MUUVToken = await ethers.getContractFactory('MUUV');
        //     let Vesting = await ethers.getContractFactory('Vesting');
        //     // snapshot = await timeMachine.takeSnapshot();
        //     // snapshotId = snapshot['result'];
        //     token = await MUUVToken.deploy("MultiWorld", "MUUV");
        //     // pool = await Vesting.new(token.address, [9 * ONE_MILLION, 81 * ONE_MILLION, 81 * ONE_MILLION, 18 * ONE_MILLION, 288 * ONE_MILLION, 27 * ONE_MILLION, 198 * ONE_MILLION, 9 * ONE_MILLION, 144 * ONE_MILLION, 45 * ONE_MILLION]);
        //     today = Math.floor(snapshot['id'] / MILISECONDS_IN_DAY) + 1;
        // });
     
        // afterEach(async() => {
        //     await timeMachine.revertToSnapshot(snapshotId);
        // });

        it('2.1.1: mint token', async () => {
            const [owner] = await ethers.getSigners();
            let MUUVToken = await ethers.getContractFactory('MUUV');
            let Vesting = await ethers.getContractFactory('Vesting');
            // snapshot = await timeMachine.takeSnapshot();
            // snapshotId = snapshot['result'];
            token = await MUUVToken.deploy("MultiWorld", "MUUV");
            // pool = await Vesting.new(token.address, [9 * ONE_MILLION, 81 * ONE_MILLION, 81 * ONE_MILLION, 18 * ONE_MILLION, 288 * ONE_MILLION, 27 * ONE_MILLION, 198 * ONE_MILLION, 9 * ONE_MILLION, 144 * ONE_MILLION, 45 * ONE_MILLION]);
            // today = Math.floor(snapshot['id'] / MILISECONDS_IN_DAY) + 1;

            let userAmount2 = await token.balanceOf("0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266");
            console.log("userAmount2: " + parseInt(userAmount2));

            expect(userAmount2).to.equal(900000000);
        });
    });
