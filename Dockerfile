FROM node:18-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (need dev deps for building)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

# Create store directory and set permissions before switching to non-root user
RUN mkdir -p /app/store && \
    chown -R node:node /app

# Run as non-root
USER node

ENTRYPOINT ["node", "dist/src/cli/cli.js"]