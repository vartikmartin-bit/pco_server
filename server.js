const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const admin = require("firebase-admin");

const Imap = require("imap");
const { simpleParser } = require("mailparser");

const serviceAccount = require("./pco-alarmy-firebase-adminsdk-fbsvc-32ed50e6fe.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const app = express();

// 🔥 AKTUÁLNY FIREBASE TOKEN
let firebaseToken = "";

// 🔥 Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🔥 LOG
app.use((req, res, next) => {

  console.log("=================================");
  console.log("ČAS:", new Date().toLocaleString());
  console.log("METÓDA:", req.method);
  console.log("URL:", req.url);
  console.log("IP:", req.ip);
  console.log("BODY:", req.body);
  console.log("=================================");

  next();
});

// 🔥 GMAIL SMTP
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "vartik.martin@gmail.com",
    pass: "gvhirnjsfzpfgmvo"
  }
});

// 🔥 IMAP
const imap = new Imap({
const imap = new Imap({
  user: "skuskaalarmy@gmail.com",
  password: "hyps qflp tter eaut",
  host: "imap.gmail.com",
  port: 993,
  tls: true,
  tlsOptions: {
    rejectUnauthorized: false
  }
});

function openInbox(cb) {
  imap.openBox("INBOX", false, cb);
}

imap.once("ready", () => {

  console.log("📬 IMAP PRIPOJENÝ");

  openInbox((err, box) => {

    if (err) throw err;

    imap.on("mail", () => {

      const fetch = imap.seq.fetch("*", {
        bodies: ""
      });

      fetch.on("message", (msg) => {

        msg.on("body", async (stream) => {

          const parsed = await simpleParser(stream);

          const subject = parsed.subject || "";
          const from = parsed.from?.text || "";

          console.log("📩 NOVÝ MAIL:");
          console.log(subject);

          // 🚨 DETEKCIA
          if (
            subject.toLowerCase().includes("testovaci objekt") ||
            from.toLowerCase().includes("operacne@securiton.sk")
          ) {

            console.log("🚨 ALARM DETEKOVANÝ");

            if (firebaseToken) {

              try {

                await admin.messaging().send({

                  token: firebaseToken,

                  notification: {
                    title: "🚨 ALARM",
                    body: subject || "Alarm prijatý"
                  }
                });

                console.log("✅ PUSH ODOSLANÝ");

              } catch (error) {

                console.error("❌ PUSH CHYBA:", error);
              }
            }
          }
        });
      });
    });
  });
});

imap.once("error", (err) => {
  console.error("❌ IMAP CHYBA:", err);
});

imap.once("end", () => {
  console.log("📪 IMAP UKONČENÝ");
});

imap.connect();

// 🧪 TEST
app.get("/", (req, res) => {

  res.send("SERVER FUNGUJE");
});

// 🔥 REGISTER TOKEN
app.post("/register-token", (req, res) => {

  firebaseToken = req.body.token;

  console.log("🔥 NOVÝ TOKEN:");
  console.log(firebaseToken);

  res.send("TOKEN ULOŽENÝ");
});

// 🔥 PUSH TEST
app.get("/push-test", async (req, res) => {

  try {

    if (!firebaseToken) {
      return res.status(400).send("TOKEN CHÝBA");
    }

    await admin.messaging().send({

      token: firebaseToken,

      notification: {
        title: "🚨 TEST ALARM",
        body: "Push notifikácia funguje"
      }
    });

    console.log("✅ PUSH ODOSLANÝ");

    res.send("PUSH OK");

  } catch (error) {

    console.error("❌ PUSH CHYBA:", error);

    res.status(500).send("PUSH ERROR");
  }
});

// 🚀 SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {

  console.log("=================================");
  console.log(`🚀 SERVER BEŽÍ NA PORTE ${PORT}`);
  console.log("=================================");
});