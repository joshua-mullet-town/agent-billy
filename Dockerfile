FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S billy -u 1001

# Create memory directory with proper permissions
RUN mkdir -p memory logs && chown -R billy:nodejs memory logs

USER billy

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('Billy is alive')" || exit 1

# Run Billy in watch mode with polling
CMD ["npm", "run", "billy:watch", "--", "--interval", "60"]