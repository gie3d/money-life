# Build the production image and bundle an install package to copy to a Docker host (e.g. Umbrel).
#   make package                      # default platform linux/amd64
#   make package PLATFORM=linux/arm64 # Raspberry Pi Umbrel
IMAGE    ?= money-life:latest
PLATFORM ?= linux/amd64
DIST     ?= dist/money-life-umbrel
HOST     ?= umbrel@umbrel.local
REMOTE   ?= ~/projects/money-life
# One shared connection, so the SSH password is asked once for scp and ssh together.
SSH_OPTS ?= -o ControlMaster=auto -o ControlPath=/tmp/money-life-ssh-%r@%h:%p -o ControlPersist=60

.PHONY: package image deploy clean

package: image
	rm -rf $(DIST)
	mkdir -p $(DIST)
	docker save $(IMAGE) | gzip > $(DIST)/money-life-image.tar.gz
	cp deploy/docker-compose.yml deploy/.env.example deploy/README.txt $(DIST)/
	@echo
	@echo "Package ready: $(DIST)  ($(PLATFORM))"
	@echo "Copy it to the Umbrel, then follow $(DIST)/README.txt"

# Build, upload to the Umbrel, load the image there and (re)start. Needs a .env in $(REMOTE) on first run.
deploy: package
	scp $(SSH_OPTS) $(DIST)/.env.example $(DIST)/docker-compose.yml $(DIST)/money-life-image.tar.gz $(DIST)/README.txt $(HOST):$(REMOTE)/
	ssh -t $(SSH_OPTS) $(HOST) 'cd $(REMOTE) && sudo docker load < money-life-image.tar.gz && sudo docker compose up -d'

image:
	docker buildx build --platform $(PLATFORM) --target prod -t $(IMAGE) --load .

clean:
	rm -rf dist
