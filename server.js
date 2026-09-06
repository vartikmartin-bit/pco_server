require("dotenv").config();

const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const { testConnection, pool } = require("./database");
const bcrypt = require("bcrypt");

const admin = require("firebase-admin");

const Imap = require("imap");
const { simpleParser } = require("mailparser");

const serviceAccount = require("./pco-alarmy-firebase-adminsdk-fbsvc-32ed50e6fe.json");

// ============================================================
// 🔥 FIREBASE
// ============================================================

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// ============================================================
// 🚀 SERVER
// ============================================================

const app = express();

const PORT = process.env.PORT || 3000;

// ============================================================
// 🔥 MIDDLEWARE
// ============================================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================
// 🚨 POSLEDNÝ ALARM
// ============================================================

let lastAlarm = {
  object: "Žiadny alarm",
  text: "",
  time: "",
};

// ============================================================
// 🔥 LOG
// ============================================================

app.use((req, res, next) => {
  console.log("=================================");
  console.log("ČAS:", new Date().toLocaleString());
  console.log("METÓDA:", req.method);
  console.log("URL:", req.url);
  console.log("IP:", req.ip);

  // Heslá a tokeny zámerne nevypisujeme
  if (req.url === "/login") {
    console.log("BODY: [LOGIN REQUEST]");
  } else if (req.url === "/register-token") {
    console.log("BODY: [TOKEN REQUEST]");
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
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_APP_PASSWORD,
  },
});

// ============================================================
// 📬 IMAP
// ============================================================

const imap = new Imap({
  user: process.env.IMAP_USER,
  password: process.env.IMAP_APP_PASSWORD,

  host: "imap.gmail.com",
  port: 993,
  tls: true,

  tlsOptions: {
    rejectUnauthorized: false,
  },
});

// ============================================================
// 📬 OTVORENIE INBOXU
// ============================================================

function openInbox(cb) {
  imap.openBox("INBOX", false, cb);
}

// ============================================================
// 📬 IMAP READY
// ============================================================

