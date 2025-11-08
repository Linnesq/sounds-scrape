STANDARD_RUN=docker run --rm -v ./auth.json:/app/auth.json --name soundscrape-container soundscrape
GHCR_RUN=docker run --rm -v ./auth.json:/app/auth.json ghcr.io/linnesq/sounds-scrape:latest
build:
	docker build -t soundscrape .

shell: build
	docker run -it --entrypoint /bin/sh --rm -v ./auth.json:/app/auth.json --name soundscrape-container soundscrape

auth-url:
	$(STANDARD_RUN) npm run print-auth-url

authenticate:
	docker run --rm -v ./auth.json:/app/auth.json -e AUTH_CODE="${AUTH_CODE}" --name soundscrape-container soundscrape npm run setup-auth

check-auth:
	$(STANDARD_RUN) npm run check-auth

playlists:
	$(STANDARD_RUN) npm run tasks

ghcr-auth-url:
	$(GHCR_RUN) npm run print-auth-url

ghcr-authenticate:
	docker run --rm -v ./auth.json:/app/auth.json -e AUTH_CODE=${AUTH_CODE} ghcr.io/linnesq/sounds-scrape:latest npm run setup-auth

ghcr-check-auth:
	$(GHCR_RUN) npm run check-auth

ghcr-playlists:
	$(GHCR_RUN) npm run tasks

tests: build
	$(STANDARD_RUN) npm test

tests-interactive: build
	$(STANDARD_RUN) npm run test:watch

coverage: build
	$(STANDARD_RUN) npm run coverage