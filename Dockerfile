FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy source code (complete cache bust)
COPY . .
RUN echo "=== Server directory contents ===" && ls -la server/
RUN echo "=== Checking for old webhook files ===" && find . -name "*webhook*" -type f
RUN echo "=== TypeScript files ===" && find . -name "*.ts" | grep -E "(webhook|server)"

# Build TypeScript with verbose output
RUN echo "=== Starting TypeScript build ===" && npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S billy -u 1001

# Create memory directory with proper permissions
RUN mkdir -p memory logs && chown -R billy:nodejs memory logs

USER billy

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('Billy is alive')" || exit 1

# Run Billy stateless webhook server (no memory required)
CMD ["npm", "run", "billy:stateless"]