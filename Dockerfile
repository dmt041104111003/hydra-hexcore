# Use the official Node.js 22 Alpine image as the base image
FROM node:22-alpine

# Install Docker CLI and pnpm
RUN apk add --no-cache docker-cli
RUN npm install -g pnpm

# Set the working directory inside the container
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies (skip native modules that need compilation)
RUN pnpm install --ignore-scripts

# Copy the source code
COPY . .

# Build the project
RUN pnpm run build

# Verify dist folder exists
RUN ls -la dist/

# Expose the port
EXPOSE 3010

# Start the application
CMD ["node", "dist/src/main.js"]
