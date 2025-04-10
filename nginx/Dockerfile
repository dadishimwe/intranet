FROM arm64v8/node:18-alpine as base

# Create app directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache curl bash tzdata

# Set timezone
ENV TZ=UTC

# Copy package.json files
COPY package*.json ./

# Set up production environment
FROM base as production

# Install production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application files
COPY . .

# Create necessary directories
RUN mkdir -p logs uploads/documents uploads/receipts uploads/profiles

# Create non-root user
RUN addgroup -S appgroup && \
    adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose the API port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Start the server
CMD ["node", "server.js"]

# Development environment
FROM base as development

# Install all dependencies including dev dependencies
RUN npm install && \
    npm cache clean --force

# Copy application files
COPY . .

# Create necessary directories
RUN mkdir -p logs uploads/documents uploads/receipts uploads/profiles

# Expose the API port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=development

# Start the server in development mode
CMD ["npm", "run", "dev"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1