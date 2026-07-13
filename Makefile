up:
	podman compose up -d redis postgres
	yarn install-local-ssl
	yarn install --immutable
	yarn dev:watch

build:
	podman compose build --pull outline

test:
	podman compose up -d postgres
	NODE_ENV=test yarn sequelize db:drop
	NODE_ENV=test yarn sequelize db:create
	NODE_ENV=test yarn sequelize db:migrate
	yarn test

watch:
	podman compose up -d redis postgres
	NODE_ENV=test yarn sequelize db:drop
	NODE_ENV=test yarn sequelize db:create
	NODE_ENV=test yarn sequelize db:migrate
	yarn test:watch

destroy:
	podman compose stop
	podman compose rm -f

.PHONY: up build destroy test watch # let's go to reserve rules names
