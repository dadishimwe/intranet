#!/bin/bash
# Setup script for Corporate Intranet on Raspberry Pi
set -e

# Print colorful messages
print_message() {
  echo -e "\e[1;34m>> $1\e[0m"
}

print_error() {
  echo -e "\e[1;31m>> ERROR: $1\e[0m"
  exit 1
}

print_success() {
  echo -e "\e[1;32m>> $1\e[0m"
}

# Check if script is run as root
if [ "$(id -u)" -ne 0 ]; then
  print_error "This script must be run as root. Try 'sudo ./setup.sh'"
fi

print_message "Starting Corporate Intranet installation on Raspberry Pi..."

# Check Raspberry Pi model
if [ ! -f /proc/device-tree/model ]; then
  print_error "Could not detect Raspberry Pi model. Are you sure this is a Raspberry Pi?"
fi

PI_MODEL=$(tr -d '\0' < /proc/device-tree/model)
print_message "Detected: $PI_MODEL"

# Check system resources
MEMORY=$(free -m | awk '/^Mem:/{print $2}')
DISK_SPACE=$(df -h / | awk 'NR==2 {print $4}')
CPU_CORES=$(nproc)

print_message "System resources:"
echo "Memory: ${MEMORY}MB"
echo "Available disk space: ${DISK_SPACE}"
echo "CPU cores: ${CPU_CORES}"

# Check minimum requirements
if [ "$MEMORY" -lt 1024 ]; then
  print_message "WARNING: Low memory detected. This application performs best with at least 2GB RAM."
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_error "Installation aborted."
  fi
fi

# Update system
print_message "Updating system packages..."
apt-get update && apt-get upgrade -y

# Install dependencies
print_message "Installing required packages..."
apt-get install -y \
  git \
  curl \
  gnupg \
  apt-transport-https \
  ca-certificates \
  software-properties-common \
  openssl

# Install Docker
if ! command -v docker &> /dev/null; then
  print_message "Installing Docker..."
  curl -sSL https://get.docker.com | sh
  usermod -aG docker pi
else
  print_message "Docker already installed."
fi

# Install Docker Compose
if ! command -v docker-compose &> /dev/null; then
  print_message "Installing Docker Compose..."
  apt-get install -y docker-compose
else
  print_message "Docker Compose already installed."
fi

# Clone repository or create project directory
APP_DIR="/opt/corporate-intranet"
if [ -d "$APP_DIR" ]; then
  print_message "Application directory already exists."
  read -p "Do you want to remove it and install fresh? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_message "Removing existing installation..."
    rm -rf "$APP_DIR"
    mkdir -p "$APP_DIR"
  fi
else
  print_message "Creating application directory..."
  mkdir -p "$APP_DIR"
fi

# Set proper permissions
chown -R pi:pi "$APP_DIR"
chmod -R 755 "$APP_DIR"

# Move to app directory
cd "$APP_DIR"

# Create project structure
print_message "Creating project structure..."
mkdir -p \
  nginx/conf \
  nginx/certificates \
  backend \
  database \
  frontend/public \
  frontend/src \
  scripts \
  backups \
  logs

# Generate self-signed SSL certificate for development
if [ ! -f nginx/certificates/cert.pem ] || [ ! -f nginx/certificates/key.pem ]; then
  print_message "Generating self-signed SSL certificate..."
  
  # Create OpenSSL configuration
  cat > openssl.cnf << EOL
[ req ]
default_bits        = 2048
default_keyfile     = key.pem
distinguished_name  = req_distinguished_name
req_extensions      = req_ext
prompt              = no

[ req_distinguished_name ]
C                   = US
ST                  = State
L                   = City
O                   = Organization
OU                  = Organizational Unit
CN                  = intranet.local

[ req_ext ]
subjectAltName      = @alt_names

