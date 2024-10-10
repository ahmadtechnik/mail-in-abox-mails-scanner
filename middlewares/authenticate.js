const basicAuth = require("basic-auth");

// Basic authentication middleware
function authenticate(req, res, next) {
    const authUser = process.env.USERNAME || "admin";
    const authPass = process.env.PASSWORD || "password";

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