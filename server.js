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

// 🔥 GMAIL IMAP
const imap = new Imap({
  user: "skuskaalarmy@gmail.com",
  password: "hyps qflp tter eaut",
  host: "imap.gmail.com",
  port: 993,
  tls: true
});

function openInbox(cb) {
  imap.openBox("INBOX", false, cb);
}

imap.once("ready", () => {

  console.log("📬 IMAP PRIPOJENÝ");

  openInbox((err, box) => {

    if (err) throw err;

    imap.on("mail", () => {

});