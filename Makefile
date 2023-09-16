build:
	docker build -t soundscrape .

shell: build
	docker run -it --entrypoint /bin/sh --rm -v $$(pwd):/app:delegated --name soundscrape-container soundscrape

tasks: build
	docker run -it --rm -v $$(pwd):/app:delegated --name soundscrape-container soundscrape npm run tasks

tests: build
	docker run -it --rm -v $$(pwd):/app:delegated --name soundscrape-container soundscrape npm test

coverage: build
	docker run -it --rm -v $$(pwd):/app:delegated --name soundscrape-container soundscrape npm run coverage