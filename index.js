require("dotenv").config();

const express = require("express");
const path = require("path");
const jwt = require("jwt-simple");
const cors = require("cors");
const axios = require("axios");
const config = require("./config.js");
const app = express();
const bcrypt = require("./bcrypt");
const nodemailer = require("nodemailer");

const configOptions = require("./knexfile").development;
const knex = require("knex")(configOptions);

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());

//Handle general request
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname + "/LandingPage"));
});

app.post("/api/login", async function (req, res) {
  console.log(req.body.username);
  if (req.body.username && req.body.password) {
    const username = req.body.username;
    const password = req.body.password;

    // Read from database to check if user exists
    const users = await knex("accounts").where({ username });
    if (users.length === 0) {
      res.sendStatus(401);
    }
    const user = users[0];
    const result = await bcrypt.checkPassword(password, user.password);

    if (result) {
      const PAYLOAD = {
        id: user.id,
      };
      const token = jwt.encode(PAYLOAD, config.jwtSecret);
      res.json({
        token,
        id: user.id,
      });
    } else {
      res.sendStatus(401);
    }
  } else {
    res.sendStatus(401);
  }
});

app.post("/api/signup", async function (req, res) {
  if (req.body.username && req.body.password && req.body.email) {
    const username = req.body.username;
    const email = req.body.email;
    const password = req.body.password;

    const users = await knex("accounts").where({ username: username });
    if (users.length > 0) {
      res.sendStatus(401);
    }
    const hash = await bcrypt.hashPassword(password);
    const newUser = {
      username: username,
      email: email,
      password: hash,
      checked: false,
      user: true,
      business: false,
      admin: false,
    };

    let user = await knex("accounts")
      .insert(newUser)
      .returning("*")
      .catch((err) => console.log(err));

    //email part
    console.log(newUser);

    const url = `${process.env.URL}/api/verification/${newUser.username}`;

    let tags = `
            <p>Thankyou For Your Register</p>
            <br/>
            <br/>
            <h3>Click the link to verify</h3>
            <ul>  
                <li>${url}</li>
            </ul>
            <br/>
            <h3>Thank You.</h3>`;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP,
      port: process.env.PORT,
      secure: false,
      auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD,
      },
    });

    let mailOptions = {
      from: `${process.env.EMAIL}`,
      to: `${newUser.email}`,
      subject: "👻  Only Brands Verification 👻 ",
      text: "✔ Hello, ",
      html: `${tags}`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return console.log(error);
      }
      console.log("Message sent: %s", info.messageId);
    });
  } else {
    res.sendStatus(401);
  }
});

app.post("/api/verification/:username", async function (req, res) {
  console.log("verified");
});

//setting up port to listen to backend
const port = 5000;
app.listen(port);

console.log("App is listening on port " + port);
