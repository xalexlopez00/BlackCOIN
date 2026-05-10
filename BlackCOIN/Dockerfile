FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
COPY src/ ./src/
RUN npm ci && npm run compile

FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY public/ ./public/

EXPOSE 3001 6001

VOLUME ["/app/data"]

CMD ["node", "dist/index.js"]
