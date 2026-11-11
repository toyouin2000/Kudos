
# Use lightweight Node.js image
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY src ./src

# Application port
EXPOSE 3000

# Start backend
CMD ["npm", "start"]
