#!/bin/bash
# Update script for Corporate Intranet running on Raspberry Pi

# Exit immediately if a command exits with a non-zero status
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
  print_error "This script must be run as root. Try 'sudo ./update.sh'"
fi

# Configuration
APP_DIR="/opt/corporate-intranet"
BACKUP_DIR="$APP_DIR/backups"
LOG_FILE="$APP_DIR/logs/update_$(date +%Y%m%d_%H%M%S).log"

# Create log directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Log function
log() {
  echo "$(date +'%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log "Starting Corporate Intranet update process..."

# Move to app directory
cd "$APP_DIR" || print_error "Could not change to application directory: $APP_DIR"

# Check for docker-compose
if ! command -v docker-compose &> /dev/null; then
  print_error "docker-compose not found. Please install it first."
fi

# Check if containers are running
if ! docker-compose ps | grep -q "Up"; then
  log "Warning: Some containers are not running. Proceeding anyway..."
fi

# Create a backup before updating
log "Creating backup before update..."
if ./scripts/backup.sh; then
  log "Backup completed successfully."
else
  print_error "Backup failed. Aborting update."
fi

# Pull latest changes if using Git
if [ -d .git ]; then
  log "Pulling latest changes from Git repository..."
  if git pull; then
    log "Git pull successful."
  else
    print_error "Git pull failed. Aborting update."
  fi
fi

# Check for .env file
if [ ! -f .env ]; then
  print_error ".env file not found. Please ensure the environment configuration exists."
fi

# Stop services
log "Stopping services..."
docker-compose down

# Update system packages
log "Updating system packages..."
apt-get update && apt-get upgrade -y

# Rebuild and restart services
log "Rebuilding and restarting services..."
if docker-compose up -d --build; then
  log "Services rebuilt and restarted successfully."
else
  print_error "Failed to rebuild and restart services."
fi

# Wait for services to start
log "Waiting for services to start..."
sleep 10

# Check if services are running
if docker-compose ps | grep -q "Up"; then
  log "Services are running."
else
  print_error "Services failed to start. Please check logs for more information."
fi

# Run database migrations if they exist
if [ -f scripts/migrate.sh ]; then
  log "Running database migrations..."
  if ./scripts/migrate.sh; then
    log "Database migrations completed successfully."
  else
    print_error "Database migrations failed. Please check the migration logs."
  fi
fi

# Clean up old Docker images
log "Cleaning up old Docker images..."
docker image prune -f

# Check system health
log "Checking system health..."
./scripts/monitor.sh > /dev/null

# Check disk space
DISK_SPACE=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')
if [ "$DISK_SPACE" -gt 85 ]; then
  log "WARNING: Disk space is running low ($DISK_SPACE% used). Consider cleaning up old backups or logs."
fi

# Final success message
print_success "Update completed successfully at $(date)!"
log "Update completed successfully."

exit 0