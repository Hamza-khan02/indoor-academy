# Builds the app into a container and starts it. Railway (and most other hosts) use this file
# automatically when it is in the project folder.
#
# The database is a SQLite file on the host's persistent disk: mount the disk at /data and set
# DATABASE_URL="file:/data/academy.db", plus AUTH_SECRET and the ADMIN_... values (README, "Going live").
# The disk is not attached while the image is built, so database changes are applied when the app starts.
FROM node:26-bookworm-slim

# Prisma's database engine needs OpenSSL.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    PATH=/app/node_modules/.bin:$PATH

# Packages first, so this slow step is reused when only the code changes.
# Installing runs "prisma generate", which reads the schema.
COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
# Same steps as "npm run start:live": apply database changes, create the first admin, branches and coach
# if the database is empty, then start the app on the port the host gives in PORT.
# "exec" lets the app itself receive the host's stop signal, so it shuts down cleanly.
CMD ["sh", "-c", "prisma migrate deploy && prisma db seed && exec next start"]
