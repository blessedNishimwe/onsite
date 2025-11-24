# Email Verification System

## Overview

The WOTI Attendance system now supports user self-registration with email verification. This feature allows users to create their own accounts without administrator intervention, while ensuring email ownership through a verification process.

## Features

### 1. Self-Registration
- Public endpoint for user signup
- No authentication required
- Role restrictions apply (only tester, data_clerk, focal roles allowed)
- Password strength validation
- Email and phone uniqueness validation

### 2. Email Verification
- 6-digit verification code sent via email
- 24-hour token expiration
- Account activation upon verification
- Immediate login with JWT tokens after verification

### 3. Email Service
- Support for multiple email providers:
  - Gmail
  - SendGrid
  - AWS SES
- HTML email templates with professional styling
- Configurable via environment variables

## API Endpoints

### POST /api/auth/signup

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "phone": "+250788123456",
  "password": "StrongPass123!",
  "first_name": "John",
  "last_name": "Doe",
  "role": "tester",
  "facility_id": "uuid-optional"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Registration successful. Please check your email for verification code.",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "phone": "+250788123456",
      "first_name": "John",
      "last_name": "Doe",
      "role": "tester",
      "facility_id": null,
      "is_active": false,
      "email_verified": false,
      "created_at": "2025-11-24T12:00:00.000Z"
    }
  }
}
```

**Validation Rules:**
- Email: Valid email format, unique
- Phone: Rwanda format (+250xxxxxxxxx or 07xxxxxxxx/08xxxxxxxx), unique
- Password: Minimum 8 characters, must contain:
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character
- Role: Must be one of: tester, data_clerk, focal
- Facility ID: Must be valid UUID if provided

### POST /api/auth/verify-email

Verify email address with the code sent to the user's email.

**Request Body:**
```json
{
  "token": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Email verified successfully. You can now login.",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "tester",
      "facility_id": null
    },
    "token": "jwt-access-token",
    "refreshToken": "jwt-refresh-token"
  }
}
```

**Error Responses:**
- Invalid or expired token (400/500)
- Already verified (400/500)

### POST /api/auth/resend-verification

Request a new verification code.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Verification email sent successfully"
}
```

**Error Responses:**
- User not found (404/500)
- Email already verified (400/500)

## Configuration

### Environment Variables

Add the following to your `.env` file:

```bash
# Email Configuration
EMAIL_SERVICE=gmail                    # gmail, sendgrid, or ses
EMAIL_HOST=smtp.gmail.com              # SMTP host (for custom or SES)
EMAIL_PORT=587                         # SMTP port
EMAIL_USER=your-email@gmail.com        # Email account
EMAIL_PASSWORD=your-app-password       # App password or API key
EMAIL_FROM=WOTI Attendance             # Sender name
EMAIL_SECURE=false                     # Use TLS (false for STARTTLS)
```

### Gmail Setup

1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
3. Use the generated password as `EMAIL_PASSWORD`

### SendGrid Setup

```bash
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=your-sendgrid-api-key
```

### AWS SES Setup

```bash
EMAIL_SERVICE=ses
EMAIL_HOST=email-smtp.us-east-1.amazonaws.com
EMAIL_PORT=587
AWS_SES_USERNAME=your-ses-smtp-username
AWS_SES_PASSWORD=your-ses-smtp-password
```

## Database Schema

New columns added to `users` table:

```sql
email_verified BOOLEAN DEFAULT FALSE NOT NULL
verification_token VARCHAR(255)
verification_token_expires TIMESTAMP WITH TIME ZONE
```

## Security Features

1. **Password Strength**: Enforced at validation layer
2. **Rate Limiting**: All auth endpoints are rate-limited
3. **Token Expiration**: Verification tokens expire after 24 hours
4. **Role Restrictions**: Self-registered users cannot be admin or supervisor
5. **Enumeration Prevention**: Generic error messages for existing emails/phones
6. **Account Activation**: Users must verify email before login

## Activity Logging

All verification-related actions are logged to the `activities` table:

- `signup`: User registration attempt
- `email_verified`: Successful email verification
- `resend_verification`: Verification email resent

## Migration

Run the migration to add email verification columns:

```bash
psql -d woti_attendance -f database/migrations/002_add_email_verification.sql
```

## Testing

### Manual Testing

1. **Register a new user:**
```bash
curl -X POST http://localhost:5500/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "phone": "+250788123456",
    "password": "TestPass123!",
    "first_name": "Test",
    "last_name": "User",
    "role": "tester"
  }'
```

2. **Get verification token from database:**
```bash
psql -d woti_attendance -c "SELECT verification_token FROM users WHERE email = 'test@example.com';"
```

3. **Verify email:**
```bash
curl -X POST http://localhost:5500/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"token": "123456"}'
```

4. **Login:**
```bash
curl -X POST http://localhost:5500/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!"
  }'
```

## Troubleshooting

### Email Not Sending

1. Check email service configuration
2. Verify credentials are correct
3. Check logs: `tail -f logs/error.log`
4. Test email configuration:
   ```javascript
   const { testEmailConfiguration } = require('./src/modules/email/email.service');
   testEmailConfiguration();
   ```

### Token Expired

- Tokens expire after 24 hours
- Use the resend verification endpoint to get a new token

### Cannot Login After Registration

- Email must be verified first
- Check `email_verified` status in database
- Use verify-email endpoint with correct token

## Admin Registration

Administrator-created users (via `/api/auth/register`) are automatically verified and active. This endpoint requires admin authentication and allows all roles including admin and supervisor.

## Future Enhancements

- [ ] Email template customization via admin panel
- [ ] SMS verification as alternative to email
- [ ] Password reset via email
- [ ] Account recovery flows
- [ ] Multi-language email templates
