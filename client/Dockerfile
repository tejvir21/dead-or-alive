FROM node:20-alpine AS builder

WORKDIR /app

# Build args for env vars baked into Vite build
ARG VITE_API_URL
ARG VITE_SOCKET_URL
ARG VITE_BETA_VERSION
ARG VITE_MAIN_APP_URL

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
ENV VITE_BETA_VERSION=$VITE_BETA_VERSION
ENV VITE_MAIN_APP_URL=$VITE_MAIN_APP_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Production stage with Nginx ────────────────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
