# Update the config.js file
docker-compose exec backend sh -c "cat > /app/config/config.js << 'EOF'
// Main configuration file
const database = require('./database');
const auth = require('./auth');

const config = {
  port: process.env.PORT || 3000,
  
  // Include database and auth configurations
  database: database,
  auth: auth,
  
  // CORS configuration
  allowedOrigins: process.env.ALLOWED_ORIGINS || 'http://localhost,http://localhost:8080',
  
  // File uploads configuration
  uploads: {
    path: process.env.FILE_UPLOAD_PATH || '/app/uploads',
    maxSize: parseInt(process.env.MAX_FILE_SIZE || '5242880'), // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 
                  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log'
  },
  
  // Raspberry Pi specific configuration
  piTempMonitor: process.env.PI_TEMP_MONITOR === 'true' || false
};

module.exports = { config };
EOF"