[alt_names]
DNS.1               = intranet.local
DNS.2               = localhost
IP.1                = 127.0.0.1
EOL

  # Generate certificate
  openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout nginx/certificates/key.pem \
    -out nginx/certificates/cert.pem \
    -config openssl.cnf
  
  rm openssl.cnf
  chmod 600 nginx/certificates/key.pem
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
  print_message "Creating .env file..."
  
  # Generate random strings for secrets
  JWT_SECRET=$(openssl rand -hex 32)
  SESSION_SECRET=$(openssl rand -hex 32)
  DB_PASSWORD=$(openssl rand -hex 12)
  
  cat > .env << EOL
# Database Configuration
DB_NAME=corporate_intranet
DB_USER=intranet_user
DB_PASSWORD=${DB_PASSWORD}
DB_PORT=5432

# JWT Authentication
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRY=86400

# App Configuration
NODE_ENV=production
PORT=3000
FILE_UPLOAD_MAX_SIZE=10485760
ALLOWED_ORIGINS=http://localhost,https://intranet.local

# Security Settings
BCRYPT_SALT_ROUNDS=12
SESSION_SECRET=${SESSION_SECRET}
PASSWORD_MIN_LENGTH=8
MFA_ENABLED=false

# Raspberry Pi Specific
PI_TEMP_MONITOR=true
PI_TEMP_THRESHOLD=75
PI_MEMORY_LIMIT_PERCENT=85
EOL
fi

# Create necessary files for each component
print_message "Setting up component files..."

# Setup Nginx Dockerfile
cat > nginx/Dockerfile << EOL
FROM arm64v8/nginx:alpine

# Copy configuration files
COPY nginx.conf /etc/nginx/nginx.conf

# Create directories for uploads and certificates
RUN mkdir -p /var/www/uploads /etc/nginx/ssl

# Use non-root user
RUN adduser -D -H -u 1000 -s /bin/bash www-data && \
    chown -R www-data:www-data /var/www

EXPOSE 80 443

HEALTHCHECK --interval=30s --timeout=5s CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1
EOL

# Copy Nginx configuration
cp "$APP_DIR/nginx.conf" nginx/nginx.conf 2>/dev/null || cat > nginx/nginx.conf << EOL
worker_processes 1;

events {
    worker_connections 256;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    server_tokens off;
    
    # Logging settings
    access_log /var/log/nginx/access.log combined buffer=16k flush=10s;
    error_log /var/log/nginx/error.log warn;
    
    # Gzip settings
    gzip on;
    gzip_comp_level 4;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # Server configuration
    server {
        listen 80 default_server;
        server_name _;
        
        # Redirect to HTTPS
        return 301 https://\$host\$request_uri;
    }
    
    server {
        listen 443 ssl default_server;
        server_name _;
        
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN";
        add_header X-Content-Type-Options "nosniff";
        add_header X-XSS-Protection "1; mode=block";
        
        # Root directory for front-end files
        root /usr/share/nginx/html;
        index index.html;
        
        # API proxy
        location /api/ {
            proxy_pass http://backend:3000/api/;
            proxy_http_version 1.1;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            
            # Optimized timeouts for Raspberry Pi
            proxy_connect_timeout 120s;
            proxy_send_timeout 120s;
            proxy_read_timeout 120s;
        }
        
        # Health check endpoint
        location /health {
            proxy_pass http://backend:3000/health;
        }
        
        # File uploads
        location /uploads/ {
            alias /var/www/uploads/;
            add_header Cache-Control "public, max-age=86400";
        }
        
        # Serve frontend SPA
        location / {
            try_files \$uri \$uri/ /index.html;
        }
    }
}
EOL

# Create database backup script
cat > database/backup.sh << EOL
#!/bin/bash
set -e

# Get environment variables
source /root/.bashrc

# Set date format
BACKUP_DATE=\$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="/backups/db_backup_\${BACKUP_DATE}.sql.gz"

# Create backup
pg_dump -U "\${POSTGRES_USER}" -d "\${POSTGRES_DB}" | gzip > "\${BACKUP_FILE}"

# Keep only the last 14 days of backups
find /backups -name "db_backup_*.sql.gz" -type f -mtime +14 -delete

echo "Backup completed: \${BACKUP_FILE}"
EOL

chmod +x database/backup.sh

