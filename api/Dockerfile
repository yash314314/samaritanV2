FROM node:24-alpine AS builder
# Prisma's query engine links against OpenSSL, which Alpine does not ship by default.
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
# prisma.config.ts resolves the database URL as soon as the CLI loads it, but
# generating the client never connects; a placeholder satisfies it here, where
# no database settings exist (.env is never copied into the image).
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate && npm run build

FROM node:24-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist

# The image's unprivileged user; nothing here needs root.
USER node
ENV HOST=0.0.0.0
ENV PORT=4000
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health >/dev/null || exit 1
# Apply pending migrations to the database DATABASE_TARGET selects, seed the
# classifier once on an empty database, then serve.
CMD ["sh", "-c", "node dist/scripts/migrate.js && node dist/scripts/seedPatterns.js --if-empty && exec node dist/index.js"]
