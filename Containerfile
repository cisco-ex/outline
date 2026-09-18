FROM artifactory.devhub-cloud.cisco.com/sto-cg-docker/node:26-dev AS build

USER root

RUN apk update && apk add cmake
RUN npm install -g corepack
RUN corepack enable

RUN mkdir -p /app
WORKDIR /app

COPY ./app /app/app
COPY ./patches /app/patches
COPY ./plugins /app/plugins
COPY ./server /app/server
COPY ./shared /app/shared
COPY ./.swcrc /app/
COPY ./.yarnrc.yml /app
COPY ./build.js /app
COPY ./tsconfig.json /app
COPY ./vite.config.ts /app
COPY ./package.json /app
COPY ./yarn.lock /app

RUN yarn install --immutable

RUN yarn build

FROM artifactory.devhub-cloud.cisco.com/sto-cg-docker/chainguard-base

WORKDIR /app

RUN apk update && apk add tini nodejs

COPY --from=build /app/build /app/build
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/server /app/server
COPY /public /app/public
COPY /.sequelizerc /app/.sequelizerc
COPY /package.json /app/package.json

EXPOSE 3000
ENTRYPOINT ["tini", "--" ]
CMD [ "node", "build/server/index.js" ]
