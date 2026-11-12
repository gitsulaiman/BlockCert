const mongoose = require("mongoose");

const certificateSchema = new mongoose.Schema(
    {
        certificateId: {
            type: String,
            required: true,
            unique: true
        },

        studentName: {
            type: String,
            required: true
        },

        courseName: {
            type: String,
            required: true
        },

        universityName: {
            type: String,
            required: true
        },

        issueDate: {
            type: Date,
            required: true
        },

        certificateHash: {
            type: String,
            required: true
        },

        transactionHash: {
            type: String,
            default: null
        },

        status: {
            type: String,
            enum: ["VALID", "REVOKED"],
            default: "VALID"
        }
    },
    {
        timestamps: true
    }
);

const Certificate = mongoose.model(
    "Certificate",
    certificateSchema
);

module.exports = Certificate;