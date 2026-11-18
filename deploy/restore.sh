#!/bin/sh
# Puts the database back to a backup: ./restore.sh data/backups/money-life-20261118-030000.dump
# Run it in the folder with docker-compose.yml. Everything in the database now is replaced by the backup.
set -eu

file="${1:-}"
if [ -z "$file" ] || [ ! -f "$file" ]; then
  echo "Usage: ./restore.sh data/backups/<backup>.dump"
  echo "Backups here, newest last:"
  ls -1tr data/backups/*.dump 2>/dev/null | tail -n 10 || echo "  (none yet)"
  exit 1
fi

. ./.env
echo "This replaces everything in the database with $file."
printf "Type RESTORE to go on: "
read -r answer
[ "$answer" = "RESTORE" ] || { echo "Nothing changed."; exit 1; }

# A last backup of what is there now, in case the wrong file was picked.
before="data/backups/before-restore-$(date -u +%Y%m%d-%H%M%S).dump"
sudo docker compose exec -T db pg_dump --format=custom -U "$POSTGRES_USER" -d "$POSTGRES_DB" > "$before"
echo "Saved the current database first: $before"

sudo docker compose stop web
sudo docker compose exec -T db pg_restore --clean --if-exists --no-owner --single-transaction --exit-on-error -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$file"
sudo docker compose start web
echo "Restored $file."
