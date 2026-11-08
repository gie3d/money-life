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

Data lives in ./data/postgres next to docker-compose.yml. Back that folder up.
Choose the password before the first start: Postgres ignores later changes to it.
