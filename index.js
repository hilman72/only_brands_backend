const express = require("express");
const path = require("path");
const jwt = require("jwt-simple");
const cors = require("cors");
const axios = require("axios");
const config = require("./config.js");
const app = express();
const bcrypt = require("./bcrypt");

const configOptions = require("./knexfile").development;
const knex = require("knex")(configOptions);

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

//Handle general request
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname + "/LandingPage"));
});

app.post("/api/login", async function (req, res) {
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
      console.log("nice");
    } else {
      res.sendStatus(401);
      console.log("oops");
    }
  } else {
    res.sendStatus(401);
    console.log("oops");
  }
});

app.post("/api/signup", async function (req, res) {
  console.log(req.body);
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
    };

    let user = await knex("accounts")
      .insert(newUser)
      .returning("*")
      .catch((err) => console.log(err));
  } else {
    res.sendStatus(401);
  }
});

//setting up port to listen to backend
const port = process.env.PORT || 5000;
app.listen(port);

console.log("App is listening on port " + port);
