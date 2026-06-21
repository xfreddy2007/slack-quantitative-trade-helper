# Build context must be the monorepo root, e.g.:
#   docker build -f apps/slack-bot/Dockerfile -t investment-slack-bot .
# (the Prisma schema lives at db/prisma/schema.prisma, outside apps/slack-bot)

FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl

COPY db/prisma ./db/prisma
COPY apps/slack-bot/package.json apps/slack-bot/package-lock.json ./apps/slack-bot/
WORKDIR /app/apps/slack-bot
RUN npm ci

COPY apps/slack-bot/tsconfig.json apps/slack-bot/tsconfig.build.json ./
COPY apps/slack-bot/src ./src
RUN npm run build

FROM node:20-alpine AS production
ENV NODE_ENV=production
WORKDIR /app/apps/slack-bot
RUN apk add --no-cache openssl

COPY apps/slack-bot/package.json apps/slack-bot/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder --chown=node:node /app/apps/slack-bot/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=node:node /app/apps/slack-bot/dist ./dist

USER node
CMD ["node", "dist/index.js"]
