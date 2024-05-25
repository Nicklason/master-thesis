FROM node:20

RUN apt-get update && \
    apt-get install -y openssl

WORKDIR /app

RUN npm i pnpm ts-node -g

COPY tsconfig.json ./

COPY package.json pnpm-lock.yaml ./

RUN pnpm install

COPY graph.ts generate-certs.ts ./

CMD ["ts-node", "generate-certs.ts"]
