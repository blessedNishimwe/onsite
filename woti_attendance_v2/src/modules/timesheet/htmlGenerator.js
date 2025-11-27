// src/modules/timesheet/htmlGenerator.js
/**
 * HTML Generator for Timesheets
 * Generates styled HTML timesheets for preview and printing
 */

/**
 * Generate timesheet HTML
 * @param {Object} timesheetData - Timesheet data from service
 * @returns {string} HTML string
 */
const generateTimesheetHTML = (timesheetData) => {
  const data = timesheetData;
  const generatedDate = new Date().toLocaleDateString('en-GB');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Timesheet - ${data.user.firstName} ${data.user.lastName} - ${data.period.monthName} ${data.period.year}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 12px;
            color: #333;
            background: #fff;
            padding: 20px;
        }

        .timesheet-container {
            max-width: 900px;
            margin: 0 auto;
            background: #fff;
        }

        .header {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #667eea;
        }

        .header h1 {
            color: #667eea;
            font-size: 24px;
            margin-bottom: 5px;
        }

        .info-box {
            background: #f0f4ff;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        }

        .info-row {
            display: flex;
        }

        .info-label {
            font-weight: 600;
            width: 80px;
            color: #555;
        }

        .info-value {
            color: #333;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 11px;
        }

        th {
            background: #667eea;
            color: white;
            padding: 10px 8px;
            text-align: left;
            font-weight: 600;
        }

        td {
            padding: 8px;
            border-bottom: 1px solid #ddd;
        }

        tr:nth-child(even) {
            background: #f9f9f9;
        }

        tr:hover {
            background: #f0f4ff;
        }

        .sunday-row {
            background: #fff0f0 !important;
            color: #999;
        }

        .sunday-row td {
            font-style: italic;
        }

        .no-attendance {
            color: #999;
        }

        .total-row {
            background: #f0f4ff !important;
            font-weight: bold;
        }

        .total-row td {
            padding: 12px 8px;
            font-size: 13px;
        }

        .summary-box {
            background: #f0f4ff;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 30px;
        }

        .summary-box h3 {
            margin-bottom: 10px;
            color: #333;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
        }

        .summary-item {
            display: flex;
            justify-content: space-between;
        }

        .summary-value {
            font-weight: 600;
            color: #667eea;
        }

        .warning {
            color: #dc3545;
        }

        .signature-section {
            margin-top: 40px;
            page-break-inside: avoid;
        }

        .signature-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
        }

        .signature-block {
            width: 45%;
        }

        .signature-label {
            font-weight: 600;
            margin-bottom: 5px;
        }

        .signature-line {
            border-bottom: 1px solid #333;
            height: 30px;
            margin-bottom: 5px;
        }

        .date-line {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .date-line .line {
            flex: 1;
            border-bottom: 1px solid #333;
            height: 20px;
        }

        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #ddd;
            color: #999;
            font-size: 10px;
        }

        @media print {
            body {
                padding: 0;
                font-size: 10px;
            }

            .timesheet-container {
                max-width: none;
            }

            .no-print {
                display: none;
            }

            table {
                font-size: 9px;
            }

            th, td {
                padding: 6px 4px;
            }
        }

        @page {
            size: A4;
            margin: 15mm;
        }
    </style>
