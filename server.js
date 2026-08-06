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

// ============================================================
// 🔥 AKTUÁLNY FIREBASE TOKEN
// ============================================================

let firebaseToken = "";

// ============================================================
// 🚨 POSLEDNÝ ALARM
// ============================================================

let lastAlarm = {
  object: "Žiadny alarm",
  text: "",
  time: ""
};

// ============================================================
// 🔐 TESTOVACÍ POUŽÍVATELIA
// ============================================================
//
// ZATIAĽ IBA TEST.
// Neskôr používateľov presunieme do databázy
// a heslá budú uložené bezpečne ako hash.
//

const users = [
  {
    username: "Klient",
    password: "1234",
    object: "TEST"
  },
  {
    username: "5050",
    password: "2548",
    object: "5050"
  }
];

// ============================================================
// 🔥 MIDDLEWARE
// ============================================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================
// 🔥 LOG
// ============================================================

app.use((req, res, next) => {

  console.log("=================================");
  console.log("ČAS:", new Date().toLocaleString());
  console.log("METÓDA:", req.method);
  console.log("URL:", req.url);
  console.log("IP:", req.ip);

  // Heslo zámerne nevypisujeme do logu
  if (req.url === "/login") {
    console.log("BODY: [LOGIN REQUEST]");
  } else {
    console.log("BODY:", req.body);
  }

  console.log("=================================");

  next();
});

// ============================================================
// 📧 GMAIL SMTP
// ============================================================

const transporter = nodemailer.createTransport({

  service: "gmail",

  auth: {
    user: "vartik.martin@gmail.com",

    // ⚠️ SEM VLOŽ SVOJE EXISTUJÚCE SMTP APP PASSWORD
    pass: "gvhirnjsfzpfgmvo"
  }
});

// ============================================================
// 📬 IMAP
// ============================================================

const imap = new Imap({

  user: "skuskaalarmy@gmail.com",

  // ⚠️ SEM VLOŽ SVOJE EXISTUJÚCE IMAP APP PASSWORD
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

// ============================================================
// 📬 IMAP READY
// ============================================================

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

          console.log(subject.toLowerCase());
          console.log(from.toLowerCase());

          // ==================================================
          // 🚨 DETEKCIA ALARMU
          // ==================================================

          if (true) {

            console.log("🚨 ALARM DETEKOVANÝ");

            // 🚨 ULOŽENIE ALARMU

            lastAlarm = {

              object: subject,

              text: "Alarm prijatý zo SIMS",

              time: new Date().toLocaleString("sk-SK", {
                timeZone: "Europe/Bratislava"
              })
            };

            console.log("🔥 AKTUÁLNY TOKEN:");
            console.log(firebaseToken);

            // ==================================================
            // 🔥 PUSH
            // ==================================================

            if (firebaseToken) {

              try {

                console.log("🔥 PUSH SA POKÚŠA ODOSLAŤ");

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
                console.log(firebaseToken);
              }

            } else {

              console.log("❌ TOKEN CHÝBA");
            }
          }
        });
      });
    });
  });
});

// ============================================================
// ❌ IMAP CHYBA
// ============================================================

imap.on("error", (err) => {

  console.error("❌ IMAP CHYBA:", err);

});

// ============================================================
// 📪 IMAP END + RECONNECT
// ============================================================

imap.on("end", () => {

  console.log("📪 IMAP UKONČENÝ");

  setTimeout(() => {

    console.log("🔄 IMAP RECONNECT");

    imap.connect();

  }, 5000);
});

imap.connect();

// ============================================================
// 🧪 TEST SERVER
// ============================================================

app.get("/", (req, res) => {

  res.send("SERVER FUNGUJE");

});

// ============================================================
// 🔐 SERVEROVÉ PRIHLÁSENIE
// ============================================================

app.post("/login", (req, res) => {

  const username =
      String(req.body.username || "").trim();

  const password =
      String(req.body.password || "").trim();

  console.log("🔐 POKUS O PRIHLÁSENIE");
  console.log("Používateľ:", username);

  const user = users.find(

    (u) =>
      u.username === username &&
      u.password === password

  );

  // ❌ NESPRÁVNE ÚDAJE

  if (!user) {

    console.log("❌ NESPRÁVNE PRIHLÁSENIE");

    return res.status(401).json({

      success: false,

      message:
          "Nesprávne prihlasovacie údaje"

    });
  }

  // ✅ ÚSPECH

  console.log("✅ PRIHLÁSENIE ÚSPEŠNÉ");
  console.log("Objekt:", user.object);

  res.json({

    success: true,

    object: user.object

  });
});

// ============================================================
// 🔥 REGISTER TOKEN
// ============================================================

app.post("/register-token", (req, res) => {

  firebaseToken = req.body.token;

  console.log("🔥 NOVÝ TOKEN:");
  console.log(firebaseToken);

  res.send("TOKEN ULOŽENÝ");

});

// ============================================================
// 🔥 PUSH TEST
// ============================================================

app.get("/push-test", async (req, res) => {

  try {

    if (!firebaseToken) {

      return res
          .status(400)
          .send("TOKEN CHÝBA");
    }

    await admin.messaging().send({

      token: firebaseToken,

      notification: {

        title: "🚨 TEST ALARM",

        body:
            "Push notifikácia funguje"

      }
    });

    console.log("✅ PUSH ODOSLANÝ");

    res.send("PUSH OK");

  } catch (error) {

    console.error(
      "❌ PUSH CHYBA:",
      error
    );

    res
        .status(500)
        .send("PUSH ERROR");
  }
});

// ============================================================
// 🔴 SERVIS + HLIADKY
// ============================================================

app.post("/service", async (req, res) => {

  console.log("🛠️ SERVIS PRIŠIEL");

  try {

    let mailText = "";
    let mailSubject = "";

    // ========================================================
    // 🚓 HLIADKY ODVOLAŤ
    // ========================================================

    if (
      req.body.service ===
      "Hliadky odvolané"
    ) {

      mailSubject =
          "🚓 HLIADKY ODVOLANÉ";

      mailText =
          "Dobrý deň SRP, hliadky prosím odvolať.";

    }

    // ========================================================
    // 🚓 HLIADKY POTVRDIŤ
    // ========================================================

    else if (
      req.body.service ===
      "Hliadky potvrdené"
    ) {

      mailSubject =
          "🚓 HLIADKY POTVRDENÉ";

      mailText =
          "Dobrý deň SRP, hliadky týmto potvrdzujem.";

    }

    // ========================================================
    // 🔧 SERVIS
    // ========================================================

    else {

      mailSubject =
          "🛠️ SERVIS";

      mailText =
          `Dobrý deň SRP, žiadam o servis: ${req.body.service}`;

    }

    await transporter.sendMail({

      from:
          "vartik.martin@gmail.com",

      to:
          "skuskaalarmy@gmail.com",

      subject:
          mailSubject,

      text:
          mailText

    });

    console.log(
      "✅ SERVIS MAIL ODOSLANÝ"
    );

    res.send("OK");

  } catch (error) {

    console.error(
      "❌ CHYBA SERVISU:",
      error
    );

    res
        .status(500)
        .send("Chyba");
  }
});

// ============================================================
// 🚨 POSLEDNÝ ALARM
// ============================================================

app.get("/last-alarm", (req, res) => {

  res.json(lastAlarm);

});

// ============================================================
// 🚀 SERVER
// ============================================================

const PORT =
    process.env.PORT || 3000;

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      "================================="
    );

    console.log(
      `🚀 SERVER BEŽÍ NA PORTE ${PORT}`
    );

    console.log(
      "================================="
    );
  }
);