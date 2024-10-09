const express = require("express");
const fs = require("fs");
const basicAuth = require("basic-auth");
const path = require("path");
const { htmlToText } = require('html-to-text');
const { simpleParser } = require('mailparser');
require("dotenv").config(); // Load .env file

// Load sensitive values from .env file
const authUser = process.env.USERNAME;
const authPass = process.env.PASSWORD;
const port = process.env.PORT || 3000;
const directoryPath = process.env.DIRECTORY_PATH || "./maildir";

// Function to check basic authentication
function authenticate(req, res, next) {
  const user = basicAuth(req);
  if (user && user.name === authUser && user.pass === authPass) {
    return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="example"');
  return res.status(401).send("Authentication required.");
}

const app = express();
app.use(express.json());


// Function to read the directory and filter files
function filterFiles() {
  const files = fs.readdirSync(directoryPath);

  const readFiles = files
    .filter((file) => file.includes(":2,S"))
    .map((file) => ({
      filename: file,
      filemodified_at: fs.statSync(path.join(directoryPath, file)).mtime, // Get the last modified date of the file
    }));

  const unreadFiles = files
    .filter((file) => !file.includes(":2,S"))
    .map((file) => ({
      filename: file,
      filemodified_at: fs.statSync(path.join(directoryPath, file)).mtime, // Get the last modified date of the file
    }));

  return {
    readFiles,
    unreadFiles,
    totalReadFiles: readFiles.length,
    totalUnreadFiles: unreadFiles.length,
    totalFiles: files.length,
  };
}

// Paginate the emails
function paginate(array, page, limit) {
  const startIndex = (page - 1) * limit;
  const paginatedArray = array.slice(startIndex, startIndex + limit);
  return paginatedArray;
}

// Endpoint to list all the read/unread files with pagination and filter
app.get("/emails", authenticate, (req, res) => {
  try {
    const fileData = filterFiles();

    // Get the page and limit from query parameters with defaults
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const filter = req.query.filter; // New filter query parameter (read or unread)

    let filesToReturn;
    let totalFilteredFiles;

    // Filtering based on 'read', 'unread', or 'all'
    if (filter === "read") {
      filesToReturn = fileData.readFiles;
      totalFilteredFiles = fileData.totalReadFiles;
    } else if (filter === "unread") {
      filesToReturn = fileData.unreadFiles;
      totalFilteredFiles = fileData.totalUnreadFiles;
    } else if (filter === "all") {
      // Return all files (both read and unread)
      filesToReturn = [...fileData.readFiles, ...fileData.unreadFiles];
      totalFilteredFiles = fileData.totalFiles;
    } else {
      // Default to return all if no filter is provided
      filesToReturn = [...fileData.readFiles, ...fileData.unreadFiles];
      totalFilteredFiles = fileData.totalFiles;
    }

    // Paginate the results
    const paginatedFiles = paginate(filesToReturn, page, limit);
    const totalPages = Math.ceil(totalFilteredFiles / limit);

    // Construct the next and previous page URLs
    const nextPage = page < totalPages ? `/emails?page=${page + 1}&limit=${limit}&filter=${filter}` : null;
    const prevPage = page > 1 ? `/emails?page=${page - 1}&limit=${limit}&filter=${filter}` : null;

    // Return the paginated response with prevPage and nextPage
    res.json({
      currentPage: page,
      totalPages,
      limit,
      totalFiles: totalFilteredFiles, // Total number of filtered files (read, unread, or both)
      files: paginatedFiles,
      nextPage, // URL for the next page (null if on the last page)
      prevPage, // URL for the previous page (null if on the first page)
    });
  } catch (error) {
    res.status(500).json({ error: "Error reading directory" });
  }
});

app.post('/emails/content', authenticate, async (req, res) => {
  const fileName = req.body.file; // Expecting 'file' parameter in the POST body

  if (!fileName) {
    return res.status(400).json({ error: 'No file name provided.' });
  }

  const filePath = path.join(directoryPath, fileName);

  // Check if the file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found.' });
  }

  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8'); // Read file content

    // Use mailparser's simpleParser to parse the email content
    const parsedEmail = await simpleParser(fileContent);

    // Extract the email body content (plain text or HTML)
    const body = parsedEmail.text || parsedEmail.html || 'No body content found';

    // Respond with the email body content
    res.json({
      fileName,
      body
    });
  } catch (error) {
    // Catch all other errors and log them for debugging
    console.error('Error reading file content:', error);
    res.status(500).json({
      error: 'Error reading file content.',
      details: error.message
    });
  }
});

