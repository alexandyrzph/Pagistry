# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1
# Copy the fully built app (node_modules incl. playwright, .next, prisma, public).
COPY --from=build /app ./
# Install the Chromium browser + its system libraries for runtime thumbnails.
RUN npx playwright install --with-deps chromium
COPY docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x ./docker/entrypoint.sh
EXPOSE 3000
CMD ["./docker/entrypoint.sh"]
