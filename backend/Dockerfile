FROM node:16-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
# We copy package.json and package-lock.json first to leverage Docker layer caching
COPY package*.json ./

# Install dependencies with production optimization
RUN npm ci --only=production

# Copy the rest of the application
COPY . .

# Create directories for logs and uploads
RUN mkdir -p logs uploads/receipts uploads/documents uploads/profiles

# Set permissions for the directories
RUN chmod -R 755 uploads

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["node", "server.js"]