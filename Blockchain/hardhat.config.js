require("@nomicfoundation/hardhat-ethers");
require("dotenv").config();

module.exports = {
    solidity: "0.8.28",

    networks: {
        sepolia: {
            url: process.env.SEPOLIA_RPC_URL,
            accounts: process.env.DEPLOYER_PRIVATE_KEY
                ? [process.env.DEPLOYER_PRIVATE_KEY]
                : [],
            chainId: 11155111
        }
    }
};