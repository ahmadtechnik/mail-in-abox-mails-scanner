const fs = require("fs");
const path = require("path");

// Read and filter files from directory
function filterFiles(directoryPath) {
    console.log("Filtering files from directory...");
    const files = fs.readdirSync(directoryPath);

    const readFiles = files
        .filter((file) => file.includes(":2,S"))
        .map((file) => ({
            filename: file,
            filemodified_at: fs.statSync(path.join(directoryPath, file)).mtime,
        }));

    const unreadFiles = files
        .filter((file) => !file.includes(":2,S"))
        .map((file) => ({
            filename: file,
            filemodified_at: fs.statSync(path.join(directoryPath, file)).mtime,
        }));

    console.log(`Total files: ${files.length}, Read files: ${readFiles.length}, Unread files: ${unreadFiles.length}`);

    return {
        readFiles,
        unreadFiles,
        totalReadFiles: readFiles.length,
        totalUnreadFiles: unreadFiles.length,
        totalFiles: files.length,
    };
}

// Paginate the array
function paginate(array, page, limit) {
    console.log(`Paginating results: Page ${page}, Limit ${limit}`);
    const startIndex = (page - 1) * limit;
    const paginatedArray = array.slice(startIndex, startIndex + limit);
    console.log(`Paginated items count: ${paginatedArray.length}`);
    return paginatedArray;
}

// Convert bytes to human-readable format
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = { filterFiles, paginate, formatBytes };