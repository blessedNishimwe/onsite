// src/modules/email/email.service.js
/**
 * Email Service
 * Handles email sending functionality for verification, notifications, etc.
 */

const nodemailer = require('nodemailer');
const logger = require('../../utils/logger');

/**
 * Create email transporter based on environment configuration
 * @returns {Object} Nodemailer transporter
 */
const createTransporter = () => {
  const emailService = process.env.EMAIL_SERVICE || 'gmail';
  
  let transportConfig = {};
  
  switch (emailService.toLowerCase()) {
    case 'gmail':
      transportConfig = {
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      };
      break;
      
    case 'sendgrid':
      transportConfig = {
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY
        }
      };
      break;
      
    case 'ses':
      transportConfig = {
        host: process.env.EMAIL_HOST || 'email-smtp.us-east-1.amazonaws.com',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: false,
        auth: {
          user: process.env.AWS_SES_USERNAME,
          pass: process.env.AWS_SES_PASSWORD
        }
      };
      break;
      
    default:
      // Custom SMTP configuration
      transportConfig = {
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      };
  }
  
  return nodemailer.createTransport(transportConfig);
};

/**
 * Generate verification email HTML template
 * @param {Object} data - Email data
 * @returns {string} HTML email content
 */
const generateVerificationEmailTemplate = ({ firstName, verificationToken, verificationLink }) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background-color: #4CAF50;
          color: white;
          padding: 20px;
          text-align: center;
          border-radius: 5px 5px 0 0;
        }
        .content {
          background-color: #f9f9f9;
          padding: 30px;
          border-radius: 0 0 5px 5px;
        }
        .verification-code {
          background-color: #fff;
          border: 2px dashed #4CAF50;
          padding: 20px;
          text-align: center;
          font-size: 32px;
          font-weight: bold;
          letter-spacing: 5px;
          margin: 20px 0;
          color: #4CAF50;
        }
        .button {
          display: inline-block;
          background-color: #4CAF50;
          color: white;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 5px;
          margin: 20px 0;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          color: #777;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>WOTI Attendance System</h1>
      </div>
      <div class="content">
        <h2>Welcome, ${firstName}!</h2>
        <p>Thank you for registering with WOTI Attendance. To complete your registration, please verify your email address.</p>
        
        <p><strong>Your verification code is:</strong></p>
        <div class="verification-code">${verificationToken}</div>
        
        ${verificationLink ? `
        <p style="text-align: center;">Or click the button below:</p>
        <div style="text-align: center;">
          <a href="${verificationLink}" class="button">Verify Email Address</a>
        </div>
        ` : ''}
        
        <p><strong>Important:</strong> This verification code will expire in 24 hours.</p>
        
        <p>If you did not create an account, please ignore this email.</p>
      </div>
      <div class="footer">
        <p>© 2025 WOTI Attendance System. All rights reserved.</p>
        <p>This is an automated email, please do not reply.</p>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate verification success email template
 * @param {Object} data - Email data
 * @returns {string} HTML email content
 */
const generateVerificationSuccessTemplate = ({ firstName }) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background-color: #4CAF50;
          color: white;
          padding: 20px;
          text-align: center;
          border-radius: 5px 5px 0 0;
        }
        .content {
          background-color: #f9f9f9;
          padding: 30px;
          border-radius: 0 0 5px 5px;
        }
        .success-icon {
          text-align: center;
          font-size: 64px;
          margin: 20px 0;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          color: #777;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>WOTI Attendance System</h1>
      </div>
      <div class="content">
        <div class="success-icon">✅</div>
        <h2>Email Verified Successfully!</h2>
        <p>Hello ${firstName},</p>
        <p>Your email has been successfully verified. Your account is now active and you can start using the WOTI Attendance system.</p>
        <p>You can now log in using your email and password.</p>
      </div>
      <div class="footer">
        <p>© 2025 WOTI Attendance System. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
};

/**
 * Send verification email to user
 * @param {string} email - Recipient email address
 * @param {string} firstName - User's first name
 * @param {string} verificationToken - Verification token/code
 * @param {string} verificationLink - Optional verification link
 * @returns {Promise<Object>} Send result
 */
const sendVerificationEmail = async (email, firstName, verificationToken, verificationLink = null) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM || 'WOTI Attendance'}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify Your Email - WOTI Attendance',
      html: generateVerificationEmailTemplate({ firstName, verificationToken, verificationLink }),
      text: `Welcome ${firstName}! Your verification code is: ${verificationToken}. This code will expire in 24 hours.`
    };
    
    const result = await transporter.sendMail(mailOptions);
    
    logger.info('Verification email sent successfully', {
      email,
      messageId: result.messageId
    });
    
    return {
      success: true,
      messageId: result.messageId
    };
  } catch (error) {
    logger.error('Failed to send verification email', {
      email,
      error: error.message
    });
    throw new Error('Failed to send verification email');
  }
};

/**
 * Send verification success email
 * @param {string} email - Recipient email address
 * @param {string} firstName - User's first name
 * @returns {Promise<Object>} Send result
 */
const sendVerificationSuccessEmail = async (email, firstName) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM || 'WOTI Attendance'}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Email Verified Successfully - WOTI Attendance',
      html: generateVerificationSuccessTemplate({ firstName }),
      text: `Hello ${firstName}, your email has been successfully verified. Your account is now active.`
    };
    
    const result = await transporter.sendMail(mailOptions);
    
    logger.info('Verification success email sent', {
      email,
      messageId: result.messageId
    });
    
    return {
      success: true,
      messageId: result.messageId
    };
  } catch (error) {
    logger.error('Failed to send verification success email', {
      email,
      error: error.message
    });
    // Don't throw error - verification success email is not critical
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Test email configuration
 * @returns {Promise<boolean>} Whether email service is configured correctly
 */
const testEmailConfiguration = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    logger.info('Email service configured successfully');
    return true;
  } catch (error) {
    logger.error('Email service configuration failed', {
      error: error.message
    });
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
  sendVerificationSuccessEmail,
  testEmailConfiguration
};
