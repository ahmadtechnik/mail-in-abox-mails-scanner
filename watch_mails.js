const chokidar = require('chokidar');
const axios = require('axios');
const path = require('path');

// Load sensitive values from .env file
require('dotenv').config();
const directoryToWatch = process.env.DIRECTORY_PATH || './maildir';
const targetUrl = process.env.TARGET_URL || 'http://localhost:3000/emails/update';

// Watch the directory for changes, ignoring initial files
const watcher = chokidar.watch(directoryToWatch, {
  ignored: /(^|[\/\\])\../, // Ignore dotfiles
  persistent: true,
  ignoreInitial: true, // Ignore existing files; only watch for changes after starting
});

console.log(`Watching directory: ${directoryToWatch}`);

// Handle events for file changes
watcher
  .on('add', async (filePath) => {
    console.log(`File added: ${filePath}`);
    await sendUpdateNotification('add', filePath);
  })
  .on('change', async (filePath) => {
    console.log(`File changed: ${filePath}`);
    await sendUpdateNotification('change', filePath);
  })
  .on('unlink', async (filePath) => {
    console.log(`File removed: ${filePath}`);
    await sendUpdateNotification('unlink', filePath);
  });

// Function to send HTTP requests when a file is added, changed, or removed
async function sendUpdateNotification(eventType, filePath) {
  try {
    const response = await axios.post(targetUrl, {
      eventType,
      filePath: path.basename(filePath), // Send only the filename
      fullPath: filePath, // Full file path for reference
    });
    console.log(`Notification sent successfully. Status: ${response.status}`);
  } catch (error) {
    console.error(`Error sending notification: ${error.message}`);
  }
}
