#!/bin/bash

# Database backup script for Raspberry Pi
# This script creates compressed backups of the PostgreSQL database
# and manages retention of older backups

# Load environment variables if available
if [ -f /.env ]; then
  source /.env
fi

# Configuration
DB_HOST=${DB_HOST:-database}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${POSTGRES_DB:-corporate_intranet}
DB_USER=${POSTGRES_USER:-postgres}
BACKUP_DIR=${BACKUP_DIR:-/backups}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}
LOG_FILE=${LOG_FILE:-/var/log/backup.log}

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Log function
log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
}

log "Starting database backup"

# Generate filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"

# Create the backup - using compression to save storage space on Raspberry Pi
log "Creating backup: $BACKUP_FILE"
export PGPASSWORD=$POSTGRES_PASSWORD
pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME | gzip > $BACKUP_FILE

# Check if backup was successful
if [ $? -eq 0 ]; then
  # Set appropriate permissions
  chmod 640 $BACKUP_FILE
  
  # Get size of backup
  BACKUP_SIZE=$(du -h $BACKUP_FILE | cut -f1)
  log "Backup completed successfully. Size: $BACKUP_SIZE"
  
  # Delete old backups
  log "Cleaning up backups older than $BACKUP_RETENTION_DAYS days"
  find $BACKUP_DIR -name "${DB_NAME}_*.sql.gz" -type f -mtime +$BACKUP_RETENTION_DAYS -delete
  
  # Print remaining disk space
  DISK_SPACE=$(df -h $BACKUP_DIR | tail -1 | awk '{print $4}')
  log "Remaining disk space: $DISK_SPACE"
else
  log "ERROR: Backup failed!"
  exit 1
fi

# Check if we need to copy to external storage (if configured)
if [ ! -z "$EXTERNAL_BACKUP_DIR" ] && [ -d "$EXTERNAL_BACKUP_DIR" ]; then
  log "Copying backup to external storage: $EXTERNAL_BACKUP_DIR"
  cp $BACKUP_FILE $EXTERNAL_BACKUP_DIR/
  
  if [ $? -eq 0 ]; then
    log "External copy completed successfully"
  else
    log "ERROR: External copy failed!"
  fi
fi

# Optimize for Raspberry Pi - if memory usage is high, clear cache
FREE_MEM=$(free -m | awk 'NR==2{print $4}')
if [ $FREE_MEM -lt 100 ]; then
  log "Low memory detected ($FREE_MEM MB). Clearing cache..."
  sync
  echo 3 > /proc/sys/vm/drop_caches
fi

log "Backup process completed"
exit 0