app.post('/emails/parse', authenticate, async (req, res) => {
  const fileName = req.body.file; // Expecting 'file' parameter in the POST body

  if (!fileName) {
    return res.status(400).json({ error: 'No file name provided.' });
  }

  const filePath = path.join(directoryPath, fileName);

  // Check if the file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found.' });
  }

  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8'); // Read file content

    // Use mailparser's simpleParser to parse the email content
    const parsedEmail = await simpleParser(fileContent);

    // Extract necessary fields from the parsed email
    const subject = parsedEmail.subject || 'No Subject';
    const from = parsedEmail.from?.text || 'Unknown sender';
    const to = parsedEmail.to?.text || 'Unknown recipient';
    const cc = parsedEmail.cc?.text || 'No CC';
    const date = parsedEmail.date || 'No Date';

    // Extract original recipient using 'Delivered-To' or 'X-Original-To' headers
    const deliveredTo = parsedEmail.headers.get('delivered-to') || 'Unknown original recipient';
    const originalTo = parsedEmail.headers.get('x-original-to') || 'Unknown original recipient';
    const originalRecipient = deliveredTo !== 'Unknown original recipient' ? deliveredTo : originalTo;

    // Extract and clean up the email body (plain text or HTML)
    let body = parsedEmail.text || parsedEmail.html || 'No body content found';

    // Normalize the body (remove excess newlines)
    body = body.replace(/\n+/g, ' ').trim();

    // Array to store base64-encoded images found in the email body
    const base64Images = [];

    // Array to store extracted links
    const extractedLinks = [];

    // Regex to find and remove plain text URLs (http, https, ftp, etc.)
    const plainTextLinkPattern = /(https?:\/\/[^\s]+)/g;

    // Regex to find and remove HTML links (<a href="...">...</a>)
    const linkPattern = /<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi;

    // If the email contains HTML, search for base64-encoded images and links in the body
    if (parsedEmail.html) {
      // Regex to find base64-encoded images in the HTML (data:image/<type>;base64,...)
      const base64ImagePattern = /data:image\/[a-zA-Z]+;base64,[^"]+/g;

      // Find all matches (base64 images) in the HTML
      const base64Matches = parsedEmail.html.match(base64ImagePattern);

      if (base64Matches) {
        base64Matches.forEach((match, index) => {
          base64Images.push({
            image: match, // The full base64 string
            index: index  // Track the order if needed
          });

          // Remove base64 image from the HTML body
          body = body.replace(match, `[Inline image ${index + 1} removed]`);
        });
      }

      // Extract and remove HTML links from the body using regex
      body = body.replace(linkPattern, (match, href, text) => {
        extractedLinks.push({
          href: href,  // The URL (href attribute)
          text: text   // The anchor text between <a>...</a>
        });

        // Replace the link with an empty string to remove it from the body
        return '';
      });
    }

    // Handle and remove plain text URLs from the body
    body = body.replace(plainTextLinkPattern, (match) => {
      extractedLinks.push({
        href: match,  // The plain text URL
        text: match   // The same URL (no anchor text in this case)
      });

      // Replace the plain text URL with an empty string to remove it
      return '';
    });

    // Respond with the parsed email data, cleaned body, links, and base64 images
    res.json({
      fileName,
      subject,
      from,
      to,
      cc,
      date,
      body: body.trim(),   // Cleaned body content with base64 images and links removed
      originalRecipient,   // Extracted original recipient
      base64Images,        // Array of extracted base64 images
      extractedLinks       // Array of extracted links (URLs and text)
    });
  } catch (error) {
    // Catch all other errors and log them for debugging
    console.error('Error parsing email content:', error);
    res.status(500).json({
      error: 'Error parsing email content.',
      details: error.message
    });
  }
});

app.post('/emails/body', authenticate, async (req, res) => {
  const fileName = req.body.file; // Expecting 'file' parameter in the POST body

  if (!fileName) {
    return res.status(400).json({ error: 'No file name provided.' });
  }

  const filePath = path.join(directoryPath, fileName);

  // Check if the file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found.' });
  }

  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8'); // Read file content

    // Use mailparser's simpleParser to parse the email content
    const parsedEmail = await simpleParser(fileContent);

    // Extract necessary parts: text, html, or attachments
    let extractedText = parsedEmail.text || parsedEmail.html || 'No body content found';
    const isHtml = !!parsedEmail.html;

    // Step 1: Normalize the extracted text (remove multiple newlines)
    extractedText = extractedText.replace(/\n+/g, ' ').trim();

    // Array to store base64-encoded images found in the email body
    const base64Images = [];

    // Array to store extracted links
    const extractedLinks = [];

    // Regex to find and remove plain text URLs (http, https, ftp, etc.)
    const plainTextLinkPattern = /(https?:\/\/[^\s]+)/g;

    // Regex to find and remove HTML links (<a href="...">...</a>)
    const linkPattern = /<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi;

    // If the email contains HTML, search for base64-encoded images and links in the body
    if (isHtml && parsedEmail.html) {
      // Regex to find base64-encoded images in the HTML (data:image/<type>;base64,...)
      const base64ImagePattern = /data:image\/[a-zA-Z]+;base64,[^"]+/g;

      // Find all matches (base64 images) in the HTML
      const base64Matches = parsedEmail.html.match(base64ImagePattern);

      if (base64Matches) {
        base64Matches.forEach((match, index) => {
          base64Images.push({
            image: match, // The full base64 string
            index: index  // Just to track the order if needed
          });

          // Remove base64 image from the HTML body
          extractedText = extractedText.replace(match, `[Inline image ${index + 1} removed]`);
        });
      }

      // Extract and remove HTML links from the HTML body using regex
      extractedText = extractedText.replace(linkPattern, (match, href, text) => {
        extractedLinks.push({
          href: href,  // The URL (href attribute)
          text: text   // The anchor text between <a>...</a>
        });

        // Replace the link with an empty string to remove it from the body
        return '';
      });
    }

    // Step 2: Handle and remove plain text URLs from the text
    extractedText = extractedText.replace(plainTextLinkPattern, (match) => {
      extractedLinks.push({
        href: match,  // The plain text URL
        text: match   // The same URL (no anchor text in this case)
      });

      // Replace the plain text URL with an empty string to remove it
      return '';
    });

    // Respond with the cleaned and normalized body (without base64 images and links), extracted links, and base64 image data separately
    res.json({
      fileName,
      isHtml,
      extractedText: extractedText.trim(),   // Cleaned body content with base64 images and links removed
      base64Images,    // Array of extracted base64 images
      extractedLinks   // Array of extracted links (URLs and text)
    });
  } catch (error) {
    // Catch all other errors and log them for debugging
    console.error('Error parsing email content:', error);
    res.status(500).json({
      error: 'Error parsing email content.',
      details: error.message
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
