const contract = require("../blockchain/contract");
const Certificate = require("../models/Certificate");
const crypto = require("crypto");

// Issue a new certificate
const issueCertificate = async (req, res) => {
    try {
        const {
            studentName,
            courseName,
            universityName,
            issueDate
        } = req.body;

        if (!studentName || !courseName || !universityName || !issueDate) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        const parsedDate = new Date(issueDate);

        if (Number.isNaN(parsedDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid issue date"
            });
        }

        const certificateId =
            "CERT-" +
            Date.now() +
            "-" +
            crypto.randomBytes(3).toString("hex").toUpperCase();

        const certificateData = JSON.stringify({
            certificateId,
            studentName,
            courseName,
            universityName,
            issueDate: parsedDate.toISOString()
        });

        const certificateHash = crypto
            .createHash("sha256")
            .update(certificateData)
            .digest("hex");

        const blockchainHash = "0x" + certificateHash;
        const transaction = await contract.issueCertificate(
            certificateId,
            blockchainHash
        );
        const receipt = await transaction.wait();

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

        return res.status(201).json({
            success: true,
            message: "Certificate issued successfully on blockchain!",
            certificate
        });
    } catch (error) {
        console.error("Certificate Issuing Error:", error);

        return res.status(500).json({
            success: false,
            message: "Certificate issuance failed",
            error: error.message
        });
    }
};

// Get certificate details
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
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Verify certificate using blockchain and MongoDB
const verifyCertificate = async (req, res) => {
    try {
        const certificate = await Certificate.findOne({
            certificateId: req.params.id
        });

        if (!certificate) {
            return res.status(404).json({
                success: false,
                status: "NOT_FOUND",
                message: "Certificate does not exist"
            });
        }

        // Verify certificate on blockchain
        const blockchainResult = await contract.verifyCertificate(
            req.params.id
        );

        const [
            exists,
            blockchainHash,
            issuer,
            issueDate,
            revoked
        ] = blockchainResult;

        // Check blockchain existence
        if (!exists) {
            return res.status(200).json({
                success: false,
                status: "INVALID",
                message: "Certificate not found on blockchain"
            });
        }

        // Compare MongoDB hash with blockchain hash
        const storedHash = "0x" + certificate.certificateHash;

        if (blockchainHash.toLowerCase() !== storedHash.toLowerCase()) {
            return res.status(200).json({
                success: false,
                status: "INVALID",
                message: "Certificate hash mismatch. Data may have been modified."
            });
        }

        // Check revocation status
        if (revoked) {
            return res.status(200).json({
                success: true,
                status: "REVOKED",
                message: "Certificate has been revoked on blockchain"
            });
        }

        return res.status(200).json({
            success: true,
            status: "VALID",
            message: "Certificate successfully verified on blockchain",
            certificate: {
                certificateId: certificate.certificateId,
                studentName: certificate.studentName,
                courseName: certificate.courseName,
                universityName: certificate.universityName,
                issueDate: certificate.issueDate,
                certificateHash: certificate.certificateHash,
                transactionHash: certificate.transactionHash,
                issuer,
                blockchainIssueDate: issueDate.toString()
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
const revokeCertificate = async (req, res) => {
    try {
        const { id } = req.params;

        // Find certificate in MongoDB
        const certificate = await Certificate.findOne({
            certificateId: id
        });

        if (!certificate) {
            return res.status(404).json({
                success: false,
                message: "Certificate not found"
            });
        }

        // Check whether already revoked
        if (certificate.status === "REVOKED") {
            return res.status(400).json({
                success: false,
                message: "Certificate is already revoked"
            });
        }

        // Revoke certificate on blockchain
        const transaction = await contract.revokeCertificate(id);

        // Wait for blockchain confirmation
        const receipt = await transaction.wait();

        // Update MongoDB only after confirmation
        certificate.status = "REVOKED";
        certificate.revocationTransactionHash = receipt.hash;

        await certificate.save();

        return res.status(200).json({
            success: true,
            message: "Certificate revoked successfully on blockchain!",
            transactionHash: receipt.hash,
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
// Get all certificates or filter by status
const getAllCertificates = async (req, res) => {
    try {
        const { status } = req.query;

        // Validate status if provided
        if (status && !["VALID", "REVOKED"].includes(status.toUpperCase())) {
            return res.status(400).json({
                success: false,
                message: "Invalid status. Use VALID or REVOKED."
            });
        }

        // Build database filter
        const filter = {};

        if (status) {
            filter.status = status.toUpperCase();
        }

        // Fetch certificates, newest first
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
            message: "Failed to fetch certificates",
            error: error.message
        });
    }
};
// Get dashboard statistics from MongoDB
const getDashboardStats = async (req, res) => {
    try {
        const [totalCertificates, validCertificates, revokedCertificates] =
            await Promise.all([
                Certificate.countDocuments(),
                Certificate.countDocuments({ status: "VALID" }),
                Certificate.countDocuments({ status: "REVOKED" })
            ]);

        return res.status(200).json({
            success: true,
            stats: {
                totalCertificates,
                validCertificates,
                revokedCertificates
            }
        });

    } catch (error) {
        console.error("Dashboard Statistics Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch dashboard statistics",
            error: error.message
        });
    }
};

module.exports = {
    issueCertificate,
    getCertificate,
    getAllCertificates,
    verifyCertificate,
    revokeCertificate,
    getDashboardStats
};