const express = require("express");
const router = express.Router();
const multer = require("multer");
const Permit = require("../models/permit");
const User = require("../models/user");
const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer");
require("dotenv").config();

// ----- Auth middleware -----
function requireAuth(req, res, next) {
    if (req.session && req.session.userId) return next();
    return res.status(401).json({ message: "Unauthorized - please log in" });
}

// ----- Multer config -----
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ----- GET all permits for current requester -----
router.get("/permit", requireAuth, async (req, res) => {
    try {
        const permits = await Permit.find({ requester: req.session.userId }).sort({ createdAt: -1 });
        res.json(permits);
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// ----- GET single permit -----
router.get("/permit/:id", requireAuth, async (req, res) => {
    try {
        const permit = await Permit.findOne({
            _id: req.params.id,
            requester: req.session.userId
        });
        if (!permit) return res.status(404).json({ message: "Permit not found" });
        res.json(permit);
    } catch (err) {
        console.error("Error fetching permit:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ----- POST new permit -----
router.post("/permit", requireAuth, upload.array("files", 5), async (req, res) => {
    try {
        const uploadedFiles = req.files.map(file => ({
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            data: file.buffer
        }));

        const permit = new Permit({
            fullName: req.body.fullName,
            lastName: req.body.lastName,
            contactDetails: req.body.contactDetails,
            altContactDetails: req.body.altContactDetails,
            corpEmailId: req.body.corpEmailId,
            permitTitle: req.body.permitTitle,
            terminal: req.body.terminal,
            facility: req.body.facility,
            specifyTerminal: req.body.specifyTerminal,
            specifyFacility: req.body.specifyFacility,
            workDescription: req.body.workDescription,
            impact: req.body.impact,
            equipmentTypeInput: req.body.equipmentTypeInput,
            impactDetailsInput: req.body.impactDetailsInput,
            ePermit: req.body.ePermit,
            ePermitReason: req.body.ePermitReason,
            fmmWorkorder: req.body.fmmWorkorder,
            noFmmWorkorder: req.body.noFmmWorkorder,
            hseRisk: req.body.hseRisk,
            noHseRiskAssessmentReason: req.body.noHseRiskAssessmentReason,
            opRisk: req.body.opRisk,
            noOpsRiskAssessmentReason: req.body.noOpsRiskAssessmentReason,
            startDateTime: req.body.startDateTime,
            endDateTime: req.body.endDateTime,
            signName: req.body.signName,
            signDate: req.body.signDate,
            signTime: req.body.signTime,
            designation: req.body.designation,
            files: uploadedFiles,
            requester: req.session.userId,
            role: req.session.userRole
        });

        await permit.save();
        res.status(201).json({ message: "Permit saved successfully", permit });
    } catch (err) {
        console.error("Permit save error:", err);
        res.status(500).json({ message: "Failed to save permit", error: err.message });
    }
});

// ----- PATCH update permit status -----
router.patch("/permit/:id/status", requireAuth, async (req, res) => {
    try {
        const { status } = req.body;
        const permit = await Permit.findOne({
            _id: req.params.id,
            requester: req.session.userId
        });
        if (!permit) return res.status(404).json({ message: "Permit not found" });

        if (status === "Approved" && !permit.permitNumber) {
            const now = new Date();
            const dd = String(now.getDate()).padStart(2, "0");
            const mm = String(now.getMonth() + 1).padStart(2, "0");
            const yyyy = now.getFullYear();
            const hh = String(now.getHours()).padStart(2, "0");
            const min = String(now.getMinutes()).padStart(2, "0");
            const ss = String(now.getSeconds()).padStart(2, "0");

            const datePart = `${dd}${mm}${yyyy}`;
            const timePart = `${hh}${min}${ss}`;

            const startOfDay = new Date(now.setHours(0, 0, 0, 0));
            const endOfDay = new Date(now.setHours(23, 59, 59, 999));

            const countToday = await Permit.countDocuments({
                status: "Approved",
                approvedAt: { $gte: startOfDay, $lte: endOfDay }
            });

            const serial = String(countToday + 1).padStart(3, "0");
            permit.permitNumber = `BHS-${datePart}-${timePart}-${serial}`;
            permit.approvedAt = new Date();
        }

        // ✅ Persist the status change
        permit.status = status;
        await permit.save();

        res.json({ message: "Status updated", permit });
    } catch (err) {
        console.error("Error updating permit:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ----- GET PDF for an approved permit -----
router.get("/permit/:id/pdf", requireAuth, async (req, res) => {
    let browser;
    try {
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless
        });

        const page = await browser.newPage();
        const permit = await Permit.findOne({
            _id: req.params.id,
            requester: req.session.userId
        });

        if (!permit) return res.status(404).json({ message: "Permit not found" });
        if (permit.status !== "Approved")
            return res.status(403).json({ message: "Permit not approved yet" });

        const user = await User.findById(req.session.userId);

        // Build HTML with permit data
        const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            @page { size: A4; margin: 1cm; }
            body { font-family: Tahoma, sans-serif; font-size: 12px; line-height: 1.4; border: 2px solid #000; padding: 20px; box-sizing: border-box; }
            header { text-align: center; margin-bottom: 20px; background-color: #273172; color: #fff; padding: 10px; }
            header h1 { font-size: 16px; margin: 0; }
            header h2 { font-size: 14px; margin: 5px 0 0 0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            td { border: 1px solid #000; padding: 6px; vertical-align: top; }
            td.label { font-weight: bold; width: 35%; background: #f2f2f2; }
            blockquote { font-style: italic; margin: 20px 0; padding-left: 10px; border-left: 3px solid #999; }
            footer { font-size: 11px; margin-top: 30px; border-top: 1px solid #ccc; padding-top: 8px; display: flex; justify-content: space-between; align-items: center; }
            footer .center { flex: 1; text-align: center; }
            footer .left { text-align: left; flex: 1; }
            footer .right { text-align: right; flex: 1; }
          </style>
        </head>
        <body>
          <header>
            <h1>HIA Baggage Handling System - A Gateway to Access the BHS</h1>
            <h2>Permit Status Report</h2>
          </header>
          <table>
            <tr><td class="label">Full Name</td><td>${permit.fullName || ''} ${permit.lastName || ''}</td></tr>
            <tr><td class="label">Designation</td><td>${permit.designation || ''}</td></tr>
            <tr><td class="label">Mobile Number</td><td>${permit.contactDetails || ''}</td></tr>
            <tr><td class="label">Alternate Mobile Number</td><td>${permit.altContactDetails || ''}</td></tr>
                        <tr><td class="label">Permit Title</td><td>${permit.permitTitle || ''}</td></tr>
            <tr><td class="label">Permit Number</td><td>${permit.permitNumber || ''}</td></tr>
            <tr><td class="label">Status</td><td>${permit.status || ''}</td></tr>
            <tr><td class="label">Start Date and Time</td><td>${permit.startDateTime ? new Date(permit.startDateTime).toLocaleString() : ''}</td></tr>
            <tr><td class="label">End Date and Time</td><td>${permit.endDateTime ? new Date(permit.endDateTime).toLocaleString() : ''}</td></tr>
            <tr><td class="label">Work Description</td><td>${permit.workDescription || ''}</td></tr>
          </table>

          <blockquote>
            "Safety and teamwork are the foundation of every successful operation."
          </blockquote>

          <p>
            Thank you for your commitment to safe and professional work practices.
            Your dedication ensures smooth operations and a secure environment.
          </p>

          <footer>
              <div class="left">Printed by: ${user?.username || 'Unknown User'}</div>
              <div class="center">This is a system generated report and does not require signature.</div>
              <div class="right">
                Date: ${new Date().toLocaleDateString()}<br/>
                Time: ${new Date().toLocaleTimeString()}
              </div>
          </footer>
        </body>
      </html>
    `;

        await page.setContent(html, { waitUntil: "networkidle0" });
        const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
        await browser.close();

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="Permit-${permit.permitNumber}.pdf"`);
        res.send(pdfBuffer);
    } catch (err) {
        console.error("Error generating PDF:", err);
        if (browser) await browser.close();
        res.status(500).json({ message: "Error generating PDF" });
    }
});

module.exports = router;
