#!/bin/sh
# Runs in the `backup` container: a full dump of the database every BACKUP_EVERY_HOURS hours into /backups,
# keeping BACKUP_KEEP_DAYS days of them. Connection settings come from the PG* environment variables.
set -eu

EVERY_HOURS="${BACKUP_EVERY_HOURS:-24}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
mkdir -p /backups

while true; do
  name="money-life-$(date -u +%Y%m%d-%H%M%S).dump"
  # Written under a temporary name first, so a dump cut short never looks like a good backup.
  if pg_dump --format=custom --file="/backups/$name.part" && mv "/backups/$name.part" "/backups/$name"; then
    echo "$(date -u '+%F %T') backup written: $name ($(du -h "/backups/$name" | cut -f1))"
    # Old dumps go only after a new one has been written, so a failing database never empties the folder.
    find /backups -name 'money-life-*.dump' -type f -mtime +"$KEEP_DAYS" -print -delete | sed 's/^/removed old backup: /'
  else
    echo "$(date -u '+%F %T') backup FAILED; keeping the earlier ones" >&2
    rm -f "/backups/$name.part"
  fi
  sleep $((EVERY_HOURS * 3600))
done
