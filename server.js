const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const admin = require("firebase-admin");

const serviceAccount = require("./pco-alarmy-firebase-adminsdk-fbsvc-32ed50e6fe.json");

const app = express();

// 🔥 FIREBASE
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// 🔥 FIREBASE TOKEN
const firebaseToken =
"fb2NvTPhQp6msOTHQ-bAyB:APA91bE00dz35hYyn87CAefEe-7IN3C3qjaBntgHTAUF_YXeIRk60fRTcX6OceZbmRiVx-5VQwFI9pbUwrjeN-BFd2a6XSfpJOXueVKhTw5cL3QZU4ntovs";

// 🔥 Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🔥 LOG KAŽDÉHO REQUESTU
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

// 🔥 MAIL
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "vartik.martin@gmail.com",
    pass: "gvhirnjsfzpfgmvo"
  }
});

// 🧪 TEST ROUTA
app.get("/", (req, res) => {

  console.log("TEST SERVER FUNGUJE");

  res.send("SERVER FUNGUJE");
});

// 🔥 PUSH TEST
app.get("/push-test", async (req, res) => {

  try {

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

// 🔴 ALARM
app.post("/alarm", async (req, res) => {

  console.log("🚨 ALARM PRIŠIEL");

  try {

    // 🔥 PUSH NOTIFIKÁCIA
    await admin.messaging().send({

      token: firebaseToken,

      notification: {
        title: "🚨 ALARM",
        body: "PIR vstup narušený!"
      }
    });

    // 🔥 EMAIL
    await transporter.sendMail({

      from: "vartik.martin@gmail.com",

      to: "skuskaalarmy@gmail.com",

      subject: "🚨 ALARM",

      text: "PIR vstup narušený!"
    });

    console.log("✅ MAIL AJ PUSH ODOSLANÝ");

    res.send("OK");

  } catch (error) {

    console.error("❌ CHYBA ALARMU:", error);

    res.status(500).send("Chyba");
  }
});

// 🔴 SERVIS + HLIADKY
app.post("/service", async (req, res) => {

  console.log("🛠️ SERVIS PRIŠIEL");

  try {

    let mailText = "";
    let mailSubject = "";

    // 🚓 HLIADKY ODVOLAŤ
    if (req.body.service === "Hliadky odvolané") {

      mailSubject = "🚓 HLIADKY ODVOLANÉ";

      mailText =
          "Dobrý deň SRP, hliadky prosím odvolať.";
    }

    // 🚓 HLIADKY POTVRDIŤ
    else if (req.body.service === "Hliadky potvrdené") {

      mailSubject = "🚓 HLIADKY POTVRDENÉ";

      mailText =
          "Dobrý deň SRP, hliadky týmto potvrdzujem.";
    }

    // 🔧 KLASICKÝ SERVIS
    else {

      mailSubject = "🛠️ SERVIS";

      mailText =
          `Dobrý deň SRP, žiadam o servis: ${req.body.service}`;
    }

    await transporter.sendMail({

      from: "vartik.martin@gmail.com",

      to: "skuskaalarmy@gmail.com",

      subject: mailSubject,

      text: mailText
    });

    console.log("✅ SERVIS MAIL ODOSLANÝ");

    res.send("OK");

  } catch (error) {

    console.error("❌ CHYBA SERVISU:", error);

    res.status(500).send("Chyba");
  }
});

// 🚀 SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {

  console.log("=================================");
  console.log(`🚀 SERVER BEŽÍ NA PORTE ${PORT}`);
  console.log("=================================");
});