# Create database Dockerfile
cat > database/Dockerfile << EOL
FROM arm64v8/postgres:13-alpine

# Install cron
RUN apk add --no-cache bash curl tzdata

# Copy backup script
COPY backup.sh /usr/local/bin/backup.sh

# Add crontab file
RUN echo "\${BACKUP_SCHEDULE:-0 2 * * *} /usr/local/bin/backup.sh >> /var/log/cron.log 2>&1" > /etc/crontabs/root

# Entry point script
COPY <<'ENTRYPOINT_SCRIPT' /docker-entrypoint-initdb.d/start-cron.sh
#!/bin/bash
set -e

# Start cron daemon
crond -b -l 8

# Keep backup log
touch /var/log/cron.log
tail -f /var/log/cron.log &
ENTRYPOINT_SCRIPT

RUN chmod +x /docker-entrypoint-initdb.d/start-cron.sh
EOL

# Create empty frontend files
mkdir -p frontend/public frontend/src/components

cat > frontend/public/index.html << EOL
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Corporate Intranet</title>
  <link rel="icon" href="favicon.ico">
</head>
<body>
  <div id="app"></div>
</body>
</html>
EOL

# Create frontend Dockerfile
cat > frontend/Dockerfile << EOL
FROM arm64v8/node:18-alpine as build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build app
RUN npm run build

# Production stage
FROM arm64v8/nginx:alpine

# Copy built app
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config for SPA routing
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
EOL

# Create a sample Vue package.json for frontend
cat > frontend/package.json << EOL
{
  "name": "corporate-intranet-frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "serve": "vue-cli-service serve",
    "build": "vue-cli-service build",
    "lint": "vue-cli-service lint"
  },
  "dependencies": {
    "axios": "^1.3.6",
    "core-js": "^3.30.1",
    "vue": "^3.2.47",
    "vue-router": "^4.1.6",
    "vuex": "^4.1.0",
    "primevue": "^3.29.1"
  },
  "devDependencies": {
    "@vue/cli-plugin-babel": "~5.0.8",
    "@vue/cli-plugin-eslint": "~5.0.8",
    "@vue/cli-plugin-router": "~5.0.8",
    "@vue/cli-plugin-vuex": "~5.0.8",
    "@vue/cli-service": "~5.0.8",
    "eslint": "^8.39.0",
    "eslint-plugin-vue": "^9.11.0"
  }
}
EOL

# Create backup script
print_message "Creating backup script..."
cat > scripts/backup.sh << 'EOL'
#!/bin/bash
# Automatic backup script for Corporate Intranet

# Load environment variables
source /opt/corporate-intranet/.env

# Set backup directory
BACKUP_DIR="/opt/corporate-intranet/backups"
mkdir -p "$BACKUP_DIR"

# Set timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz"

# Backup database
echo "Creating database backup..."
docker exec corporate-intranet_database_1 pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

# Backup uploads
echo "Creating uploads backup..."
tar -czf "$BACKUP_DIR/uploads_$TIMESTAMP.tar.gz" -C /opt/corporate-intranet uploads

# Cleanup old backups (keeping last 7 days)
find "$BACKUP_DIR" -name "db_backup_*.sql.gz" -type f -mtime +7 -delete
find "$BACKUP_DIR" -name "uploads_*.tar.gz" -type f -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE"
EOL

chmod +x scripts/backup.sh

# Create update script
print_message "Creating update script..."
cat > scripts/update.sh << 'EOL'
#!/bin/bash
# Update script for Corporate Intranet

# Move to app directory
cd /opt/corporate-intranet

# Pull latest changes if using Git
# git pull

# Stop services
echo "Stopping services..."
docker-compose down

# Backup database
echo "Creating database backup..."
./scripts/backup.sh

# Rebuild and restart services
echo "Rebuilding and restarting services..."
docker-compose build
docker-compose up -d

echo "Update completed."
EOL

chmod +x scripts/update.sh

# Create monitoring script
print_message "Creating monitoring script..."
cat > scripts/monitor.sh << 'EOL'
#!/bin/bash
# Monitoring script for Corporate Intranet

