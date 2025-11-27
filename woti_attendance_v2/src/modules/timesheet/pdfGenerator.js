// src/modules/timesheet/pdfGenerator.js
/**
 * PDF Generator for Timesheets
 * Generates professional timesheet PDFs using PDFKit
 */

const PDFDocument = require('pdfkit');

/**
 * Generate timesheet PDF
 * @param {Object} timesheetData - Timesheet data from service
 * @returns {Promise<Buffer>} PDF buffer
 */
const generateTimesheetPDF = async (timesheetData) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        info: {
          Title: `Timesheet - ${timesheetData.user.firstName} ${timesheetData.user.lastName} - ${timesheetData.period.monthName} ${timesheetData.period.year}`,
          Author: 'WOTI Attendance System',
          Subject: 'Monthly Timesheet',
          CreationDate: new Date()
        }
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // Page dimensions
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const startX = doc.page.margins.left;

      // Colors
      const colors = {
        primary: '#667eea',
        headerBg: '#f0f4ff',
        sundayBg: '#fff0f0',
        border: '#ddd',
        text: '#333',
        lightText: '#666'
      };

      // Draw header section
      drawHeader(doc, timesheetData, startX, pageWidth, colors);

      // Draw table
      drawTable(doc, timesheetData, startX, pageWidth, colors);

      // Draw summary and footer
      drawFooter(doc, timesheetData, startX, pageWidth, colors);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Draw header section
 */
const drawHeader = (doc, data, startX, pageWidth, colors) => {
  let y = 40;

  // Title
  doc.fontSize(20)
    .fillColor(colors.primary)
    .font('Helvetica-Bold')
    .text('MONTHLY TIMESHEET', startX, y, { width: pageWidth, align: 'center' });
  
  y += 35;

  // Header box
  const boxHeight = 100;
  doc.rect(startX, y, pageWidth, boxHeight)
    .fillAndStroke(colors.headerBg, colors.border);

  y += 15;
  const leftCol = startX + 15;
  const rightCol = startX + pageWidth / 2;

  // Left column info
  doc.fontSize(11)
    .fillColor(colors.text)
    .font('Helvetica-Bold')
    .text('Employee:', leftCol, y)
    .font('Helvetica')
    .text(`${data.user.firstName} ${data.user.lastName}`, leftCol + 70, y);

  y += 18;
  doc.font('Helvetica-Bold')
    .text('Email:', leftCol, y)
    .font('Helvetica')
    .text(data.user.email, leftCol + 70, y);

  y += 18;
  doc.font('Helvetica-Bold')
    .text('Facility:', leftCol, y)
    .font('Helvetica')
    .text(data.user.facilityName || 'N/A', leftCol + 70, y);

  // Right column info - reset y
  y = 40 + 35 + 15;
  doc.font('Helvetica-Bold')
    .text('Period:', rightCol, y)
    .font('Helvetica')
    .text(`${data.period.monthName} ${data.period.year}`, rightCol + 70, y);

  y += 18;
  if (data.user.regionName) {
    doc.font('Helvetica-Bold')
      .text('Region:', rightCol, y)
      .font('Helvetica')
      .text(data.user.regionName, rightCol + 70, y);
  }

  y += 18;
  if (data.user.councilName) {
    doc.font('Helvetica-Bold')
      .text('Council:', rightCol, y)
      .font('Helvetica')
      .text(data.user.councilName, rightCol + 70, y);
  }

  y += 18;
  doc.font('Helvetica-Bold')
    .text('Generated:', rightCol, y)
    .font('Helvetica')
    .text(new Date().toLocaleDateString('en-GB'), rightCol + 70, y);
};

/**
 * Draw table with attendance data
 */
