STANDARD_RUN=docker run -it --rm -v $$(pwd):/app:delegated --name soundscrape-container soundscrape
build:
	docker build -t soundscrape .

shell: build
	docker run -it --entrypoint /bin/sh --rm -v $$(pwd):/app:delegated --name soundscrape-container soundscrape

tasks: build
	$(STANDARD_RUN) npm run tasks

tests: build
	$(STANDARD_RUN) npm test

tests-interactive: build
	$(STANDARD_RUN) npm run test:watch

coverage: build
	$(STANDARD_RUN) npm run coverage