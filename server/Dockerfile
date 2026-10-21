FROM node:20-alpine

WORKDIR /app

# Copy package files first for layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy runtime source without copying local environment files or unrelated artifacts
COPY index.js mailer.js ./
COPY middleware ./middleware
COPY models ./models
COPY routes ./routes
COPY socket ./socket
COPY utils ./utils

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001
USER nodeuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "index.js"]
