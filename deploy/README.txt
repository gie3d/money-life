Money Life: install on Umbrel

1. Copy this whole folder to the Umbrel, e.g.
     scp -r money-life-umbrel umbrel@umbrel.local:~/
2. SSH in and go to it:
     ssh umbrel@umbrel.local
     cd ~/money-life-umbrel
3. Set a real database password:
     cp .env.example .env
     nano .env        # change POSTGRES_PASSWORD (and WEB_PORT if 3333 is taken)
4. Load the image and start:
     docker load < money-life-image.tar.gz
     docker compose up -d
5. Open http://umbrel.local:3333 and sign up.

Update later: copy a new money-life-image.tar.gz over, then
     docker load < money-life-image.tar.gz && docker compose up -d
(migrations run automatically on start).

Data lives in ./data/postgres next to docker-compose.yml.

Backups
The `backup` service writes a full copy of the database to ./data/backups once a day and keeps the last 14 days
(change BACKUP_EVERY_HOURS and BACKUP_KEEP_DAYS in .env). The first one is written when it starts. Check them:
     ls -lh data/backups
     sudo docker compose logs backup
They sit on the same disk as the database, so also copy them somewhere else now and then. From the computer you
deploy from:
     make backup-pull          # copies them into ./backups there

To put the database back to a backup (everything in it now is replaced; a copy of it is saved first):
     ./restore.sh data/backups/money-life-20261118-030000.dump
Run ./restore.sh with nothing after it to list the backups.
Choose the password before the first start: Postgres ignores later changes to it.
