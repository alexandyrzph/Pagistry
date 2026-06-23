#!/bin/bash
set -e
set -o pipefail
STAMP=$(date +%Y%m%d-%H%M%S)
DEST=/home/ubuntu/pagecraft-backups
mkdir -p "$DEST"
docker compose -f /home/ubuntu/pagecraft/docker-compose.yml exec -T postgres \
  pg_dump -U pagecraft pagecraft | gzip > "$DEST/pagecraft-$STAMP.sql.gz"
# Keep the 14 most recent.
ls -1t "$DEST"/pagecraft-*.sql.gz | tail -n +15 | xargs -r rm --
