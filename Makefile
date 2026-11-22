STANDARD_RUN=docker run --rm -v ./auth.json:/app/auth.json --name soundscrape-container soundscrape
GHCR_RUN=docker run --rm -v ./auth.json:/app/auth.json ghcr.io/linnesq/sounds-scrape:latest
# Port of the redirectUri in auth.json; `make login` listens there for Spotify's redirect
AUTH_PORT ?= 80
LOGIN_RUN=docker run --rm --init -p 127.0.0.1:$(AUTH_PORT):$(AUTH_PORT) -e AUTH_PORT=$(AUTH_PORT) -v ./auth.json:/app/auth.json
build:
	docker build -t soundscrape .

shell: build
	docker run -it --entrypoint /bin/sh --rm -v ./auth.json:/app/auth.json --name soundscrape-container soundscrape

login:
	$(LOGIN_RUN) --name soundscrape-container soundscrape npm run login

auth-url:
	$(STANDARD_RUN) npm run print-auth-url

authenticate:
	docker run --rm -v ./auth.json:/app/auth.json -e AUTH_CODE="${AUTH_CODE}" --name soundscrape-container soundscrape npm run setup-auth

check-auth:
	$(STANDARD_RUN) npm run check-auth

playlists:
	$(STANDARD_RUN) npm run tasks

ghcr-login:
	$(LOGIN_RUN) ghcr.io/linnesq/sounds-scrape:latest npm run login

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