const drawTable = (doc, data, startX, pageWidth, colors) => {
  let y = 180;
  const rowHeight = 18;

  // Column widths
  const colWidths = {
    day: 35,
    date: 65,
    clockIn: 50,
    clockOut: 50,
    hours: 45,
    activity: 130,
    description: pageWidth - 35 - 65 - 50 - 50 - 45 - 130
  };

  // Table header
  doc.rect(startX, y, pageWidth, rowHeight + 4)
    .fillAndStroke(colors.primary, colors.primary);

  let x = startX + 5;
  doc.fontSize(9)
    .fillColor('white')
    .font('Helvetica-Bold');

  doc.text('Day', x, y + 5, { width: colWidths.day });
  x += colWidths.day;
  doc.text('Date', x, y + 5, { width: colWidths.date });
  x += colWidths.date;
  doc.text('Clock In', x, y + 5, { width: colWidths.clockIn });
  x += colWidths.clockIn;
  doc.text('Clock Out', x, y + 5, { width: colWidths.clockOut });
  x += colWidths.clockOut;
  doc.text('Hours', x, y + 5, { width: colWidths.hours });
  x += colWidths.hours;
  doc.text('Activity', x, y + 5, { width: colWidths.activity });
  x += colWidths.activity;
  doc.text('Description', x, y + 5, { width: colWidths.description });

  y += rowHeight + 4;

  // Table rows
  doc.fontSize(8).font('Helvetica');

  for (const dayData of data.days) {
    // Check if we need a new page
    if (y > doc.page.height - 150) {
      doc.addPage();
      y = 40;
    }

    const bgColor = dayData.isSunday ? colors.sundayBg : (y % 2 === 0 ? 'white' : '#f9f9f9');
    
    doc.rect(startX, y, pageWidth, rowHeight)
      .fillAndStroke(bgColor, colors.border);

    x = startX + 5;
    doc.fillColor(dayData.isSunday ? '#999' : colors.text);

    // Day
    const dayText = dayData.isSunday ? dayData.day.toUpperCase() : dayData.day;
    doc.text(dayText, x, y + 4, { width: colWidths.day });
    x += colWidths.day;

    // Date
    doc.text(dayData.date, x, y + 4, { width: colWidths.date });
    x += colWidths.date;

    if (dayData.isSunday) {
      // Sunday row
      doc.fillColor('#999')
        .text('--:--', x, y + 4, { width: colWidths.clockIn });
      x += colWidths.clockIn;
      doc.text('--:--', x, y + 4, { width: colWidths.clockOut });
      x += colWidths.clockOut;
      doc.text('--', x, y + 4, { width: colWidths.hours });
      x += colWidths.hours;
      doc.text('--', x, y + 4, { width: colWidths.activity });
      x += colWidths.activity;
      doc.text('(Sunday - Non-working)', x, y + 4, { width: colWidths.description });
    } else if (dayData.attendance) {
      // Day with attendance
      doc.fillColor(colors.text)
        .text(dayData.attendance.clockIn || '--:--', x, y + 4, { width: colWidths.clockIn });
      x += colWidths.clockIn;
      doc.text(dayData.attendance.clockOut || '--:--', x, y + 4, { width: colWidths.clockOut });
      x += colWidths.clockOut;
      doc.text(dayData.attendance.hoursWorked || '0.00', x, y + 4, { width: colWidths.hours });
      x += colWidths.hours;
      doc.text(dayData.attendance.activityName || '--', x, y + 4, { width: colWidths.activity, ellipsis: true });
      x += colWidths.activity;
      doc.text(dayData.attendance.activityDescription || '', x, y + 4, { width: colWidths.description - 10, ellipsis: true });
    } else {
      // No attendance
      doc.fillColor(colors.lightText)
        .text('--:--', x, y + 4, { width: colWidths.clockIn });
      x += colWidths.clockIn;
      doc.text('--:--', x, y + 4, { width: colWidths.clockOut });
      x += colWidths.clockOut;
      doc.text('0.00', x, y + 4, { width: colWidths.hours });
      x += colWidths.hours;
      doc.text('--', x, y + 4, { width: colWidths.activity });
      x += colWidths.activity;
      doc.text('(No attendance)', x, y + 4, { width: colWidths.description });
    }

    y += rowHeight;
  }

  // Total row
  doc.rect(startX, y, pageWidth, rowHeight + 4)
    .fillAndStroke(colors.headerBg, colors.border);

  doc.fontSize(10)
    .font('Helvetica-Bold')
    .fillColor(colors.text)
    .text(`TOTAL HOURS: ${data.summary.totalHours}`, startX + pageWidth / 2, y + 5, { 
      width: pageWidth / 2 - 10, 
      align: 'right' 
    });

  return y + rowHeight + 4;
};

/**
 * Draw footer with summary and signature lines
 */
const drawFooter = (doc, data, startX, pageWidth, colors) => {
  // Move to last page and find appropriate position
  let y = doc.y + 30;

  // Check if we need a new page for footer
  if (y > doc.page.height - 180) {
    doc.addPage();
    y = 40;
  }

  // Summary box
  const summaryHeight = 80;
  doc.rect(startX, y, pageWidth, summaryHeight)
    .fillAndStroke(colors.headerBg, colors.border);

  y += 15;
  doc.fontSize(12)
    .font('Helvetica-Bold')
    .fillColor(colors.text)
    .text('Summary:', startX + 15, y);

  y += 20;
  doc.fontSize(10).font('Helvetica');
  
  const leftCol = startX + 15;
  const rightCol = startX + pageWidth / 2;

  doc.text(`Working Days: ${data.summary.workingDays}`, leftCol, y);
  doc.text(`Total Hours: ${data.summary.totalHours}`, rightCol, y);
  
  y += 16;
  doc.text(`Days Attended: ${data.summary.daysAttended}`, leftCol, y);
  if (data.summary.missingClockOut > 0) {
    doc.fillColor('red')
      .text(`Missing Clock-Out: ${data.summary.missingClockOut}`, rightCol, y);
    doc.fillColor(colors.text);
  }

  y += summaryHeight - 15;

  // Signature section
  y += 20;
  const sigWidth = (pageWidth - 40) / 2;

  doc.fontSize(10).font('Helvetica');
  
  // Employee signature
  doc.text('Employee Signature:', leftCol, y);
  doc.moveTo(leftCol + 110, y + 10)
    .lineTo(leftCol + sigWidth, y + 10)
    .stroke(colors.border);
  doc.text('Date:', leftCol + sigWidth + 20, y);
  doc.moveTo(leftCol + sigWidth + 50, y + 10)
    .lineTo(leftCol + sigWidth + 120, y + 10)
    .stroke(colors.border);

  y += 30;

  // Supervisor signature
  doc.text('Supervisor Signature:', leftCol, y);
  doc.moveTo(leftCol + 110, y + 10)
    .lineTo(leftCol + sigWidth, y + 10)
    .stroke(colors.border);
  doc.text('Date:', leftCol + sigWidth + 20, y);
  doc.moveTo(leftCol + sigWidth + 50, y + 10)
    .lineTo(leftCol + sigWidth + 120, y + 10)
    .stroke(colors.border);

  // Footer note
  y += 40;
  doc.fontSize(8)
    .fillColor(colors.lightText)
    .text('Generated by WOTI Attendance System', startX, y, { width: pageWidth, align: 'center' });
};

module.exports = {
  generateTimesheetPDF
};
