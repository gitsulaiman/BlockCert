const contract = require("./contract");

async function testConnection() {
    try {
        const owner = await contract.owner();

        console.log("Blockchain Connected Successfully!");
        console.log("Contract Owner:", owner);

    } catch (error) {
        console.error("Connection Failed:", error.message);
    }
}

testConnection();