# Use the official Node.js 20 Alpine image as the base image
FROM node:22-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy the package.json and package-lock.json files to the working directory
COPY package*.json ./

# Install the project dependencies
RUN npm install 

# Copy the source code to the working directory
COPY . .

# Build the project
RUN npm run build

# Expose the port on which the application will run
EXPOSE 3000

# Set the command to run the application
CMD ["npm", "run start:prod"]
