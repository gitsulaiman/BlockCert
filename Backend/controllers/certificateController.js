const contract = require("../blockchain/contract");
const Certificate = require("../models/Certificate");
const crypto = require("crypto");

// ==========================================
// 1. ISSUE A NEW CERTIFICATE
// ==========================================

const issueCertificate = async (req, res) => {
    try {
        console.log("\n========== CERTIFICATE ISSUANCE STARTED ==========");

        const {
            studentName,
            courseName,
            universityName,
            issueDate
        } = req.body;

        console.log("STEP 1: Certificate request received");

        // Validate required fields
        if (!studentName || !courseName || !universityName || !issueDate) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        // Validate date
        const parsedDate = new Date(issueDate);

        if (Number.isNaN(parsedDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid issue date"
            });
        }

        // Generate unique certificate ID
        const certificateId =
            "CERT-" +
            Date.now() +
            "-" +
            crypto.randomBytes(3).toString("hex").toUpperCase();

        // Prepare certificate data
        const certificateData = JSON.stringify({
            certificateId,
            studentName,
            courseName,
            universityName,
            issueDate: parsedDate.toISOString()
        });

        // Generate SHA-256 hash
        const certificateHash = crypto
            .createHash("sha256")
            .update(certificateData)
            .digest("hex");

        const blockchainHash = "0x" + certificateHash;

        console.log("STEP 2: Certificate ID generated:", certificateId);
        console.log("STEP 3: Certificate hash generated");
        console.log("STEP 4: Sending transaction to blockchain...");

        // Send transaction to blockchain
        const transaction = await contract.issueCertificate(
            certificateId,
            blockchainHash
        );

        console.log("STEP 5: Transaction submitted:", transaction.hash);
        console.log("STEP 6: Waiting for blockchain confirmation...");

        // Wait for transaction confirmation
        const receipt = await transaction.wait();

        console.log("STEP 7: Transaction confirmed:", receipt.hash);

        // Save certificate in MongoDB
        console.log("STEP 8: Saving certificate to MongoDB...");

        const certificate = await Certificate.create({
            certificateId,
            studentName,
            courseName,
            universityName,
            issueDate: parsedDate,
            certificateHash,
            transactionHash: receipt.hash,
            status: "VALID"
        });

        console.log("STEP 9: Certificate saved successfully");
        console.log("========== CERTIFICATE ISSUANCE COMPLETED ==========\n");

        return res.status(201).json({
            success: true,
            message: "Certificate issued successfully on blockchain!",
            certificate
        });

    } catch (error) {
        console.error("\n========== CERTIFICATE ISSUANCE ERROR ==========");
        console.error(error);
        console.error("Error message:", error.message);
        console.error("================================================\n");

        return res.status(500).json({
            success: false,
            message: "Certificate issuance failed",
            error: error.message
        });
    }
};


// ==========================================
// 2. GET CERTIFICATE BY ID
// ==========================================

const getCertificate = async (req, res) => {
    try {
        const certificate = await Certificate.findOne({
            certificateId: req.params.id
        });

        if (!certificate) {
            return res.status(404).json({
                success: false,
                message: "Certificate not found"
            });
        }

        return res.status(200).json({
            success: true,
            certificate
        });

    } catch (error) {
        console.error("Get Certificate Error:", error);

        return res.status(500).json({
            success: false,
            message: "Error fetching certificate",
            error: error.message
        });
    }
};


// ==========================================
// 3. VERIFY CERTIFICATE
// ==========================================

const verifyCertificate = async (req, res) => {
    try {
        const { id } = req.params;

        console.log("Verifying certificate:", id);

        // Find certificate in MongoDB
        const certificate = await Certificate.findOne({
            certificateId: id
        });

        if (!certificate) {
            return res.status(404).json({
                success: false,
                message: "Certificate not found. It may be invalid or fake."
            });
        }

        // Verify certificate on blockchain
        const [
            exists,
            blockchainHash,
            issuer,
            blockchainIssueDate,
            revoked
        ] = await contract.verifyCertificate(id);

        if (!exists) {
            return res.status(404).json({
                success: false,
                message: "Certificate does not exist on blockchain."
            });
        }

        // Compare hashes
        const storedHash = "0x" + certificate.certificateHash;

        if (storedHash.toLowerCase() !== blockchainHash.toLowerCase()) {
            return res.status(400).json({
                success: false,
                message: "Certificate data has been modified. Verification failed."
            });
        }

        // Check revocation status
        if (revoked || certificate.status === "REVOKED") {
            return res.status(200).json({
                success: true,
                verified: false,
                status: "REVOKED",
                message: "This certificate has been revoked.",
                certificate
            });
        }

        return res.status(200).json({
            success: true,
            verified: true,
            status: "VALID",
            message: "Certificate verified successfully on blockchain!",
            certificate,
            blockchain: {
                issuer,
                issueDate: blockchainIssueDate.toString()
            }
        });

    } catch (error) {
        console.error("Certificate Verification Error:", error);

        return res.status(500).json({
            success: false,
            message: "Certificate verification failed",
            error: error.message
        });
    }
};


// ==========================================
// 4. REVOKE CERTIFICATE
// ==========================================

const revokeCertificate = async (req, res) => {
    try {
        const { id } = req.params;

        const certificate = await Certificate.findOne({
            certificateId: id
        });

        if (!certificate) {
            return res.status(404).json({
                success: false,
                message: "Certificate not found"
            });
        }

        if (certificate.status === "REVOKED") {
            return res.status(400).json({
                success: false,
                message: "Certificate is already revoked"
            });
        }

        // Revoke on blockchain
        const transaction = await contract.revokeCertificate(id);

        const receipt = await transaction.wait();

        // Update MongoDB
        certificate.status = "REVOKED";
        certificate.revocationTransactionHash = receipt.hash;

        await certificate.save();

        return res.status(200).json({
            success: true,
            message: "Certificate revoked successfully",
            certificate
        });

    } catch (error) {
        console.error("Certificate Revocation Error:", error);

        return res.status(500).json({
            success: false,
            message: "Certificate revocation failed",
            error: error.message
        });
    }
};


// ==========================================
// 5. GET ALL CERTIFICATES
// ==========================================

const getAllCertificates = async (req, res) => {
    try {
        const { status } = req.query;

        let filter = {};

        if (status === "VALID" || status === "REVOKED") {
            filter.status = status;
        }

        const certificates = await Certificate.find(filter)
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: certificates.length,
            certificates
        });

    } catch (error) {
        console.error("Get All Certificates Error:", error);

        return res.status(500).json({
            success: false,
            message: "Error fetching certificates",
            error: error.message
        });
    }
};


// ==========================================
// 6. GET DASHBOARD STATISTICS
// ==========================================

const getDashboardStats = async (req, res) => {
    try {
        const totalIssued = await Certificate.countDocuments();

        const totalVerified = await Certificate.countDocuments({
            status: "VALID"
        });

        const totalRevoked = await Certificate.countDocuments({
            status: "REVOKED"
        });

        return res.status(200).json({
            success: true,
            stats: {
                totalIssued,
                totalVerified,
                totalRevoked
            }
        });

    } catch (error) {
        console.error("Dashboard Statistics Error:", error);

        return res.status(500).json({
            success: false,
            message: "Error fetching dashboard statistics",
            error: error.message
        });
    }
};


// ==========================================
// EXPORT ALL CONTROLLERS
// ==========================================

module.exports = {
    issueCertificate,
    getCertificate,
    verifyCertificate,
    revokeCertificate,
    getAllCertificates,
    getDashboardStats
};