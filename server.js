const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();

// 🔥 Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🔥 MAIL
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "vartik.martin@gmail.com",
    pass: "gvhirnjsfzpfgmvo"
  }
});

// 🧪 TEST ROUTA (veľmi dôležité pre ngrok)
app.get("/", (req, res) => {
  res.send("SERVER FUNGUJE");
});

// 🔴 ALARM
app.post("/alarm", async (req, res) => {
  console.log("ALARM:", req.body);

  try {
    await transporter.sendMail({
      from: "vartik.martin@gmail.com",
      to: "skuskaalarmy@gmail.com",
      subject: "🚨 ALARM",
      text: "PIR vstup narušený!"
    });

    res.send("OK");
  } catch (error) {
    console.error(error);
    res.status(500).send("Chyba");
  }
});

// 🔴 SERVIS
app.post("/service", async (req, res) => {
  console.log("SERVIS:", req.body);

  try {
    await transporter.sendMail({
      from: "vartik.martin@gmail.com",
      to: "skuskaalarmy@gmail.com",
      subject: "🛠️ SERVIS",
      text: `Dobrý deň, na objekt ${req.body.user} žiadam o: ${req.body.service}`
    });

    res.send("OK");
  } catch (error) {
    console.error(error);
    res.status(500).send("Chyba");
  }
});

// 🚀 SERVER
app.listen(3000, "0.0.0.0", () => {
  console.log("Server beží na http://localhost:3000");
});