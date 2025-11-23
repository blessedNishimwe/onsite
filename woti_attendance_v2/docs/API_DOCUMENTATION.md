# API Documentation - WOTI Attendance V2

## Base URL
```
Development: http://localhost:3000/api
Production: https://api.woti.rw/api
```

## Authentication

All protected endpoints require JWT token in Authorization header:
```
Authorization: Bearer <token>
```

---

## 🔐 Authentication Endpoints

### Register User (Admin Only)
```http
POST /api/auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "phone": "+250788123456",
  "password": "SecurePass@123",
  "first_name": "John",
  "last_name": "Doe",
  "role": "tester",
  "facility_id": "uuid",
  "supervisor_id": "uuid"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": { ... },
    "token": "jwt_token",
    "refreshToken": "refresh_token"
  }
}
```

### Login
```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "admin@woti.rw",
  "password": "Admin@123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "admin@woti.rw",
      "first_name": "System",
      "last_name": "Administrator",
      "role": "admin",
      "facility_name": "Central Hospital",
      "council_name": "Gasabo",
      "region_name": "Kigali City"
    },
    "token": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

### Refresh Token
```http
POST /api/auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "refresh_token_here"
}
```

---

## 👤 User Endpoints

### Get Current User Profile
```http
GET /api/users/me
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "tester",
      "facility_name": "Health Center A",
      "council_name": "Gasabo",
      "region_name": "Kigali City",
      "supervisor_first_name": "Jane",
      "supervisor_last_name": "Smith"
    }
  }
}
```

### List All Users (Admin)
```http
GET /api/users?page=1&limit=10&role=tester&search=john
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 10, max: 100)
- `role` (string): Filter by role
- `facility_id` (uuid): Filter by facility
- `is_active` (boolean): Filter by active status
- `search` (string): Search name or email
- `sort` (string): Sort field
- `order` (string): asc/desc

**Response (200):**
```json
{
  "success": true,
  "data": {
    "users": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "totalPages": 10
    }
  }
}
```

### Update User
```http
PUT /api/users/:id
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "first_name": "Updated Name",
  "phone": "+250788999999",
  "facility_id": "new_facility_uuid"
}
```

---

## 🏥 Facility Endpoints

### Import Facilities (Admin)
```http
POST /api/facilities/import
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: CSV or Excel file

**CSV Format:**
```csv
name,council,facility_type,latitude,longitude,phone,email,address
Central Hospital,Gasabo,hospital,-1.9536,30.0606,+250788123456,hospital@example.com,KN 123 St
```

**Response (200):**
```json
{
  "success": true,
  "message": "Successfully imported 50 facilities",
  "data": {
    "summary": {
      "total_rows": 55,
      "valid_rows": 52,
      "invalid_rows": 3,
      "inserted": 50,
      "failed": 2
    },
    "validation_errors": [...],
    "insert_errors": [...]
  }
}
```

### List Facilities
```http
GET /api/facilities?page=1&limit=10&council_id=uuid&search=hospital
Authorization: Bearer <token>
```

**Query Parameters:**
- `page`, `limit`: Pagination
- `council_id`: Filter by council
- `region_id`: Filter by region
- `facility_type`: Filter by type (hospital, health_center, clinic, dispensary, other)
- `is_active`: Filter by active status
- `search`: Search by name or code

### Get Facility Details
```http
GET /api/facilities/:id
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "facility": {
      "id": "uuid",
      "name": "Central Hospital",
      "code": "CH001",
      "facility_type": "hospital",
      "latitude": -1.9536,
      "longitude": 30.0606,
      "council_name": "Gasabo",
      "region_name": "Kigali City",
      "phone": "+250788123456",
      "email": "hospital@example.com"
    }
  }
}
```

---

## ⏰ Attendance Endpoints

### Clock In
```http
POST /api/attendance/clock-in
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "facility_id": "uuid",
  "clock_in_latitude": -1.9536,
  "clock_in_longitude": 30.0606,
  "device_id": "device-12345",
  "client_timestamp": "2025-11-23T08:00:00Z"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Clocked in successfully",
  "data": {
    "attendance": {
      "id": "uuid",
      "user_id": "uuid",
      "facility_id": "uuid",
      "clock_in_time": "2025-11-23T08:00:00Z",
      "status": "active"
    }
  }
}
```

### Clock Out
```http
POST /api/attendance/clock-out
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "clock_out_latitude": -1.9536,
  "clock_out_longitude": 30.0606,
  "notes": "Completed daily tasks",
  "client_timestamp": "2025-11-23T17:00:00Z"
}
```

### Sync Offline Records
```http
POST /api/attendance/sync
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "records": [
    {
      "facility_id": "uuid",
      "clock_in_time": "2025-11-20T08:00:00Z",
      "clock_out_time": "2025-11-20T17:00:00Z",
      "clock_in_latitude": -1.9536,
      "clock_in_longitude": 30.0606,
      "device_id": "device-12345",
      "client_timestamp": "2025-11-20T08:00:00Z",
      "sync_version": 1,
      "conflict_resolution_strategy": "server_wins"
    }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Synced 10 records",
  "data": {
    "summary": {
      "total_submitted": 12,
      "valid_records": 11,
      "inserted": 8,
      "updated": 2,
      "failed": 1,
      "validation_errors": 1
    }
  }
}
```

### Get My Attendance Records
```http
GET /api/attendance/my-records?start_date=2025-11-01&end_date=2025-11-30
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "records": [
      {
        "id": "uuid",
        "clock_in_time": "2025-11-23T08:00:00Z",
        "clock_out_time": "2025-11-23T17:00:00Z",
        "facility_name": "Central Hospital",
        "status": "completed"
      }
    ],
    "pagination": { ... }
  }
}
```

---

## ⚠️ Error Responses

### 400 Bad Request
```json
{
  "error": "Validation Error",
  "message": "Invalid request data",
  "errors": ["Email is required", "Password must be at least 8 characters"]
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Invalid token",
  "code": "INVALID_TOKEN"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions"
}
```

### 429 Too Many Requests
```json
{
  "error": "Too Many Requests",
  "message": "Too many requests, please try again later",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 1800
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "Something went wrong"
}
```

---

## 📋 Rate Limits

- **Authentication endpoints**: 5 requests per 15 minutes
- **File uploads**: 10 requests per hour
- **General API**: 100 requests per 15 minutes

---

## 🔄 Offline Sync Protocol

1. **Client stores records locally** when offline
2. **On reconnection**, batch send to `/api/attendance/sync`
3. **Include metadata**: `device_id`, `client_timestamp`, `sync_version`
4. **Server resolves conflicts** based on strategy
5. **Client receives** sync results with conflicts

**Conflict Resolution Strategies:**
- `server_wins`: Server data takes precedence (default)
- `client_wins`: Client data takes precedence
- `manual`: Flag for manual review

---

## 📊 Response Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error
- `503` - Service Unavailable
