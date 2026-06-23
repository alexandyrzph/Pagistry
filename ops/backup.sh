#!/bin/bash
set -e
set -o pipefail
STAMP=$(date +%Y%m%d-%H%M%S)
DEST=/home/ubuntu/pagistry-backups
mkdir -p "$DEST"
docker compose -f /home/ubuntu/pagistry/docker-compose.yml exec -T postgres \
  pg_dump -U pagistry pagistry | gzip > "$DEST/pagistry-$STAMP.sql.gz"
# Keep the 14 most recent.
ls -1t "$DEST"/pagistry-*.sql.gz | tail -n +15 | xargs -r rm --
