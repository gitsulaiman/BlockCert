require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Admin = require("./models/Admin");

const createAdmin = async () => {
    try {
        if (!process.env.MONGO_URI ||
            !process.env.ADMIN_EMAIL ||
            !process.env.ADMIN_PASSWORD) {
            throw new Error("Missing required environment variables");
        }

        await mongoose.connect(process.env.MONGO_URI);

        const email = process.env.ADMIN_EMAIL.toLowerCase().trim();

        const existingAdmin = await Admin.findOne({ email });

        if (existingAdmin) {
            console.log("Admin account already exists.");
            return;
        }

        const hashedPassword = await bcrypt.hash(
            process.env.ADMIN_PASSWORD,
            12
        );

        await Admin.create({
            email,
            password: hashedPassword
        });

        console.log("Admin account created successfully!");

    } catch (error) {
        console.error("Admin setup failed:", error);

    } finally {
        await mongoose.disconnect();
    }
};

createAdmin();