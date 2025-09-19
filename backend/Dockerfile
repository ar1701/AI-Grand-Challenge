# Stage 1: Build the application
# Use an official Node.js image. Alpine is a lightweight version.
FROM node:18-alpine AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# ---
# Stage 2: Create the final production image
FROM node:18-alpine

WORKDIR /app

# Copy the installed node_modules from the builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy the rest of your application code
COPY . .

# Expose the port the app runs on
EXPOSE 8080

# The command to run your application
CMD [ "npm", "start" ]