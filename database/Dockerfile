FROM arm64v8/postgres:13-alpine

# Install necessary tools
RUN apk add --no-cache tzdata bash curl

# Set timezone
ENV TZ=UTC

# Create backup directories
RUN mkdir -p /var/lib/postgresql/backups

# Copy initialization scripts
COPY init.sql /docker-entrypoint-initdb.d/

# Copy backup script
COPY backup.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh

# Set Postgres configuration for Raspberry Pi
RUN echo "shared_buffers = 128MB" >> /var/lib/postgresql/data/postgresql.conf && \
    echo "work_mem = 4MB" >> /var/lib/postgresql/data/postgresql.conf && \
    echo "maintenance_work_mem = 32MB" >> /var/lib/postgresql/data/postgresql.conf && \
    echo "effective_cache_size = 512MB" >> /var/lib/postgresql/data/postgresql.conf && \
    echo "max_connections = 20" >> /var/lib/postgresql/data/postgresql.conf && \
    echo "synchronous_commit = off" >> /var/lib/postgresql/data/postgresql.conf && \
    echo "checkpoint_timeout = 300" >> /var/lib/postgresql/data/postgresql.conf && \
    echo "checkpoint_completion_target = 0.9" >> /var/lib/postgresql/data/postgresql.conf

# Add cron job for backups if BACKUP_SCHEDULE is defined
RUN echo '#!/bin/bash\n\
if [ -n "$BACKUP_SCHEDULE" ]; then\n\
  echo "$BACKUP_SCHEDULE /usr/local/bin/backup.sh >> /var/log/cron.log 2>&1" > /var/spool/cron/crontabs/postgres\n\
  chmod 600 /var/spool/cron/crontabs/postgres\n\
  crond -b -l 8\n\
  echo "Scheduled backup: $BACKUP_SCHEDULE"\n\
fi\n\
exec "$@"' > /usr/local/bin/docker-entrypoint-wrapper.sh && \
    chmod +x /usr/local/bin/docker-entrypoint-wrapper.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint-wrapper.sh"]
CMD ["postgres"]

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD pg_isready -U postgres || exit 1