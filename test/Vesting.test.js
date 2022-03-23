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
 
    describe("test logic: ", async() =>{

        beforeEach(async() => {
            snapshot = await timeMachine.takeSnapshot();
            snapshotId = snapshot['result'];
            token = await MUUVToken.deployed("MultiWorld", "MUUV");
            pool = await Vesting.new(token.address, true);
            today = Math.floor(snapshot['id'] / MILISECONDS_IN_DAY) + 1;
        });
     
        afterEach(async() => {
            await timeMachine.revertToSnapshot(snapshotId);
        });

        it('2.1.1: mint token', async () => {
            await token.transfer(pool.address, 200000);
            let userAmount2 = await token.balanceOf(pool.address);
            console.log("userAmount2: " + userAmount2);

            assert.equal(userAmount2, 200000, "wrong");
        });
    });
})
