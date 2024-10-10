const fs = require("fs");
const path = require("path");
const { simpleParser } = require("mailparser");
const { parse: parseHtml } = require("node-html-parser");
const { filterFiles, paginate, formatBytes } = require("../utils/fileUtils");

const directoryPath = path.resolve(process.env.DIRECTORY_PATH || "/emails");

// GET /emails
async function getEmails(req, res) {
    try {
        console.log("Handling GET request for /emails endpoint...");
        const fileData = filterFiles(directoryPath);

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const filter = req.query.filter;
        const modifiedSince = parseInt(req.query.modifiedSince);

        console.log(`Query params - Page: ${page}, Limit: ${limit}, Filter: ${filter}, Modified Since: ${modifiedSince}`);

        let filesToReturn;
        let totalFilteredFiles;

        if (filter === "read") {
            filesToReturn = fileData.readFiles;
            totalFilteredFiles = fileData.totalReadFiles;
        } else if (filter === "unread") {
            filesToReturn = fileData.unreadFiles;
            totalFilteredFiles = fileData.totalUnreadFiles;
        } else {
            filesToReturn = [...fileData.readFiles, ...fileData.unreadFiles];
            totalFilteredFiles = fileData.totalFiles;
        }

        if (modifiedSince) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - modifiedSince);

            console.log(`Filtering files modified since: ${cutoffDate}`);

            filesToReturn = filesToReturn.filter(file => new Date(file.filemodified_at) >= cutoffDate);
            totalFilteredFiles = filesToReturn.length;
        }

        filesToReturn.sort((a, b) => new Date(b.filemodified_at) - new Date(a.filemodified_at));
        console.log(`Total filtered files: ${totalFilteredFiles}`);

        const totalSizeInBytes = filesToReturn.reduce((accum, file) => {
            const fileSize = fs.statSync(path.join(directoryPath, file.filename)).size;
            return accum + fileSize;
        }, 0);

        const totalSize = formatBytes(totalSizeInBytes);
        const paginatedFiles = paginate(filesToReturn, page, limit);
        const totalPages = Math.ceil(totalFilteredFiles / limit);

        const nextPage = page < totalPages ? `/emails?page=${page + 1}&limit=${limit}&filter=${filter}&modifiedSince=${modifiedSince}` : null;
        const prevPage = page > 1 ? `/emails?page=${page - 1}&limit=${limit}&filter=${filter}&modifiedSince=${modifiedSince}` : null;

        res.json({
            currentPage: page,
            totalPages,
            limit,
            totalFiles: totalFilteredFiles,
            totalSize,
            files: paginatedFiles,
            nextPage,
            prevPage,
        });
    } catch (error) {
        console.error("Error in /emails GET handler:", error);
        res.status(500).json({ error: "Error reading directory" });
    }
}



// POST /emails/content
async function getEmailContent(req, res) {
    const fileName = req.body.file;
    console.log(`Handling POST request for /emails/content with file: ${fileName}`);

    if (!fileName) {
        console.error('No file name provided in the request.');
        return res.status(400).json({ error: 'No file name provided.' });
    }

    const filePath = path.join(directoryPath, fileName);

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return res.status(404).json({ error: 'File not found.' });
    }

    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        console.log(`Parsing content of file: ${fileName}`);
        const parsedEmail = await simpleParser(fileContent);
        const body = parsedEmail.text || parsedEmail.html || 'No body content found';

        res.json({
            fileName,
            body
        });
    } catch (error) {
        console.error('Error reading file content:', error);
        res.status(500).json({
            error: 'Error reading file content.',
            details: error.message
        });
    }
}

