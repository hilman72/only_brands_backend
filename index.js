const express = require("express");
const path = require("path");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const axios = require("axios");
const config = require("./config.js");
const app = express();

const configOptions = require("./knexfile").development;
const knex = require("knex")(configOptions);

//Handle general request
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname + "/LandingPage"));
});

app.post("/api/login", async function (req, res) {
  console.log("logging in");
  console.log(req.body.email, req.body.password);
  // FROM A REAL DATABASE
  if (req.body.email && req.body.password) {
    let email = req.body.email;
    let password = req.body.password;
    let query = await knex
      .select("*")
      .from("users")
      .where("email", email)
      .andWhere("password", password);

    await query;

    if (query) {
      let payload = {
        id: query[0].id,
      };
      let token = jwt.sign(payload, config.jwtSecret);
      res.json({
        token: token,
      });
    } else {
      res.sendStatus(401);
    }
  } else {
    res.sendStatus(401);
  }
});

app.post("/api/signup", async function (req, res) {
  if (req.body.email && req.body.password) {
    const email = req.body.email;
    const password = req.body.password;

    const users = await knex("users").where({ email: email });
    if (users.length > 0) {
      res.sendStatus(401);
    }
    const hash = await bcrypt.hashPassword(password);
    const newUser = {
      username: username,
      email: email,
      password: hash,
    };

    let user = await knex("users")
      .insert(newUser)
      .returning("*")
      .catch((err) => console.log(err));

    user = user[0];

    if (user) {
      const payload = {
        id: user.id,
      };
      const token = jwt.encode(payload, config.jwtSecret);
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

//setting up port to listen to backend
const port = process.env.PORT || 5000;
app.listen(port);

console.log("App is listening on port " + port);
