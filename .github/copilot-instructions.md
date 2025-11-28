# Copilot Coding Agent – Repository Instructions

Welcome to this project. These instructions tell GitHub Copilot how to analyze, modify, and extend this repository safely and correctly.

## 1. Project Overview
This is a Node.js + Express + PostgreSQL backend with a frontend built in HTML, CSS, and vanilla JavaScript.
Features include:
- User registration and login with JWT
- Email verification (if enabled)
- Admin approval workflow
- Attendance tracking with check-in, check-out
- Geolocation and geofencing logic for attendance
- REST API routes for user and attendance operations

Copilot should always start by analyzing the entire repository structure before making changes.

## 2. Goals for Copilot Coding Agent
When Copilot works on this repo, it should:
- Maintain clean and consistent code style
- Fix bugs without introducing regressions
- Improve reliability and security
- Preserve API contracts unless explicitly instructed
- Produce working, tested code before creating PRs

## 3. Files & Directories Structure (Important)
- `/woti_attendance_v2/src` — Backend source code
  - `modules/` → Feature modules (attendance, auth, email, facilities, users)
  - `middleware/` → JWT, auth, validation
  - `config/` → Database and auth configuration
  - `utils/` → helpers (logger, validators, etc.)
- `/woti_attendance_v2/public` — Static frontend HTML, CSS, JS
- `/woti_attendance_v2/.env.example` — Required environment variables
- `/woti_attendance_v2/package.json` — Dependencies + scripts
- `/woti_attendance_v2/database` — PostgreSQL schema migrations

Copilot must keep this structure intact.

## 4. Development Rules for Copilot
### 4.1 Backend Rules
- Use Express best practices
- Always validate request inputs
- Use parameterized SQL queries to prevent injection
- Ensure JWT auth is correct & secure
- Maintain a consistent error format:
  `{ success: false, message: "...", error?: ... }`
- Admin approval: only users with status `active` may log in

### 4.2 Frontend Rules
- Use vanilla JS (no frameworks unless requested)
- Keep scripts modular and readable
- Always use `fetch()` with proper headers
- Ensure location APIs handle denied permissions

### 4.3 Security Requirements
- Never hardcode secrets
- Use `.env` for sensitive variables
- Sanitize all user input
- Validate JWT in protected routes

## 5. How Copilot Should Work on this Repo
When Copilot starts a task:
1. **Read the entire codebase**
2. **Generate a brief analysis**
3. **Produce a plan**
4. **Apply small, safe changes in branches**
5. **Create a clear Pull Request with:**
   - Summary of the change
   - Files modified
   - Reasoning
   - Any breaking changes (rare)

## 6. Pull Request Requirements (Copilot)
Every PR must include:
- A human-readable description
- A list of modified files
- Explanation of why changes were needed
- Evidence that the app still works
- No commented-out legacy code unless necessary

## 7. Tasks Copilot Is Allowed to Do
Copilot may:
- Fix bugs
- Improve existing features
- Add new routes & controllers when instructed
- Refactor code for clarity & performance
- Patch security issues
- Improve frontend JS for attendance & geolocation
- Update SQL migrations safely

Copilot may NOT:
- Replace entire architectures unless explicitly asked
- Introduce new frameworks without permission

## 8. How to Trigger Copilot Tasks
Use repository or file-level instructions like:
- "Analyze this repository and fix all routing/auth bugs."
- "Implement admin approval logic."
- "Add geofencing validation to check-in endpoint."
- "Refactor login flow to use JWT refresh tokens."

These instructions must lead to clean, safe code in a PR.

## 9. Testing Requirements
Before submitting a PR:
- Copilot should ensure routes respond correctly
- Attendance check-in/out works end-to-end
- Admin approval is enforced
- Geolocation is validated in the frontend
- Run `npm test` from `/woti_attendance_v2` to execute the test suite
- Run `npm run lint` from `/woti_attendance_v2` to check code style

## 10. When in Doubt
Copilot must ask for clarification *in the PR description*, not in code.