imap.once("ready", () => {
  console.log("📬 IMAP PRIPOJENÝ");

  openInbox((err, box) => {
    if (err) {
      console.error("❌ CHYBA OTVORENIA INBOXU:", err);
      return;
    }

    imap.on("mail", () => {
      const fetch = imap.seq.fetch("*", {
        bodies: "",
      });

      fetch.on("message", (msg) => {
        msg.on("body", async (stream) => {
          try {
            const parsed = await simpleParser(stream);

            const subject = parsed.subject || "";
            const from = parsed.from?.text || "";

            console.log("📩 NOVÝ MAIL:");
            console.log(subject);

            console.log("Predmet:", subject.toLowerCase());
            console.log("Odosielateľ:", from.toLowerCase());

            // ==================================================
            // 🚨 DETEKCIA ALARMU
            // ==================================================
            //
            // POZOR:
            // Aktuálne nechávame tvoju pôvodnú logiku:
            // každý nový mail sa považuje za alarm.
            //
            // Neskôr môžeme spraviť presnú detekciu SIMS.
            // ==================================================

            if (true) {
              console.log("🚨 ALARM DETEKOVANÝ");

              // ==================================================
              // 🚨 ULOŽENIE POSLEDNÉHO ALARMU
              // ==================================================

              lastAlarm = {
                object: subject,
                text: "Alarm prijatý zo SIMS",
                time: new Date().toLocaleString("sk-SK", {
                  timeZone: "Europe/Bratislava",
                }),
              };

              // ==================================================
              // 🔎 NÁJDENIE OBJEKTU
              // ==================================================

              try {
                console.log("🔎 HĽADÁM OBJEKT V DATABÁZE:");

                // Predpoklad:
                // predmet mailu obsahuje číslo objektu,
                // ktoré je uložené v users.object.
                //
                // Najprv skúsime presnú zhodu.
                const exactObject = await pool.query(
                  "SELECT object FROM users WHERE object = $1",
                  [subject.trim()]
                );

                let objectNumber = null;

                if (exactObject.rows.length > 0) {
                  objectNumber = exactObject.rows[0].object;
                } else {
                  // Ak predmet nie je presne číslo objektu,
                  // skúsime nájsť číslo v texte predmetu.
                  const match = subject.match(/\d+/);

                  if (match) {
                    const possibleObject = match[0];

                    const objectResult = await pool.query(
                      "SELECT object FROM users WHERE object = $1",
                      [possibleObject]
                    );

                    if (objectResult.rows.length > 0) {
                      objectNumber = objectResult.rows[0].object;
                    }
                  }
                }

                if (!objectNumber) {
                  console.log(
                    "⚠️ OBJEKT SA V DATABÁZE NENAŠIEL"
                  );
                  console.log(
                    "⚠️ PUSH SA NEODOŠLE"
                  );

                  return;
                }

                console.log(
                  "🏠 OBJEKT NÁJDENÝ:",
                  objectNumber
                );

                // ==================================================
                // 📱 NÁJDENIE FIREBASE TOKENOV
                // ==================================================

                const tokenResult = await pool.query(
                  `
                  SELECT dt.token
                  FROM device_tokens dt
                  INNER JOIN users u
                    ON u.id = dt.user_id
                  WHERE u.object = $1
                  `,
                  [objectNumber]
                );

                if (tokenResult.rows.length === 0) {
                  console.log(
                    "❌ PRE TENTO OBJEKT NIE JE ŽIADNY TOKEN"
                  );

                  return;
                }

                console.log(
                  "📱 POČET TOKENOV:",
                  tokenResult.rows.length
                );

                // ==================================================
                // 🔥 PUSH NA VŠETKY ZARIADENIA OBJEKTU
                // ==================================================

                for (const row of tokenResult.rows) {
                  try {
                    console.log(
                      "🔥 POSIELAM PUSH PRE OBJEKT:",
                      objectNumber
                    );

                    await admin.messaging().send({
                      token: row.token,

                      notification: {
                        title: "🚨 ALARM",
                        body: subject || "Alarm prijatý",
                      },
                    });

                    console.log("✅ PUSH ODOSLANÝ");
                  } catch (error) {
                    console.error(
                      "❌ PUSH CHYBA:",
                      error.message
                    );

                    // ==================================================
                    // 🗑️ NEPLATNÝ TOKEN
                    // ==================================================

                    if (
                      error.code ===
                        "messaging/registration-token-not-registered" ||
                      error.code ===
                        "messaging/invalid-registration-token"
                    ) {
                      console.log(
                        "🗑️ ODSTRAŇUJEM NEPLATNÝ TOKEN Z DATABÁZY"
                      );

                      await pool.query(
                        "DELETE FROM device_tokens WHERE token = $1",
                        [row.token]
                      );
                    }
                  }
                }
              } catch (error) {
                console.error(
                  "❌ CHYBA PRI HĽADANÍ TOKENU:",
                  error
                );
              }
            }
          } catch (error) {
            console.error(
              "❌ CHYBA SPRACOVANIA MAILU:",
              error
            );
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

    try {
      imap.connect();
    } catch (error) {
      console.error(
        "❌ IMAP RECONNECT CHYBA:",
        error
      );
    }
  }, 5000);
});

// ============================================================
// 📬 IMAP CONNECT
// ============================================================

imap.connect();

// ============================================================
// 🧪 TEST SERVER
// ============================================================

app.get("/", (req, res) => {
  res.send("SERVER FUNGUJE");
});

// ============================================================
// 🔐 SERVEROVÉ PRIHLÁSENIE - POSTGRESQL
// ============================================================

app.post("/login", async (req, res) => {
  const username =
    String(req.body.username || "").trim();

  const password =
    String(req.body.password || "").trim();

  console.log("🔐 POKUS O PRIHLÁSENIE");
  console.log("Používateľ:", username);

  try {
    // ========================================================
    // 🔎 NÁJDEME POUŽÍVATEĽA
    // ========================================================

    const result = await pool.query(
      `
      SELECT id, username, password_hash, object
      FROM users
      WHERE username = $1
      `,
      [username]
    );

    // ========================================================
    // ❌ POUŽÍVATEĽ NEEXISTUJE
    // ========================================================

    if (result.rows.length === 0) {
      console.log(
        "❌ POUŽÍVATEĽ NEEXISTUJE"
      );

      return res.status(401).json({
        success: false,
        message: "Nesprávne prihlasovacie údaje",
      });
    }

    const user = result.rows[0];

    // ========================================================
    // 🔐 KONTROLA HESLA
    // ========================================================

    const passwordOk =
      await bcrypt.compare(
        password,
        user.password_hash
      );

    if (!passwordOk) {
      console.log(
        "❌ NESPRÁVNE HESLO"
      );

      return res.status(401).json({
        success: false,
        message: "Nesprávne prihlasovacie údaje",
      });
    }

    // ========================================================
    // ✅ ÚSPEŠNÉ PRIHLÁSENIE
    // ========================================================

    console.log(
      "✅ PRIHLÁSENIE ÚSPEŠNÉ"
    );

    console.log(
      "Objekt:",
      user.object
    );

    return res.json({
      success: true,
      object: user.object,
    });
  } catch (error) {
    console.error(
      "❌ LOGIN DB CHYBA:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Chyba servera",
    });
  }
});

// ============================================================
// 🔥 REGISTER FIREBASE TOKEN
// ============================================================

app.post("/register-token", async (req, res) => {
  const username =
    String(req.body.username || "").trim();

  const token =
    String(req.body.token || "").trim();

  console.log(
    "🔥 REGISTRÁCIA FIREBASE TOKENU"
  );

  console.log(
    "Objekt:",
    username
  );

  // ==========================================================
  // ❌ CHÝBAJÚCE ÚDAJE
  // ==========================================================

  if (!username || !token) {
    console.log(
      "❌ CHÝBA OBJEKT ALEBO TOKEN"
    );

    return res.status(400).json({
      success: false,
      message: "Chýba objekt alebo token",
    });
  }

  try {
    // ========================================================
    // 🔎 NÁJDEME POUŽÍVATEĽA PODĽA OBJEKTU
    // ========================================================

    const userResult = await pool.query(
      `
      SELECT id, username, object
      FROM users
      WHERE object = $1
      `,
      [username]
    );

    if (userResult.rows.length === 0) {
      console.log(
        "❌ OBJEKT NEEXISTUJE V DATABÁZE"
      );

      return res.status(404).json({
        success: false,
        message: "Objekt neexistuje",
      });
    }

    const user = userResult.rows[0];

    // ========================================================
    // 💾 ULOŽENIE TOKENU
    // ========================================================
    //
    // Ak token už existuje:
    // aktualizujeme user_id a updated_at.
    //
    // Ak neexistuje:
    // vytvoríme nový záznam.
    // ========================================================

    await pool.query(
      `
      INSERT INTO device_tokens
        (user_id, token, updated_at)
      VALUES
        ($1, $2, CURRENT_TIMESTAMP)

      ON CONFLICT (token)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        updated_at = CURRENT_TIMESTAMP
      `,
      [user.id, token]
    );

    console.log(
      "✅ FIREBASE TOKEN ULOŽENÝ DO POSTGRESQL"
    );

    console.log(
      "Objekt:",
      user.object
    );

    // Token zámerne nevypisujeme.

    return res.json({
      success: true,
      message: "Token uložený",
    });
  } catch (error) {
    console.error(
      "❌ REGISTER TOKEN DB CHYBA:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Chyba servera",
    });
  }
});

// ============================================================
// 🔥 PUSH TEST
// ============================================================

app.get("/push-test", async (req, res) => {
  try {
    // ========================================================
    // 🔎 ZÍSKAME VŠETKY TOKENY
    // ========================================================

    const result = await pool.query(
      "SELECT token FROM device_tokens"
    );

    if (result.rows.length === 0) {
      return res
        .status(400)
        .send("ŽIADNY TOKEN V DATABÁZE");
    }

    console.log(
      "🔥 PUSH TEST"
    );

    console.log(
      "Počet zariadení:",
      result.rows.length
    );

    let sent = 0;

    for (const row of result.rows) {
      try {
        await admin.messaging().send({
          token: row.token,

          notification: {
            title: "🚨 TEST ALARM",
            body: "Push notifikácia funguje",
          },
        });

        sent++;

        console.log(
          "✅ TEST PUSH ODOSLANÝ"
        );
      } catch (error) {
        console.error(
          "❌ TEST PUSH CHYBA:",
          error.message
        );

        // ====================================================
        // 🗑️ ODSTRÁNENIE NEPLATNÉHO TOKENU
        // ====================================================

        if (
          error.code ===
            "messaging/registration-token-not-registered" ||
          error.code ===
            "messaging/invalid-registration-token"
        ) {
          await pool.query(
            "DELETE FROM device_tokens WHERE token = $1",
            [row.token]
          );

          console.log(
            "🗑️ NEPLATNÝ TOKEN ODSTRÁNENÝ"
          );
        }
      }
    }

    return res.send(
      `PUSH OK - odoslané: ${sent}`
    );
  } catch (error) {
    console.error(
      "❌ PUSH TEST CHYBA:",
      error
    );

    return res
      .status(500)
      .send("PUSH ERROR");
  }
});

// ============================================================
// 🔴 SERVIS + HLIADKY
// ============================================================

app.post("/service", async (req, res) => {
  console.log(
    "🛠️ SERVIS PRIŠIEL"
  );

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

    // ========================================================
    // 📧 ODOSLANIE MAILU
    // ========================================================

    await transporter.sendMail({
      from: process.env.SMTP_USER,

      to: process.env.IMAP_USER,

      subject: mailSubject,

      text: mailText,
    });

    console.log(
      "✅ SERVIS MAIL ODOSLANÝ"
    );

    return res.send("OK");
  } catch (error) {
    console.error(
      "❌ CHYBA SERVISU:",
      error
    );

    return res
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
// 🗄️ POSTGRESQL + 🚀 SERVER
// ============================================================

testConnection();

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