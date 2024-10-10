const basicAuth = require("basic-auth");

// Basic authentication middleware
function authenticate(req, res, next) {
    const authUser = process.env.USERNAME || "admin"; // must be defined in .env
    const authPass = process.env.PASSWORD || "password"; // must be defined in .env

    console.log("Authenticating user...");
    const user = basicAuth(req);
    if (user && user.name === authUser && user.pass === authPass) {
        console.log("Authentication successful.");
        return next();
    }
    console.log("Authentication failed.");
    res.set("WWW-Authenticate", 'Basic realm="example"');
    return res.status(401).send("Authentication required.");
}

module.exports = { authenticate };