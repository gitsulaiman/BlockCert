// =====================================
// CONFIGURATION & AUTHENTICATION
// =====================================

const API_URL = "http://localhost:5000/api";

const adminToken = localStorage.getItem("adminToken");

const params = new URLSearchParams(window.location.search);
const qrCertificateId = params.get("verify");

// Allow public QR verification without admin login
if (!adminToken && !qrCertificateId) {
    window.location.replace("login.html");
}


// =====================================
// API FUNCTIONS WITH JWT
// =====================================

async function apiRequest(endpoint, method = "GET", body = null) {

    const token = localStorage.getItem("adminToken");

    const options = {
        method,
        headers: {
            "Content-Type": "application/json"
        }
    };

    // Attach JWT token
    if (token) {
        options.headers.Authorization = `Bearer ${token}`;
    }

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_URL}${endpoint}`, options);

    const data = await response.json();

    // Handle expired or invalid token
    if (
        response.status === 401 &&
        !endpoint.startsWith("/certificates/verify/")
    ) {

        localStorage.removeItem("adminToken");

        alert("Your session has expired. Please login again.");

        window.location.replace("login.html");

        throw new Error("Session expired");
    }

    if (!response.ok) {
        throw new Error(
            data.message || data.error || "Request failed"
        );
    }

    return data;
}


// =====================================
// NAVIGATION
// =====================================

const navItems = document.querySelectorAll(".nav-item");
const pages = document.querySelectorAll(".page");

const pageTitles = {
    dashboard: "Dashboard Overview",
    issue: "Issue Certificate",
    certificates: "Certificates",
    verify: "Verify Certificate",
    revoke: "Revoke Certificate",
    qr: "QR Verification"
};

function showPage(pageName) {

    pages.forEach(page => {
        page.classList.toggle("active", page.id === pageName);
    });

    navItems.forEach(item => {
        item.classList.toggle(
            "active",
            item.dataset.page === pageName
        );
    });

    const pageNameElement = document.getElementById("pageName");
    const topTitleElement = document.getElementById("topTitle");

    if (pageNameElement) {
        pageNameElement.textContent =
            pageName.charAt(0).toUpperCase() + pageName.slice(1);
    }

    if (topTitleElement) {
        topTitleElement.textContent = pageTitles[pageName] || pageName;
    }

    const sidebar = document.getElementById("sidebar");

    if (sidebar) {
        sidebar.classList.remove("open");
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

    if (pageName === "certificates") {
        loadCertificates();
    }
}


// Navigation clicks
navItems.forEach(item => {

    item.addEventListener("click", () => {

        showPage(item.dataset.page);

    });

});


// Dashboard navigation buttons
document.querySelectorAll("[data-go]").forEach(button => {

    button.addEventListener("click", () => {

        showPage(button.dataset.go);

    });

});


// Mobile menu
const menuBtn = document.getElementById("menuBtn");

if (menuBtn) {

    menuBtn.addEventListener("click", () => {

        document.getElementById("sidebar").classList.toggle("open");

    });

}


// =====================================
// TOAST NOTIFICATIONS
// =====================================

function showToast(message) {

    const toast = document.getElementById("toast");

    if (!toast) return;

    toast.textContent = message;

    toast.classList.add("show");

    setTimeout(() => {

        toast.classList.remove("show");

    }, 3000);

}


// =====================================
// DASHBOARD STATISTICS
// =====================================

async function updateStats() {

    try {

        const data = await apiRequest("/certificates/stats");

        if (data.success) {

            document.getElementById("totalIssued").textContent =
                data.stats.totalCertificates;

            document.getElementById("totalVerified").textContent =
                data.stats.validCertificates;

            document.getElementById("totalRevoked").textContent =
                data.stats.revokedCertificates;

        }

    } catch (error) {

        console.error("Dashboard Statistics Error:", error);

    }

}


// =====================================
// RESULT DISPLAY
// =====================================

function showResult(elementId, message, isError = false) {

    const element = document.getElementById(elementId);

    if (!element) return;

    element.classList.remove("hidden");

    element.classList.toggle("error", isError);

    element.innerHTML = message;

}


// Escape HTML to prevent HTML injection
function escapeHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, char => ({

        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"

    })[char]);

}


function getCertificate(data) {

    return data.certificate || data;

}


// =====================================
// ISSUE CERTIFICATE
// =====================================

const issueForm = document.getElementById("issueForm");

if (issueForm) {

    issueForm.addEventListener("submit", async function(e) {

        e.preventDefault();

        const button = document.getElementById("issueBtn");

        const certificateData = {

            studentName: document.getElementById("studentName").value.trim(),

            courseName: document.getElementById("courseName").value.trim(),

            universityName: document.getElementById("universityName").value.trim(),

            issueDate: document.getElementById("issueDate").value

        };

        if (Object.values(certificateData).some(value => !value)) {

            showToast("Please complete all fields.");

            return;

        }

        button.disabled = true;

        button.textContent = "Issuing...";

        try {

            const data = await apiRequest(
                "/certificates/issue",
                "POST",
                certificateData
            );

            const certificate = getCertificate(data);

            await updateStats();

            showResult(
                "issueResult",
                `
                    <h3>✓ Certificate Issued Successfully</h3>

                    <p>
                        <strong>Certificate ID:</strong>
                        ${escapeHTML(certificate.certificateId)}
                    </p>

                    <p><strong>Status:</strong> VALID</p>

                    <p>
                        <strong>Transaction:</strong>
                        ${escapeHTML(certificate.transactionHash)}
                    </p>
                `
            );

            this.reset();

            showToast("Certificate issued successfully!");

        } catch (error) {

            showResult(
                "issueResult",
                escapeHTML(error.message),
                true
            );

        } finally {

            button.disabled = false;

            button.textContent = "Issue Certificate →";

        }

    });

}


// =====================================
// VERIFY CERTIFICATE
// =====================================

const verifyForm = document.getElementById("verifyForm");

if (verifyForm) {

    verifyForm.addEventListener("submit", async function(e) {

        e.preventDefault();

        const id = document.getElementById("verifyId").value.trim();

        if (!id) return;

        const resultElement = document.getElementById("verifyResult");

        resultElement.innerHTML = "<p>Checking blockchain records...</p>";

        try {

            const data = await apiRequest(
                `/certificates/verify/${encodeURIComponent(id)}`
            );

            const certificate = data.certificate || {};

            const valid = data.status === "VALID";

            showResult(
                "verifyResult",
                `
                    <h3>
                        ${
                            valid
                                ? "✓ Certificate is Valid"
                                : "Certificate Status: " + escapeHTML(data.status)
                        }
                    </h3>

                    <span class="badge ${escapeHTML(data.status)}">
                        ${escapeHTML(data.status)}
                    </span>

                    <p>${escapeHTML(data.message)}</p>

                    ${certificate.studentName ? `

                        <div class="details-card">

                            <p>
                                <strong>Student:</strong>
                                ${escapeHTML(certificate.studentName)}
                            </p>

                            <p>
                                <strong>Course:</strong>
                                ${escapeHTML(certificate.courseName)}
                            </p>

                            <p>
                                <strong>University:</strong>
                                ${escapeHTML(certificate.universityName)}
                            </p>

                            <p>
                                <strong>Issue Date:</strong>
                                ${escapeHTML(certificate.issueDate)}
                            </p>

                            <p>
                                <strong>Transaction:</strong>
                                ${escapeHTML(certificate.transactionHash)}
                            </p>

                        </div>

                    ` : ""}
                `,
                !valid
            );

        } catch (error) {

            showResult(
                "verifyResult",
                escapeHTML(error.message),
                true
            );

        }

    });

}


// =====================================
// CERTIFICATE MANAGEMENT
// =====================================

let allCertificates = [];

let currentCertificateStatus = "ALL";


// Fetch certificates
async function loadCertificates(status = "ALL") {

    const tableBody = document.getElementById("certificateTableBody");

    if (!tableBody) return;

    currentCertificateStatus = status;

    tableBody.innerHTML = `
        <tr>
            <td colspan="6">Loading certificates...</td>
        </tr>
    `;

    try {

        let endpoint = "/certificates";

        if (status !== "ALL") {

            endpoint += `?status=${encodeURIComponent(status)}`;

        }

        const data = await apiRequest(endpoint);

        allCertificates = data.certificates || [];

        displayCertificates();

    } catch (error) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="6">
                    ${escapeHTML(error.message)}
                </td>
            </tr>
        `;

    }

}


