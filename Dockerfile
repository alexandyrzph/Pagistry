# syntax=docker/dockerfile:1

FROM node:22-bookworm AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NODE_OPTIONS=--max-old-space-size=2048
RUN npx prisma generate && npm run build

FROM node:22-bookworm AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app ./
COPY docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x ./docker/entrypoint.sh
EXPOSE 3000
CMD ["./docker/entrypoint.sh"]
