const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();

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

// 🔴 ALARM
app.post("/alarm", async (req, res) => {

  console.log("🚨 ALARM PRIŠIEL");

  try {

    await transporter.sendMail({
      from: "vartik.martin@gmail.com",
      to: "skuskaalarmy@gmail.com",
      subject: "🚨 ALARM",
      text: "PIR vstup narušený!"
    });

    console.log("✅ MAIL ODOSLANÝ");

    res.send("OK");

  } catch (error) {

    console.error("❌ CHYBA MAILU:", error);

    res.status(500).send("Chyba");
  }
});

// 🔴 SERVIS
app.post("/service", async (req, res) => {

  console.log("🛠️ SERVIS PRIŠIEL");

  try {

    let mailText = "";

    // 🚓 HLIADKY ODVOLAŤ
    if (req.body.service === "Hliadky odvolané") {

      mailText = "Dobrý deň SRP, hliadky prosím odvolať.";

    }

    // 🚓 HLIADKY POTVRDIŤ
    else if (req.body.service === "Hliadky potvrdené") {

      mailText = "Dobrý deň SRP, hliadky týmto potvrdzujem.";

    }

    // 🔧 KLASICKÝ SERVIS
    else {

      mailText =
          `Dobrý deň SRP, žiadam o servis: ${req.body.service}`;
    }

    await transporter.sendMail({

      from: "vartik.martin@gmail.com",

      to: "skuskaalarmy@gmail.com",

      subject: "🛠️ SERVIS",

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