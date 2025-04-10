#!/bin/bash

# Corporate Intranet System Backup Script
# Backs up database, configuration files, and user uploads
# Designed to run on Raspberry Pi with limited resources

# Set script to exit on error
set -e

# Load environment variables
source .env 2>/dev/null || echo "No .env file found, using defaults"

# Configuration
BACKUP_DIR=${BACKUP_DIR:-"./backups"}
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="intranet_backup_${TIMESTAMP}"
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
RETENTION_DAYS=${RETENTION_DAYS:-7}
MAX_BACKUPS=${MAX_BACKUPS:-10}

# Components to back up
DOCKER_COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"
NGINX_CONFIG_DIR="./nginx"
FRONTEND_CONFIG_DIR="./frontend/src/config"
BACKUP_LOG="${BACKUP_DIR}/backup_log.txt"

# Create backup directory if it doesn't exist
mkdir -p ${BACKUP_DIR}

# Log function
log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a ${BACKUP_LOG}
}

log "Starting backup process..."

# Check for system resources before starting
MEM_AVAIL=$(free -m | awk '/^Mem:/{print $7}')
DISK_AVAIL=$(df -h ${BACKUP_DIR} | awk 'NR==2 {print $4}')

log "Available memory: ${MEM_AVAIL}MB, Available disk space: ${DISK_AVAIL}"

if [[ ${MEM_AVAIL} -lt 100 ]]; then
  log "WARNING: Low memory available. Backup may fail or affect system performance."
fi

# Create temporary directory for backup assembly
TEMP_DIR=$(mktemp -d)
trap 'rm -rf ${TEMP_DIR}' EXIT

# 1. Back up database
log "Backing up database..."
mkdir -p ${TEMP_DIR}/database

# Using docker-compose to dump database
if docker-compose ps | grep -q "database.*Up"; then
  log "Database container is running, proceeding with backup..."
  docker-compose exec -T database pg_dump -U ${DB_USER} -d ${DB_NAME} | gzip > ${TEMP_DIR}/database/database_dump.sql.gz
  if [ $? -ne 0 ]; then
    log "ERROR: Database backup failed!"
    exit 1
  fi
  log "Database backup successful."
else
  log "ERROR: Database container is not running. Cannot backup database."
  exit 1
fi

# 2. Back up configuration files
log "Backing up configuration files..."
mkdir -p ${TEMP_DIR}/config

# Copy main configuration files
cp ${DOCKER_COMPOSE_FILE} ${TEMP_DIR}/config/
cp ${ENV_FILE} ${TEMP_DIR}/config/

# Copy Nginx config
if [ -d "${NGINX_CONFIG_DIR}" ]; then
  cp -r ${NGINX_CONFIG_DIR} ${TEMP_DIR}/config/
fi

# Copy frontend config
if [ -d "${FRONTEND_CONFIG_DIR}" ]; then
  cp -r ${FRONTEND_CONFIG_DIR} ${TEMP_DIR}/config/
fi

# 3. Back up uploaded files
log "Backing up user uploads..."
mkdir -p ${TEMP_DIR}/uploads

# For Raspberry Pi with limited resources, we use rsync for efficiency
if docker-compose ps | grep -q "backend.*Up"; then
  # This approach works if the uploads directory is mounted as a volume
  if [ -d "./backend/uploads" ]; then
    rsync -avz --exclude="*.tmp" ./backend/uploads/ ${TEMP_DIR}/uploads/
    log "User uploads backup successful."
  else
    log "WARNING: Uploads directory not found at expected location."
  fi
else
  log "WARNING: Backend container is not running. Cannot backup uploads."
fi

# 4. Create compressed archive
log "Creating compressed backup archive..."

# For Raspberry Pi, use lower compression to save CPU
tar --owner=0 --group=0 -czf ${BACKUP_FILE} -C ${TEMP_DIR} .

if [ $? -eq 0 ]; then
  BACKUP_SIZE=$(du -h ${BACKUP_FILE} | cut -f1)
  log "Backup created successfully: ${BACKUP_FILE} (${BACKUP_SIZE})"
else
  log "ERROR: Failed to create backup archive!"
  exit 1
fi

# 5. Clean up old backups
log "Cleaning up old backups..."

# Remove backups older than retention days
find ${BACKUP_DIR} -name "intranet_backup_*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete

# Keep only MAX_BACKUPS if we have more than that
BACKUP_COUNT=$(find ${BACKUP_DIR} -name "intranet_backup_*.tar.gz" | wc -l)
if [ ${BACKUP_COUNT} -gt ${MAX_BACKUPS} ]; then
  ls -t ${BACKUP_DIR}/intranet_backup_*.tar.gz | tail -n +$((MAX_BACKUPS+1)) | xargs rm -f
  log "Removed oldest backups, keeping ${MAX_BACKUPS} most recent."
fi

# Final report
REMAINING_SPACE=$(df -h ${BACKUP_DIR} | awk 'NR==2 {print $4}')
log "Backup process completed. Remaining disk space: ${REMAINING_SPACE}"

# Optimize for Raspberry Pi - clear cache if memory is low
if [[ ${MEM_AVAIL} -lt 150 ]]; then
  log "Clearing system cache to free memory..."
  sync
  echo 3 | sudo tee /proc/sys/vm/drop_caches > /dev/null 2>&1 || log "Failed to clear cache (requires sudo)"
fi

exit 0