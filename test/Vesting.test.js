const timeMachine = require('ganache-time-traveler');

let MUUVToken = artifacts.require('MUUV');
let Vesting = artifacts.require('Vesting');


contract('Vesting with ganache time traveler', async (accounts) =>  {

    let token;
    let pool;
    let snapshot;
    let snapshotId;
    let today;

    const SECONDS_IN_DAY = 86400;
    const MILISECONDS_IN_DAY = 86400000;
    const ONE_MILLION = 1000000;
 
    describe("test logic: ", async() =>{

        beforeEach(async() => {
            snapshot = await timeMachine.takeSnapshot();
            snapshotId = snapshot['result'];
            token = await MUUVToken.deployed("MultiWorld", "MUUV");
            pool = await Vesting.new(token.address, [9 * ONE_MILLION, 81 * ONE_MILLION, 81 * ONE_MILLION, 18 * ONE_MILLION, 288 * ONE_MILLION, 27 * ONE_MILLION, 198 * ONE_MILLION, 9 * ONE_MILLION, 144 * ONE_MILLION, 45 * ONE_MILLION]);
            today = Math.floor(snapshot['id'] / MILISECONDS_IN_DAY) + 1;
        });
     
        afterEach(async() => {
            await timeMachine.revertToSnapshot(snapshotId);
        });

        it('2.1.1: mint token', async () => {
            await token.transfer(pool.address, 900000000);
            let userAmount2 = await token.balanceOf(pool.address);
            console.log("userAmount2: " + userAmount2);

            assert.equal(userAmount2, 900000000, "wrong");
        });
    });
})
