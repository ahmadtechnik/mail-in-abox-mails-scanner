const express = require("express");
const dotenv = require("dotenv");
const {authenticate} = require("./middlewares/authenticate");
const {getEmails, getEmailContent, parseEmail, getEmailBody} = require("./routes/emails");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get("/emails", authenticate, getEmails);
app.post("/emails/content", authenticate, getEmailContent);
app.post("/emails/parse", authenticate, parseEmail);
app.post("/emails/body", authenticate, getEmailBody);

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});