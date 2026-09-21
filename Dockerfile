# Jarvis command center. One container, SQLite on a mounted volume at /data.
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY bin ./bin
COPY src ./src
COPY web ./web
COPY blueprints ./blueprints
ENV JARVIS_DB=/data/jarvis.db \
    PORT=8080 \
    JARVIS_HOST=0.0.0.0
RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 8080
CMD ["npm", "run", "-s", "start"]
