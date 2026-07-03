/**
 * Serves the static app and proxies ElevenLabs TTS (API key never exposed to the browser).
 */
require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const rootDir = __dirname;

app.use(express.json({ limit: "1mb" }));

// Enable CORS so your phone app can connect to the laptop
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  );
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

// Helper to send confirmation email using a test account
async function sendConfirmationEmail(user, token) {
  try {
    // Use Ethereal for a test account (no real credentials needed)
    let testAccount = await nodemailer.createTestAccount();
    let transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });

    const confirmationUrl = `http://127.0.0.1:${PORT}/api/confirm/${token}`;
    let info = await transporter.sendMail({
      from: '"Osmosis" <noreply@osmosis.app>',
      to: user.email,
      subject: "Confirm Your Osmosis Account",
      html: `<b>Please confirm your account by clicking this link:</b><br><a href="${confirmationUrl}">${confirmationUrl}</a>`,
    });

    console.log(
      "Confirmation email sent. Preview URL: %s",
      nodemailer.getTestMessageUrl(info),
    );
    return nodemailer.getTestMessageUrl(info);
  } catch (err) {
    console.error(
      "Failed to connect to Ethereal Email. Falling back to direct link.",
    );
    const confirmationUrl = `http://127.0.0.1:${PORT}/api/confirm/${token}`;
    return confirmationUrl;
  }
}

// Simple Authentication Store
const usersFile = path.join(rootDir, "osmosis_users.json");
function getUsers() {
  try {
    if (fs.existsSync(usersFile))
      return JSON.parse(fs.readFileSync(usersFile, "utf8"));
  } catch (e) {}
  return {};
}
function saveUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), "utf8");
}

app.post("/api/register", async (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password || !email)
    return res.status(400).json({ error: "Missing fields" });

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  const users = getUsers();
  if (users[username])
    return res.status(400).json({ error: "Username already taken" });

  if (Object.values(users).some((u) => u.email === email)) {
    return res.status(400).json({ error: "Email already in use" });
  }

  const confirmationToken = crypto.randomBytes(20).toString("hex");
  users[username] = { password, email, confirmed: false, confirmationToken };

  try {
    const previewUrl = await sendConfirmationEmail(
      users[username],
      confirmationToken,
    );
    saveUsers(users);
    res.json({
      message: "Registration successful! Please check your email to confirm.",
      previewUrl: previewUrl,
    });
  } catch (error) {
    console.error("Failed to send confirmation email:", error);
    return res
      .status(500)
      .json({ error: "Could not send confirmation email. Please try again." });
  }
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const users = getUsers();
  const user = users[username];
  if (user && user.password === password) {
    if (!user.confirmed) {
      return res.status(401).json({
        error:
          "Please confirm your email before logging in. Check your registration success message for the link.",
      });
    }
    res.json({ token: username });
  } else {
    res
      .status(401)
      .json({ error: "Invalid username or password. Please try again." });
  }
});

app.get("/api/confirm/:token", (req, res) => {
  const { token } = req.params;
  const users = getUsers();
  const username = Object.keys(users).find(
    (u) => users[u].confirmationToken === token,
  );

  if (!username) {
    return res
      .status(400)
      .send(
        "<h1>Confirmation Failed</h1><p>This confirmation link is invalid or has expired.</p>",
      );
  }

  users[username].confirmed = true;
  delete users[username].confirmationToken;
  saveUsers(users);
  return res.redirect(`/?confirmed=true&user=${username}`);
});

// Auto-Sync API
app.get("/api/sync", (req, res) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const syncFile = path.join(rootDir, `osmosis_sync_${token}.json`);
  if (fs.existsSync(syncFile)) {
    const fileData = fs.readFileSync(syncFile, "utf8");
    res.setHeader("Content-Type", "application/json");
    res.send(fileData || "{}");
  } else {
    res.json({});
  }
});

app.post("/api/sync", (req, res) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const syncFile = path.join(rootDir, `osmosis_sync_${token}.json`);
  fs.writeFileSync(syncFile, JSON.stringify(req.body, null, 2), "utf8");
  res.json({ success: true });
});

// Permanent JS Publishing API
app.post("/api/publish-js", (req, res) => {
  const { topicsData, pathsData } = req.body;
  if (!topicsData || !pathsData)
    return res.status(400).json({ error: "Missing data" });

  // Reconstruct the JavaScript file string
  const jsContent = `window.topicsData = window.topicsData || {};\n\nObject.assign(window.topicsData, ${JSON.stringify(topicsData, null, 2)});\n\nwindow.pathsData = window.pathsData || {};\n\nObject.assign(window.pathsData, ${JSON.stringify(pathsData, null, 2)});`;

  try {
    fs.writeFileSync(path.join(rootDir, "your-topic.js"), jsContent, "utf8");
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.use(
  express.static(path.join(rootDir), {
    index: "index.html",
  }),
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Osmosis server http://127.0.0.1:${PORT}`);
});
