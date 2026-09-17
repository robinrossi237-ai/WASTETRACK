# syntax=docker/dockerfile:1

# ---------- build stage ----------
FROM node:20-alpine AS build

# Build toolchain included as a fallback in case a native dep (e.g. bcrypt)
# has no prebuilt binary for this platform.
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts

RUN npm run build

# ---------- runtime stage ----------
FROM node:20-alpine AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 5000

USER node

CMD ["node", "dist/server.js"]
