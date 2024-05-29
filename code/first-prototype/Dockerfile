FROM node:20-alpine

RUN npm i -g pnpm ts-node

COPY package.json pnpm-lock.yaml ./

RUN pnpm install

COPY redis.ts ./

CMD ["ts-node", "redis.ts"]
