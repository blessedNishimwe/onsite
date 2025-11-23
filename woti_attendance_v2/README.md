# WOTI Attendance V2 - Backend API

High-performance, secure monolithic backend for WOTI Attendance tracking system supporting React Native mobile clients and React admin web panel with offline sync capabilities.

## 🚀 Features

- ✅ **Authentication & Authorization**: JWT-based auth with bcrypt (12 rounds), role-based access control
- ✅ **Offline Sync**: Full support for mobile offline attendance tracking with conflict resolution
- ✅ **Geographic Hierarchy**: Regions → Councils → Facilities
- ✅ **CSV/Excel Import**: Bulk facility import with validation
- ✅ **High Performance**: Connection pooling (20-100 connections), optimized queries, supports 1,000+ concurrent users
- ✅ **Security**: Parameterized queries, rate limiting, input validation, audit logging
- ✅ **Production Ready**: Docker support, health checks, structured logging

## 📋 Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL 15
- **Connection Pool**: pg + pgbouncer
- **Authentication**: JWT (jsonwebtoken) + bcrypt
- **File Processing**: csv-parser, xlsx
- **Logging**: Winston
- **Security**: Helmet, CORS, rate limiting

## 🏗️ Project Structure

```
woti_attendance_v2/
├── database/
│   ├── migrations/          # Database migrations
│   ├── schema/              # Schema definitions
│   └── seeds/               # Seed data (regions, councils, admin)
├── docs/                    # API and system documentation
├── src/
│   ├── config/              # Configuration files
│   ├── middleware/          # Express middleware
│   ├── modules/             # Feature modules
│   │   ├── auth/            # Authentication & registration
│   │   ├── users/           # User management
│   │   ├── facilities/      # Facility management & import
│   │   └── attendance/      # Attendance tracking & sync
│   ├── utils/               # Utility functions
│   ├── app.js               # Express app configuration
│   └── server.js            # Server entry point
├── tests/
│   ├── unit/                # Unit tests
│   └── integration/         # Integration tests
├── uploads/                 # File upload directory
├── logs/                    # Application logs
├── .env.example             # Environment variables template
├── docker-compose.yml       # Docker composition
├── Dockerfile               # Container definition
└── package.json             # Dependencies
```

## 🔧 Installation & Setup

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 15+
- Docker & Docker Compose (optional)

### Local Development Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd woti_attendance_v2
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your database credentials and secrets
```

4. **Setup database**
```bash
# Create database
createdb woti_attendance

# Run migrations
psql -U postgres -d woti_attendance -f database/migrations/001_initial_schema.sql

# Seed data
psql -U postgres -d woti_attendance -f database/seeds/001_regions_councils.sql
psql -U postgres -d woti_attendance -f database/seeds/002_admin_user.sql
```

5. **Start development server**
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

### Docker Setup

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

## 🔑 Default Credentials

**⚠️ IMPORTANT**: Change these immediately after first login!

```
Email: admin@woti.rw
Password: Admin@123
```

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user (admin only)
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users/me` - Get current user profile
- `GET /api/users` - List users (admin)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Deactivate user (admin)

### Facilities
- `POST /api/facilities/import` - Import from CSV/Excel (admin)
- `GET /api/facilities` - List facilities
- `GET /api/facilities/:id` - Get facility details
- `POST /api/facilities` - Create facility (admin)
- `PUT /api/facilities/:id` - Update facility (admin)
- `DELETE /api/facilities/:id` - Deactivate facility (admin)

### Attendance
- `POST /api/attendance/clock-in` - Clock in
- `POST /api/attendance/clock-out` - Clock out
- `POST /api/attendance/sync` - Bulk sync offline records
- `GET /api/attendance/my-records` - Get own attendance history
- `GET /api/attendance` - List all attendance (admin)
- `GET /api/attendance/stats` - Get statistics

### System
- `GET /health` - Health check endpoint

## 🔐 User Roles

1. **admin** - Full system access
2. **backstopper** - Regional oversight
3. **supervisor** - Team management
4. **ddo** - District data officer
5. **focal** - Facility focal person
6. **data_clerk** - Data entry
7. **tester** - Field testing

## 🌍 Geographic Hierarchy

```
Rwanda
├── Regions (5)
│   ├── Kigali City
│   ├── Eastern Province
│   ├── Northern Province
│   ├── Southern Province
│   └── Western Province
├── Councils/Districts (30)
└── Facilities (Health facilities)
```

## 📊 Database Schema

**6 Core Tables:**
- `regions` - Geographic regions
- `councils` - Districts/councils
- `facilities` - Health facilities with geolocation
- `users` - System users with roles
- `attendance` - Clock in/out records with offline sync
- `activities` - Audit logs

## 🔄 Offline Sync

The system supports offline attendance tracking with:
- **Client timestamp** tracking
- **Device ID** identification
- **Sync version** management
- **Conflict resolution** strategies (client_wins, server_wins, manual)
- **Batch synchronization** endpoint

## 🧪 Testing

```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Watch mode
npm run test:watch
```

## 📝 Environment Variables

See `.env.example` for complete list. Key variables:

```env
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_NAME=woti_attendance
DB_USER=postgres
DB_PASSWORD=your_password
DB_POOL_MIN=20
DB_POOL_MAX=100
JWT_SECRET=your_jwt_secret
BCRYPT_ROUNDS=12
```

## 🚀 Production Deployment

1. **Build Docker image**
```bash
docker build -t woti-attendance-v2:latest .
```

2. **Configure environment variables**
```bash
# Update production .env file
vim .env.production
```

3. **Deploy with Docker Compose**
```bash
docker-compose -f docker-compose.yml up -d
```

4. **Setup SSL/TLS** (recommended)
- Configure nginx reverse proxy
- Use Let's Encrypt certificates
- Update CORS_ORIGINS in .env

## 📈 Performance

- **Concurrent Users**: 1,000+
- **Connection Pool**: 20-100 connections (tunable)
- **Query Optimization**: Indexed columns, parameterized queries
- **Rate Limiting**: Configured per endpoint
- **Caching**: Ready for Redis integration

## 🔒 Security Features

- ✅ Password hashing with bcrypt (12 rounds)
- ✅ JWT authentication with 24-hour expiry
- ✅ Role-based access control
- ✅ SQL injection prevention (parameterized queries)
- ✅ Rate limiting on sensitive endpoints
- ✅ Input validation and sanitization
- ✅ Audit logging for all operations
- ✅ HTTPS enforcement (production)
- ✅ Security headers (Helmet)

## 📖 Documentation

Detailed documentation available in `/docs`:
- API Documentation
- Database Design
- Implementation Plan
- Offline Sync Design
- Security Guidelines

## 🤝 Contributing

1. Create feature branch
2. Make changes with tests
3. Submit pull request
4. Await code review

## 📄 License

ISC

## 👥 Support

For issues or questions:
- Create GitHub issue
- Contact: admin@woti.rw

---

**Version**: 1.0.0  
**Last Updated**: November 23, 2025  
**Status**: Production Ready ✅
