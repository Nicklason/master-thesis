FROM node:20-alpine

RUN npm i -g pnpm

COPY package.json pnpm-lock.yaml ./

RUN pnpm install

COPY app.js graph.js ./

CMD ["node", "app.js"]
