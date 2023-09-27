STANDARD_RUN=docker run -it --rm -v $$(pwd):/app:delegated --name soundscrape-container soundscrape
GHCR_RUN=docker run --rm -v ./auth.json:/app/auth.json ghcr.io/linnesq/sounds-scrape:latest
build:
	docker build -t soundscrape .

shell: build
	docker run -it --entrypoint /bin/sh --rm -v $$(pwd):/app:delegated --name soundscrape-container soundscrape

tasks: build
	$(STANDARD_RUN) npm run tasks

ghcr-tasks:
	$(GHCR_RUN) npm run tasks

ghcr-auth-url:
	$(GHCR_RUN) npm run print-auth-url

ghcr-authenticate:
	docker run --rm -v ./auth.json:/app/auth.json -e AUTH_CODE=${AUTH_CODE} ghcr.io/linnesq/sounds-scrape:latest npm run setup-auth

ghcr-check-auth:
	$(GHCR_RUN) npm run check-auth

tests: build
	$(STANDARD_RUN) npm test

tests-interactive: build
	$(STANDARD_RUN) npm run test:watch

coverage: build
	$(STANDARD_RUN) npm run coverage