// Display certificates
function displayCertificates() {

    const tableBody = document.getElementById("certificateTableBody");

    const searchInput = document.getElementById("certificateSearch");

    if (!tableBody || !searchInput) return;

    const searchValue = searchInput.value.trim().toLowerCase();

    const filteredCertificates = allCertificates.filter(certificate => {

        const id = (certificate.certificateId || "").toLowerCase();

        const name = (certificate.studentName || "").toLowerCase();

        return (
            id.includes(searchValue) ||
            name.includes(searchValue)
        );

    });


    if (filteredCertificates.length === 0) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="6">No certificates found.</td>
            </tr>
        `;

        return;

    }


    tableBody.innerHTML = filteredCertificates.map(certificate => {

        const formattedDate = certificate.issueDate
            ? new Date(certificate.issueDate).toLocaleDateString()
            : "N/A";

        return `

            <tr>

                <td>${escapeHTML(certificate.certificateId)}</td>

                <td>${escapeHTML(certificate.studentName)}</td>

                <td>${escapeHTML(certificate.courseName)}</td>

                <td>${escapeHTML(formattedDate)}</td>

                <td>

                    <span class="badge ${escapeHTML(certificate.status)}">

                        ${escapeHTML(certificate.status)}

                    </span>

                </td>

                <td>

                    <button
                        class="view-certificate-btn"
                        data-id="${escapeHTML(certificate.certificateId)}">

                        View Details

                    </button>

                </td>

            </tr>

        `;

    }).join("");

}


// Filter buttons
document.querySelectorAll(".filter-btn").forEach(button => {

    button.addEventListener("click", function() {

        document.querySelectorAll(".filter-btn").forEach(btn => {

            btn.classList.remove("active");

        });

        this.classList.add("active");

        const details = document.getElementById("certificateDetails");

        if (details) {
            details.innerHTML = "";
        }

        loadCertificates(this.dataset.status);

    });

});


// Search certificates
const certificateSearch = document.getElementById("certificateSearch");

if (certificateSearch) {

    certificateSearch.addEventListener("input", displayCertificates);

}


// View certificate details
const certificateTableBody = document.getElementById("certificateTableBody");

if (certificateTableBody) {

    certificateTableBody.addEventListener("click", async function(e) {

        const button = e.target.closest(".view-certificate-btn");

        if (!button) return;

        const id = button.dataset.id;

        const detailsElement = document.getElementById("certificateDetails");

        detailsElement.innerHTML = "<p>Loading certificate details...</p>";

        try {

            const data = await apiRequest(
                `/certificates/${encodeURIComponent(id)}`
            );

            const certificate = getCertificate(data);

            detailsElement.innerHTML = `

                <div class="details-card">

                    <h3>Certificate Details</h3>

                    <p>
                        <strong>Certificate ID:</strong>
                        ${escapeHTML(certificate.certificateId)}
                    </p>

                    <p>
                        <strong>Student Name:</strong>
                        ${escapeHTML(certificate.studentName)}
                    </p>

                    <p>
                        <strong>Course:</strong>
                        ${escapeHTML(certificate.courseName)}
                    </p>

                    <p>
                        <strong>University:</strong>
                        ${escapeHTML(certificate.universityName)}
                    </p>

                    <p>
                        <strong>Issue Date:</strong>
                        ${escapeHTML(certificate.issueDate)}
                    </p>

                    <p>
                        <strong>Status:</strong>

                        <span class="badge ${escapeHTML(certificate.status)}">
                            ${escapeHTML(certificate.status)}
                        </span>

                    </p>

                    <p>
                        <strong>Issuance Transaction:</strong>
                        ${escapeHTML(certificate.transactionHash)}
                    </p>

                    <p>
                        <strong>Revocation Transaction:</strong>
                        ${escapeHTML(certificate.revocationTransactionHash || "N/A")}
                    </p>

                    <p>
                        <strong>Certificate Hash:</strong>
                        ${escapeHTML(certificate.certificateHash)}
                    </p>

                </div>

            `;

            detailsElement.scrollIntoView({

                behavior: "smooth",

                block: "nearest"

            });

        } catch (error) {

            detailsElement.innerHTML = `

                <div class="result-box error">

                    ${escapeHTML(error.message)}

                </div>

            `;

        }

    });

}


// =====================================
// REVOKE CERTIFICATE
// =====================================

const revokeBtn = document.getElementById("revokeBtn");

if (revokeBtn) {

    revokeBtn.addEventListener("click", async function() {

        const id = document.getElementById("revokeId").value.trim();

        if (!id) {

            showToast("Enter a certificate ID.");

            return;

        }

        const confirmed = confirm(
            "Are you sure you want to revoke this certificate? This action is recorded on blockchain."
        );

        if (!confirmed) return;

        this.disabled = true;

        this.textContent = "Revoking...";

        try {

            const data = await apiRequest(
                `/certificates/revoke/${encodeURIComponent(id)}`,
                "PATCH"
            );

            await updateStats();

            showResult(
                "revokeResult",
                `
                    <h3>✓ Certificate Revoked</h3>

                    <p>${escapeHTML(data.message)}</p>

                    <p>
                        <strong>Transaction:</strong>
                        ${escapeHTML(data.transactionHash)}
                    </p>

                    <p><strong>Status:</strong> REVOKED</p>
                `
            );

            showToast("Certificate revoked successfully!");

        } catch (error) {

            showResult(
                "revokeResult",
                escapeHTML(error.message),
                true
            );

        } finally {

            this.disabled = false;

            this.textContent = "Revoke Certificate";

        }

    });

}


// =====================================
// QR CODE GENERATION
// =====================================

const generateQR = document.getElementById("generateQR");

if (generateQR) {

    generateQR.addEventListener("click", function() {

        const id = document.getElementById("qrId").value.trim();

        if (!id) {

            showToast("Enter a certificate ID.");

            return;

        }

        const output = document.getElementById("qrOutput");

        output.innerHTML = "";

        const verificationURL =
            `${window.location.origin}${window.location.pathname}?verify=${encodeURIComponent(id)}`;

        new QRCode(output, {

            text: verificationURL,

            width: 190,

            height: 190,

            colorDark: "#17645F",

            colorLight: "#FFFFFF",

            correctLevel: QRCode.CorrectLevel.H

        });

        showToast("QR code generated!");

    });

}


// =====================================
// AUTO VERIFY FROM QR LINK
// =====================================

if (qrCertificateId) {

    showPage("verify");

    const verifyIdInput = document.getElementById("verifyId");

    if (verifyIdInput) {

        verifyIdInput.value = qrCertificateId;

        document.getElementById("verifyForm").requestSubmit();

    }

}


// =====================================
// ADMIN LOGOUT
// =====================================

const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {

    logoutBtn.addEventListener("click", function() {

        localStorage.removeItem("adminToken");

        alert("Logged out successfully!");

        window.location.replace("login.html");

    });

}


// =====================================
// INITIALIZE
// =====================================

// Load dashboard statistics only for logged-in admins
if (localStorage.getItem("adminToken")) {

    updateStats();

}


// Set today's date as default issue date
const issueDateInput = document.getElementById("issueDate");

if (issueDateInput) {

    issueDateInput.value = new Date().toISOString().split("T")[0];

}