# Set variables
APP_DIR="/opt/corporate-intranet"
LOG_FILE="$APP_DIR/logs/monitor.log"
THRESHOLD_CPU_TEMP=70  # degrees Celsius
THRESHOLD_DISK_SPACE=85  # percentage

# Check CPU temperature
check_temperature() {
  if [ -f /sys/class/thermal/thermal_zone0/temp ]; then
    temp=$(cat /sys/class/thermal/thermal_zone0/temp)
    temp_c=$((temp/1000))
    
    if [ "$temp_c" -gt "$THRESHOLD_CPU_TEMP" ]; then
      echo "[WARNING] $(date): CPU temperature is high: ${temp_c}°C" >> "$LOG_FILE"
    fi
    
    echo "CPU Temperature: ${temp_c}°C"
  else
    echo "Unable to read CPU temperature"
  fi
}

# Check disk space
check_disk_space() {
  disk_usage=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')
  
  if [ "$disk_usage" -gt "$THRESHOLD_DISK_SPACE" ]; then
    echo "[WARNING] $(date): Disk usage is high: ${disk_usage}%" >> "$LOG_FILE"
  fi
  
  echo "Disk Usage: ${disk_usage}%"
}

# Check Docker container status
check_containers() {
  echo "Container Status:"
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
  
  # Check for any stopped containers
  stopped=$(docker ps -a --format "{{.Names}}\t{{.Status}}" | grep -v "Up " | grep -v "NAMES")
  if [ ! -z "$stopped" ]; then
    echo "[WARNING] $(date): Some containers are not running:" >> "$LOG_FILE"
    echo "$stopped" >> "$LOG_FILE"
  fi
}

# Check memory usage
check_memory() {
  memory_used=$(free -m | awk 'NR==2 {print $3}')
  memory_total=$(free -m | awk 'NR==2 {print $2}')
  memory_percentage=$((memory_used * 100 / memory_total))
  
  echo "Memory Usage: ${memory_percentage}% (${memory_used}MB/${memory_total}MB)"
  
  if [ "$memory_percentage" -gt 85 ]; then
    echo "[WARNING] $(date): Memory usage is high: ${memory_percentage}%" >> "$LOG_FILE"
  fi
}

# Main function
main() {
  echo "======== System Status Check: $(date) ========"
  
  check_temperature
  check_disk_space
  check_memory
  check_containers
  
  echo "==========================================="
}

# Run the main function
main
EOL

chmod +x scripts/monitor.sh

# Set up automatic backups with cron
print_message "Setting up automatic backups..."
if ! crontab -l | grep -q "backup.sh"; then
  (crontab -l 2>/dev/null; echo "0 2 * * * /opt/corporate-intranet/scripts/backup.sh >> /opt/corporate-intranet/logs/backup.log 2>&1") | crontab -
fi

# Set up monitoring with cron
print_message "Setting up monitoring..."
if ! crontab -l | grep -q "monitor.sh"; then
  (crontab -l 2>/dev/null; echo "*/30 * * * * /opt/corporate-intranet/scripts/monitor.sh >> /opt/corporate-intranet/logs/monitor.log 2>&1") | crontab -
fi

# Start services
print_message "Starting services..."
docker-compose up -d

print_message "Waiting for services to start..."
sleep 10

# Check if services are running
if docker-compose ps | grep -q "Up"; then
  print_success "Installation completed successfully!"
  
  # Get IP address for access instructions
  IP_ADDRESS=$(hostname -I | awk '{print $1}')
  
  echo
  echo "-------------------------------------------------------"
  echo "Corporate Intranet is now running on your Raspberry Pi!"
  echo
  echo "Access the application at:"
  echo "https://$IP_ADDRESS"
  echo
  echo "Default admin credentials:"
  echo "Email: admin@company.local"
  echo "Password: admin"
  echo
  echo "IMPORTANT: Change the default password immediately!"
  echo "-------------------------------------------------------"
else
  print_error "Installation failed. Services did not start correctly."
  echo "Check the logs in /opt/corporate-intranet/logs for more information."
fi