# Build the production image and bundle an install package to copy to a Docker host (e.g. Umbrel).
#   make package                      # default platform linux/amd64
#   make package PLATFORM=linux/arm64 # Raspberry Pi Umbrel
IMAGE    ?= money-life:latest
PLATFORM ?= linux/amd64
DIST     ?= dist/money-life-umbrel

.PHONY: package image clean

package: image
	rm -rf $(DIST)
	mkdir -p $(DIST)
	docker save $(IMAGE) | gzip > $(DIST)/money-life-image.tar.gz
	cp deploy/docker-compose.yml deploy/.env.example deploy/README.txt $(DIST)/
	@echo
	@echo "Package ready: $(DIST)  ($(PLATFORM))"
	@echo "Copy it to the Umbrel, then follow $(DIST)/README.txt"

image:
	docker buildx build --platform $(PLATFORM) --target prod -t $(IMAGE) --load .

clean:
	rm -rf dist
