require("dotenv").config();

const { ethers } = require("ethers");
const contractABI = require("./contractABI.json");

// Connect to local Hardhat blockchain
const provider = new ethers.JsonRpcProvider(
    process.env.RPC_URL
);

// Connect using the authorized test account
const wallet = new ethers.Wallet(
    process.env.BLOCKCHAIN_PRIVATE_KEY,
    provider
);

// Connect to the deployed smart contract
const contract = new ethers.Contract(
    process.env.CONTRACT_ADDRESS,
    contractABI,
    wallet
);

module.exports = contract;