# Use the official Node.js 20 image as the base image
FROM node:20

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Install pm2 and nodemon globally
RUN npm install -g pm2 nodemon

# Copy the rest of the application code to the working directory
COPY . .

# Start the application using nodemon
CMD ["nodemon", "app.js"]