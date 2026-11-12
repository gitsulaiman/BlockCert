const { ethers } = require("hardhat");

async function main() {

    // Get the smart contract
    const Certificate = await ethers.getContractFactory(
        "AcademicCertificate"
    );

    // Deploy the contract
    console.log("Deploying Academic Certificate Contract...");

    const certificate = await Certificate.deploy();

    // Wait for deployment
    await certificate.waitForDeployment();

    // Display contract address
    console.log(
        "Contract deployed successfully!"
    );

    console.log(
        "Contract Address:",
        await certificate.getAddress()
    );
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});