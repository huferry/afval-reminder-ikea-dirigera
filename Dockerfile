FROM node:20-alpine AS frontend-builder

WORKDIR /build/frontend

COPY frontend/package.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ---- Production image ----
FROM node:20-alpine

WORKDIR /app

# Backend deps
COPY package.json ./
RUN npm install --omit=dev

# Backend source
COPY src/ ./src/

# Copy built frontend
COPY --from=frontend-builder /build/frontend/dist ./frontend/dist

# Data directory for config
RUN mkdir -p /data

EXPOSE 3001

ENV NODE_ENV=production
ENV CONFIG_PATH=/data/config.json

CMD ["node", "src/index.js"]
