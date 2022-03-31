require('dotenv').config();
require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-ethers');
require('@openzeppelin/hardhat-upgrades');

task('accounts', 'Prints the list of accounts', async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

module.exports = {
  solidity: {
    version: '0.8.3',
    settings: {
      optimizer: {
        enabled: true,
        runs: 1
      }
    }
  },
  defaultNetwork: 'localhost',
  networks: {
    localhost: {
      url: 'http://127.0.0.1:8545',
      gas: 2100000,
      gasPrice: 8000000000,
      gasLimit: 6000000000,
      defaultBalanceEther: '1000'
    },
    bsctestnet: {
      url: `https://data-seed-prebsc-1-s1.binance.org:8545/`,
      accounts: [],
      gasLimit: 6000000000
    },
    bscmainnet: {
      url: 'https://bsc-dataseed4.ninicoin.io/',
      chainId: 56,
      accounts: [],
      gasLimit: 6000000000
    }
  },
  gas: 40000000,
  gasPrice: 10000000000,
  mocha: {
    timeout: 10000000
  }
};