// POST /emails/parse
async function parseEmail(req, res) {
    const fileName = req.body.file;
    console.log(`Handling POST request for /emails/parse with file: ${fileName}`);

    if (!fileName) {
        console.error('No file name provided in the request.');
        return res.status(400).json({ error: 'No file name provided.' });
    }

    const filePath = path.join(directoryPath, fileName);

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return res.status(404).json({ error: 'File not found.' });
    }

    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        console.log(`Parsing content of file: ${fileName}`);
        const parsedEmail = await simpleParser(fileContent);

        const subject = parsedEmail.subject || 'No Subject';
        const from = parsedEmail.from?.text || 'Unknown sender';
        const to = parsedEmail.to?.text || 'Unknown recipient';
        const cc = parsedEmail.cc?.text || 'No CC';
        const date = parsedEmail.date || 'No Date';

        const deliveredTo = parsedEmail.headers.get('delivered-to') || 'Unknown original recipient';
        const originalTo = parsedEmail.headers.get('x-original-to') || 'Unknown original recipient';
        const originalRecipient = deliveredTo !== 'Unknown original recipient' ? deliveredTo : originalTo;

        console.log(`Extracted email details - Subject: ${subject}, From: ${from}, To: ${to}`);

        const plainTextBody = parsedEmail.text || 'No plain text body content found';
        let htmlBody = parsedEmail.html || '';
        let cleanedTextBody = plainTextBody.replace(/\n+/g, ' ').trim();

        const base64Images = [];
        const extractedLinks = [];
        let plainTextFromHtml = '';

        if (htmlBody) {
            try {
                console.log("Parsing HTML body content...");
                htmlBody = htmlBody.replace(/<br\s*\/?>(gi)/g, '\n');
                const root = parseHtml(htmlBody);

                root.querySelectorAll('script, style').forEach(tag => {
                    tag.remove();
                });

                root.querySelectorAll('a').forEach((link, index) => {
                    const href = link.getAttribute('href');
                    const text = link.innerText.trim();
                    if (href) {
                        extractedLinks.push({
                            href: href,
                            text: text || `Link ${index + 1}`,
                        });
                        link.replaceWith(text);
                    }
                });

                const base64ImagePattern = /data:image\/[a-zA-Z]+;base64,[^"]+/g;
                const base64Matches = htmlBody.match(base64ImagePattern);

                if (base64Matches) {
                    base64Matches.forEach((match, index) => {
                        base64Images.push({
                            image: match,
                            index: index,
                        });
                        htmlBody = htmlBody.replace(match, `[Inline image ${index + 1} removed]`);
                    });
                }

                plainTextFromHtml = root.innerText
                    .replace(/\n+/g, ' ')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/&[a-z]+;/gi, ' ')
                    .trim();
            } catch (htmlError) {
                console.error('Error parsing HTML content:', htmlError);
                plainTextFromHtml = htmlBody.replace(/\n+/g, ' ').trim();
            }
        }

        const plainTextLinkPattern = /(https?:\/\/[^\s]+)/g;
        cleanedTextBody = cleanedTextBody.replace(plainTextLinkPattern, (match) => {
            extractedLinks.push({
                href: match,
                text: match
            });
            return '';
        });

        res.json({
            fileName,
            subject,
            from,
            to,
            cc,
            date,
            originalRecipient,
            plainTextBody: cleanedTextBody.trim(),
            htmlBody: plainTextFromHtml.trim(),
            base64Images,
            extractedLinks
        });
    } catch (error) {
        console.error('Error parsing email content:', error);
        res.status(500).json({
            error: 'Error parsing email content.',
            details: error.message
        });
    }
}

// POST /emails/body
async function getEmailBody(req, res) {
    const fileName = req.body.file;
    console.log(`Handling POST request for /emails/body with file: ${fileName}`);

    if (!fileName) {
        console.error('No file name provided in the request.');
        return res.status(400).json({ error: 'No file name provided.' });
    }

    const filePath = path.join(directoryPath, fileName);

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return res.status(404).json({ error: 'File not found.' });
    }

    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        console.log(`Parsing content of file: ${fileName}`);
        const parsedEmail = await simpleParser(fileContent);

        let extractedText = parsedEmail.text || parsedEmail.html || 'No body content found';
        const isHtml = !!parsedEmail.html;
        extractedText = extractedText.replace(/\n+/g, ' ').trim();

        const base64Images = [];
        const extractedLinks = [];

        const plainTextLinkPattern = /(https?:\/\/[^\s]+)/g;
        const linkPattern = /<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi;

        if (isHtml && parsedEmail.html) {
            const base64ImagePattern = /data:image\/[a-zA-Z]+;base64,[^"]+/g;
            const base64Matches = parsedEmail.html.match(base64ImagePattern);

            if (base64Matches) {
                base64Matches.forEach((match, index) => {
                    base64Images.push({
                        image: match,
                        index: index
                    });
                    extractedText = extractedText.replace(match, `[Inline image ${index + 1} removed]`);
                });
            }

            extractedText = extractedText.replace(linkPattern, (match, href, text) => {
                extractedLinks.push({
                    href: href,
                    text: text
                });
                return '';
            });
        }

        extractedText = extractedText.replace(plainTextLinkPattern, (match) => {
            extractedLinks.push({
                href: match,
                text: match
            });
            return '';
        });

        res.json({
            fileName,
            isHtml,
            extractedText: extractedText.trim(),
            base64Images,
            extractedLinks
        });
    } catch (error) {
        console.error('Error parsing email content:', error);
        res.status(500).json({
            error: 'Error parsing email content.',
            details: error.message
        });
    }
}

module.exports = {getEmails, getEmailContent, parseEmail, getEmailBody};