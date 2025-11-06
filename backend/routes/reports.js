const express = require('express');
const router = express.Router();
const Permit = require('../models/permit');
const { Parser } = require('json2csv');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// GET /api/reports?start=YYYY-MM-DD&end=YYYY-MM-DD&format=pdf|csv|xlsx
router.get('/api/reports', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) return res.status(401).json({ message: 'Not authenticated' });

        const { start, end, format } = req.query;
        if (!start || !end || !format) return res.status(400).json({ message: 'Missing parameters' });

        const startDate = new Date(start);
        const endDate = new Date(end);
        if (isNaN(startDate) || isNaN(endDate)) return res.status(400).json({ message: 'Invalid date format' });
        endDate.setHours(23, 59, 59, 999);

        // Fetch permits and populate approver references
        const permits = await Permit.find({ createdAt: { $gte: startDate, $lte: endDate } })
            .populate('preApprovedBy', 'fullName username')
            .populate('approvedBy', 'fullName username')
            .lean();

        const records = permits.map((p, idx) => ({
            serialNumber: idx + 1,
            submittedOn: p.createdAt || null,
            name: p.fullName || (p.requester && (p.requester.fullName || p.requester.username)) || '',
            permitTitle: p.permitTitle || '',
            preApproverName: p.preApprovedBy ? (p.preApprovedBy.fullName || p.preApprovedBy.username) : '',
            preApprovedOn: p.preApprovedAt || null,
            preApproverComments: p.preApproverComments || '',
            approverName: p.approvedBy ? (p.approvedBy.fullName || p.approvedBy.username) : '',
            approvedOn: p.approvedAt || null,
            approverComments: p.approverComments || '',
            status: p.status || '',
            permitNumber: p.permitNumber || ''
        }));

        const fieldDefs = [
            { label: 'Serial Number', key: 'serialNumber' },
            { label: 'Submitted On', key: 'submittedOn' },
            { label: 'Name', key: 'name' },
            { label: 'Permit Title', key: 'permitTitle' },
            { label: 'Pre Approver Name', key: 'preApproverName' },
            { label: 'Pre Approved On', key: 'preApprovedOn' },
            { label: 'Comments', key: 'preApproverComments' },
            { label: 'Approver Name', key: 'approverName' },
            { label: 'Approved On', key: 'approvedOn' },
            { label: 'Approver Comments', key: 'approverComments' },
            { label: 'Status', key: 'status' },
            { label: 'Permit Number', key: 'permitNumber' }
        ];

        if (format === 'csv') {
            const csvRows = records.map(r => ({
                ...r,
                submittedOn: r.submittedOn ? new Date(r.submittedOn).toLocaleString() : '',
                preApprovedOn: r.preApprovedOn ? new Date(r.preApprovedOn).toLocaleString() : '',
                approvedOn: r.approvedOn ? new Date(r.approvedOn).toLocaleString() : ''
            }));

            const parser = new Parser({ fields: fieldDefs.map(f => ({ label: f.label, value: f.key })) });
            const csv = parser.parse(csvRows);
            res.header('Content-Type', 'text/csv');
            res.attachment('PTW_Permit_Report.csv');
            return res.send(csv);
        }

        if (format === 'xlsx') {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'PTW System';
            workbook.created = new Date();
            const sheet = workbook.addWorksheet('Permit Report');

            // header
            sheet.addRow(fieldDefs.map(f => f.label));
            const headerRow = sheet.getRow(1);
            headerRow.eachCell(cell => {
                cell.font = { bold: true, color: { argb: 'FF0F172A' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF2FF' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });

            // rows
            records.forEach(r => {
                const values = fieldDefs.map(f => {
                    if (['submittedOn', 'preApprovedOn', 'approvedOn'].includes(f.key)) return r[f.key] ? new Date(r[f.key]) : '';
                    return r[f.key] || '';
                });
                sheet.addRow(values);
            });

            const widths = [8, 20, 20, 30, 20, 20, 35, 20, 20, 35, 12, 18];
            sheet.columns.forEach((col, i) => { col.width = widths[i] || 20; });
            sheet.views = [{ state: 'frozen', ySplit: 1 }];

            res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.attachment('PTW_Permit_Report.xlsx');
            await workbook.xlsx.write(res);
            return res.end();
        }

        if (format === 'pdf') {
            const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
            res.header('Content-Type', 'application/pdf');
            res.attachment('PTW_Permit_Report.pdf');
            doc.pipe(res);

            // header
            const logoPath = path.join(__dirname, '..', '..', 'images', 'Logo.png');
            const title = 'Permit Report';
            const period = `${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`;
            const generated = new Date().toLocaleString();

            // Header layout: logo, title, and metadata grouped and horizontally centered
            const headerBlockHeight = 72;
            const headerTop = doc.y;
            // measure/logo existence
            let logoExists = false;
            try { logoExists = fs.existsSync(logoPath); } catch (e) { logoExists = false; }
            const logoWidth = logoExists ? 72 : 0;
            const gap = 12;
            const metaWidth = 220;
            // title width takes remaining group space but keep a reasonable minimum
            const titleWidth = Math.max(200, Math.floor((doc.page.width * 0.4)));

            const groupWidth = (logoWidth > 0 ? logoWidth + gap : 0) + titleWidth + gap + metaWidth;
            const groupStartX = Math.max(doc.page.margins.left, Math.floor((doc.page.width - groupWidth) / 2));

            // logo (left of group)
            try {
                if (logoExists) {
                    doc.image(logoPath, groupStartX, headerTop + 6, { width: logoWidth });
                }
            } catch (err) {
                console.warn('Failed to load logo:', logoPath, err && err.message ? err.message : err);
            }

            // title (center of group)
            const titleX = groupStartX + (logoWidth > 0 ? logoWidth + gap : 0);
            doc.font('Helvetica-Bold').fontSize(18).fillColor('#08306B');
            doc.text(title, titleX, headerTop + 14, { width: titleWidth, align: 'center' });

            // metadata block (right of group) - period then generated
            const metaX = titleX + titleWidth + gap;
            doc.font('Helvetica').fontSize(10).fillColor('gray').text(`Report Period: ${period}`, metaX, headerTop + 12, { width: metaWidth, align: 'center' });
            doc.font('Helvetica').fontSize(10).fillColor('gray').text(`Generated: ${generated}`, metaX, headerTop + 30, { width: metaWidth, align: 'center' });

            // separator line below header
            const headerBottom = headerTop + headerBlockHeight;
            doc.moveTo(doc.page.margins.left, headerBottom - 6).lineTo(doc.page.width - doc.page.margins.right, headerBottom - 6).stroke('#E5E7EB');
            // set cursor below header
            doc.y = headerBottom;
            doc.moveDown(0.5);

            // table layout
            const startX = doc.page.margins.left;
            const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
            const weights = [1, 3, 3, 4, 3, 2, 4, 3, 2, 4, 1, 3];
            const totalWeight = weights.reduce((a, b) => a + b, 0);
            // compute proportional column widths, then scale to fit the usableWidth exactly
            const baseWidths = weights.map(w => (w / totalWeight) * usableWidth);
            // allow small minimums so all columns can fit on one page
            const minColWidth = 34; // pixels
            let colWidths = baseWidths.map(b => Math.max(minColWidth, Math.floor(b)));
            // if sum exceeds usableWidth, scale down proportionally
            const totalColsWidth = colWidths.reduce((a, b) => a + b, 0);
            if (totalColsWidth > usableWidth) {
                const scale = usableWidth / totalColsWidth;
                colWidths = colWidths.map(w => Math.max(28, Math.floor(w * scale)));
            } else if (totalColsWidth < usableWidth) {
                // distribute remaining space to wider columns proportionally
                let remaining = usableWidth - totalColsWidth;
                // add a small share to comment and title columns first (indices 3 and 6 and 9)
                const priority = [6, 3, 9];
                for (const idx of priority) {
                    if (remaining <= 0) break;
                    const add = Math.min(remaining, 40);
                    colWidths[idx] += add;
                    remaining -= add;
                }
                // if still remaining, add evenly
                if (remaining > 0) {
                    const addEach = Math.floor(remaining / colWidths.length);
                    colWidths = colWidths.map(w => w + addEach);
                }
            }

            const fmtDate = d => {
                if (!d) return '—';
                const dt = new Date(d);
                if (isNaN(dt.getTime())) return '—';
                return dt.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
            };

            const headerHeight = 26;
            const renderHeader = (y) => {
                doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');
                let x = startX; const h = headerHeight;
                fieldDefs.forEach((f, i) => {
                    const w = colWidths[i] || 80;
                    // dark-blue header background with white text similar to provided sample
                    doc.rect(x, y, w, h).fillAndStroke('#0b4a8b', '#083d70');
                    // vertically center header text
                    const textY = y + Math.max(6, Math.floor((h - 10) / 2));
                    doc.fillColor('#FFFFFF').text(f.label.toUpperCase(), x + 6, textY, { width: w - 12, align: 'center' });
                    x += w;
                });
                return y + h;
            };

            // Compute the needed height for a row without drawing (used for page-break decisions)
            const getRowHeight = (row) => {
                let maxCellHeight = 0;
                // set font smaller for measurement
                doc.font('Helvetica').fontSize(8);
                fieldDefs.forEach((f, i) => {
                    const w = colWidths[i] || 80;
                    let txt = row[f.key];
                    if (['submittedOn', 'preApprovedOn', 'approvedOn'].includes(f.key)) txt = fmtDate(txt);
                    if (!txt || txt === '') txt = '—';
                    const cellText = String(txt);
                    // measure height for centered text
                    const cellHeight = doc.heightOfString(cellText, { width: w - 8, align: 'center' });
                    const padded = cellHeight + 8; // tighter padding
                    if (padded > maxCellHeight) maxCellHeight = padded;
                });
                return Math.max(22, Math.ceil(maxCellHeight));
            };

            // Draw a row using a precomputed height
            const renderRowWithHeight = (y, row, rowHeight) => {
                doc.font('Helvetica').fontSize(8).fillColor('#0f172a');
                let x = startX;
                fieldDefs.forEach((f, i) => {
                    const w = colWidths[i] || 80;
                    doc.rect(x, y, w, rowHeight).stroke('#E6E6E6');
                    let txt = row[f.key];
                    if (['submittedOn', 'preApprovedOn', 'approvedOn'].includes(f.key)) txt = fmtDate(txt);
                    if (!txt || txt === '') txt = '—';
                    const cellText = String(txt);
                    // measure height for centered vertical positioning
                    const textHeight = doc.heightOfString(cellText, { width: w - 8, align: 'center' });
                    const textY = y + Math.max(4, Math.floor((rowHeight - textHeight) / 2));
                    doc.text(cellText, x + 4, textY, { width: w - 8, align: 'center' });
                    x += w;
                });
                return y + rowHeight;
            };

            let y = doc.y + 4; y = renderHeader(y); let pageNum = 1;
            for (const row of records) {
                const needed = getRowHeight(row);
                const bottomLimit = doc.page.height - doc.page.margins.bottom - 40;
                if (y + needed > bottomLimit) {
                    // footer on current page
                    doc.fontSize(9).fillColor('gray').text(`Page ${pageNum}`, doc.page.margins.left, doc.page.height - doc.page.margins.bottom + 10);
                    doc.addPage({ size: 'A4', layout: 'landscape', margin: 36 });
                    pageNum += 1;
                    y = doc.y + 4;
                    y = renderHeader(y);
                }
                y = renderRowWithHeight(y, row, needed);
            }
            doc.fontSize(9).fillColor('gray').text(`Page ${pageNum}`, doc.page.margins.left, doc.page.height - doc.page.margins.bottom + 10);
            doc.end();
            return;
        }

        return res.status(400).json({ message: 'Invalid format' });
    } catch (err) {
        console.error('Report error:', err);
        return res.status(500).json({ message: 'Failed to generate report', error: err.message });
    }
});

module.exports = router;