</head>
<body>
    <div class="timesheet-container">
        <div class="header">
            <h1>MONTHLY TIMESHEET</h1>
        </div>

        <div class="info-box">
            <div class="info-column">
                <div class="info-row">
                    <span class="info-label">Employee:</span>
                    <span class="info-value">${escapeHtml(data.user.firstName)} ${escapeHtml(data.user.lastName)}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Email:</span>
                    <span class="info-value">${escapeHtml(data.user.email)}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Facility:</span>
                    <span class="info-value">${escapeHtml(data.user.facilityName || 'N/A')}</span>
                </div>
            </div>
            <div class="info-column">
                <div class="info-row">
                    <span class="info-label">Period:</span>
                    <span class="info-value">${escapeHtml(data.period.monthName)} ${data.period.year}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Region:</span>
                    <span class="info-value">${escapeHtml(data.user.regionName || 'N/A')}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Generated:</span>
                    <span class="info-value">${generatedDate}</span>
                </div>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="width: 40px;">Day</th>
                    <th style="width: 80px;">Date</th>
                    <th style="width: 60px;">Clock In</th>
                    <th style="width: 60px;">Clock Out</th>
                    <th style="width: 50px;">Hours</th>
                    <th style="width: 130px;">Activity</th>
                    <th>Description</th>
                </tr>
            </thead>
            <tbody>
                ${generateTableRows(data.days)}
                <tr class="total-row">
                    <td colspan="4" style="text-align: right;"><strong>TOTAL HOURS:</strong></td>
                    <td colspan="3"><strong>${data.summary.totalHours}</strong></td>
                </tr>
            </tbody>
        </table>

        <div class="summary-box">
            <h3>Summary</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <span>Working Days:</span>
                    <span class="summary-value">${data.summary.workingDays}</span>
                </div>
                <div class="summary-item">
                    <span>Total Hours:</span>
                    <span class="summary-value">${data.summary.totalHours}</span>
                </div>
                <div class="summary-item">
                    <span>Days Attended:</span>
                    <span class="summary-value">${data.summary.daysAttended}</span>
                </div>
                ${data.summary.missingClockOut > 0 ? `
                <div class="summary-item">
                    <span>Missing Clock-Out:</span>
                    <span class="summary-value warning">${data.summary.missingClockOut}</span>
                </div>
                ` : ''}
                ${data.summary.missingActivity > 0 ? `
                <div class="summary-item">
                    <span>Missing Activity:</span>
                    <span class="summary-value warning">${data.summary.missingActivity}</span>
                </div>
                ` : ''}
            </div>
        </div>

        <div class="signature-section">
            <div class="signature-row">
                <div class="signature-block">
                    <div class="signature-label">Employee Signature:</div>
                    <div class="signature-line"></div>
                    <div class="date-line">
                        <span>Date:</span>
                        <span class="line"></span>
                    </div>
                </div>
                <div class="signature-block">
                    <div class="signature-label">Supervisor Signature:</div>
                    <div class="signature-line"></div>
                    <div class="date-line">
                        <span>Date:</span>
                        <span class="line"></span>
                    </div>
                </div>
            </div>
        </div>

        <div class="footer">
            Generated by WOTI Attendance System on ${new Date().toLocaleString('en-GB')}
        </div>
    </div>
</body>
</html>`;
};

/**
 * Generate table rows HTML
 * @param {Array} days - Array of day data
 * @returns {string} HTML string for table rows
 */
const generateTableRows = (days) => {
  return days.map(day => {
    if (day.isSunday) {
      return `
        <tr class="sunday-row">
            <td>${day.day.toUpperCase()}</td>
            <td>${day.date}</td>
            <td>--:--</td>
            <td>--:--</td>
            <td>--</td>
            <td>--</td>
            <td>(Sunday - Non-working)</td>
        </tr>`;
    }

    if (day.attendance) {
      return `
        <tr>
            <td>${day.day}</td>
            <td>${day.date}</td>
            <td>${day.attendance.clockIn || '--:--'}</td>
            <td>${day.attendance.clockOut || '--:--'}</td>
            <td>${day.attendance.hoursWorked || '0.00'}</td>
            <td>${escapeHtml(day.attendance.activityName || '--')}</td>
            <td>${escapeHtml(day.attendance.activityDescription || '')}</td>
        </tr>`;
    }

    return `
        <tr class="no-attendance">
            <td>${day.day}</td>
            <td>${day.date}</td>
            <td>--:--</td>
            <td>--:--</td>
            <td>0.00</td>
            <td>--</td>
            <td>(No attendance)</td>
        </tr>`;
  }).join('');
};

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
const escapeHtml = (text) => {
  if (!text) return '';
  const htmlEscapes = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;'
  };
  return String(text).replace(/[&<>"']/g, char => htmlEscapes[char]);
};

module.exports = {
  generateTimesheetHTML
};
