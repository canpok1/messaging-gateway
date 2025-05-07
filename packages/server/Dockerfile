FROM node:24 AS builder
WORKDIR /src

COPY ./package*.json ./
COPY ./packages/lib/package*.json ./packages/lib/
COPY ./packages/server/package*.json ./packages/server/
COPY ./prisma/ ./prisma/
RUN npm ci

COPY ./tsconfig.json ./
COPY ./packages/lib/ ./packages/lib/
COPY ./packages/server/ ./packages/server/
RUN npm run -w packages/lib build
RUN npm run -w packages/server build


FROM node:24-slim
WORKDIR /src

RUN apt-get update && apt-get install -y \
    openssl \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

COPY ./package*.json ./
COPY ./packages/lib/package*.json ./packages/lib/
COPY ./packages/server/package*.json ./packages/server/
COPY ./prisma/ ./prisma/
RUN npm ci --omit=dev

COPY --from=builder /src/packages/server/dist ./packages/server/dist

ENV TZ=Asia/Tokyo
ENV NODE_ENV production
ENV PORT=3000
EXPOSE 3000
ENTRYPOINT ["node", "/src/packages/server/dist/Index.mjs"]
