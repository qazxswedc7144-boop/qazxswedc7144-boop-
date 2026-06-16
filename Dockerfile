# Dockerfile
# Stage 1: Dependency Installation & Compilation
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package descriptors & config files
COPY package*.json tsconfig.json vite.config.ts ./
COPY prisma ./prisma/

# Install base compilation toolings
RUN apk add --no-cache python3 make g++ openssl libc6-compat

# Install all npm dependencies
RUN npm ci

# Copy core engine source code
COPY . .

# Generate Prisma Client library
RUN npx prisma generate

# Build the Vite React frontend and Bundle the TypeScript Express backend
RUN npm run build

# Stage 2: Final Lean Production Runner Image
FROM node:20-alpine AS runner
WORKDIR /app

# Install runtime dependencies for Prisma query engine in Alpine
RUN apk add --no-cache openssl libc6-compat

ENV NODE_ENV=production
ENV PORT=3000

# Copy descriptors and build artefacts
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

# Expose server ingress port
EXPOSE 3000

# Start the production server cleanly
CMD ["node", "dist/server.cjs"]
