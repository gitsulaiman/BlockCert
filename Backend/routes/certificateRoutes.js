const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
    issueCertificate,
    getCertificate,
    getAllCertificates,
    verifyCertificate,
    revokeCertificate,
    getDashboardStats
} = require("../controllers/certificateController");

// PUBLIC ROUTE
// Anyone can verify a certificate
router.get("/verify/:id", verifyCertificate);


// ADMIN-ONLY ROUTES
// All routes below require a valid JWT token

router.use(protect);

// Dashboard statistics
router.get("/stats", getDashboardStats);

// Get all certificates
router.get("/", getAllCertificates);

// Issue certificate
router.post("/issue", issueCertificate);

// Revoke certificate
router.patch("/revoke/:id", revokeCertificate);

// Get certificate details
router.get("/:id", getCertificate);

module.exports = router;