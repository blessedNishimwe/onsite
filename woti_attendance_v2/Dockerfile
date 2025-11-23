# ============================================================================
# WOTI Attendance V2 - Multi-stage Dockerfile
# ============================================================================
# Build: docker build -t woti-attendance-v2 .
# Run: docker run -p 3000:3000 --env-file .env woti-attendance-v2
# ============================================================================

# ============================================================================
# Stage 1: Build
# ============================================================================
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# ============================================================================
# Stage 2: Production
# ============================================================================
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Install production dependencies only
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY --chown=nodejs:nodejs . .

# Create required directories
RUN mkdir -p uploads logs && \
    chown -R nodejs:nodejs uploads logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "src/server.js"]
