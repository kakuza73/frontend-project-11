install:
	npm ci

lint:
	npx eslint .

start:
	npx webpack serve --open

build:
	rm -rf dist
	NODE_ENV=production npx webpack

.PHONY: test
