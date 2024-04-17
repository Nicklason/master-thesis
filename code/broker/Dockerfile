FROM node:20-alpine

RUN npm install pnpm -g

COPY tsconfig.json ./

COPY package.json pnpm-lock.yaml ./

RUN pnpm install

COPY ./src ./src

RUN pnpm run build

CMD ["node", "./dist/app.js"]

