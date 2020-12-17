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

app.post("/api/login", async function (req, res) {
  console.log(req.body.username);
  if (req.body.username && req.body.password) {
    const username = req.body.username;
    const password = req.body.password;
    let identity = "";

    // Read from database to check if user exists
    const users = await knex("accounts").where({ username });

    if (users.length === 0) {
      res.sendStatus(401);
    }
    const user = users[0];
    const result = await bcrypt.checkPassword(password, user.password);

    if (user.user === true) {
      identity = "user";
    } else if (user.business === true) {
      identity = "business";
    } else if (user.admin === true) {
      identity = "admin";
    }

    if (result) {
      const PAYLOAD = {
        id: user.id,
      };
      const token = jwt.encode(PAYLOAD, config.jwtSecret);
      res.json({
        token,
        id: user.id,
        identity: identity,
        username: username,
      });
    } else {
      res.sendStatus(401);
    }
  } else {
    res.sendStatus(401);
  }
});

app.post("/api/signup/user", async function (req, res) {
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

    await knex("accounts_users")
      .insert({
        account_id: user[0].id,
        user_name: username,
        my_coupon: "[]",
        point: "[]",
      })
      .catch((err) => console.log(err));

    //email part
    console.log(newUser);

    const url = `${process.env.URL}api/verification/${newUser.username}`;

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

app.post("/api/signup/business", async function (req, res) {
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
      user: false,
      business: true,
      admin: false,
    };

    let user = await knex("accounts")
      .insert(newUser)
      .returning("*")
      .catch((err) => console.log(err));

    await knex("accounts_businesses")
      .insert({
        account_id: user[0].id,
        business_name: username,
        provided_coupon: "[]",
        point: "[]",
        point_detail: "[]",
      })
      .catch((err) => console.log(err));

    //email part
    console.log(newUser);

    const url = `${process.env.URL}api/verification/${newUser.username}`;

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

app.get("/api/verification/:username", async function (req, res) {
  let username = req.params.username;
  console.log("verified");
  knex("accounts")
    .where("username", "=", `${username}`)
    .update({ checked: true })
    .then(() => {
      res.redirect("http://localhost:3000/LoginPage");
    });
});

app.post("/api/createCoupon", async function (req, res) {
  const finished_date = req.body.finished_date;
  const description = req.body.description;
  const discount = req.body.discount;
  const limit = req.body.limit;
  const name = req.body.business_name;
  const id = req.body.account_business_id;
  if (finished_date && description && discount && limit && id) {
    let take = await knex("accounts_businesses").where(
      "account_id",
      "=",
      `${id}`
    );

    const realId = take[0].id;

    await knex("business_coupons")
      .insert({
        business_name: name,
        finished_date: finished_date,
        description: description,
        discount: discount,
        limit: limit,
        account_business_id: realId,
        used: false,
        claim_number: 0,
      })
      .then(() => {})
      .catch((err) => console.log(err));
  } else {
    res.sendStatus(401);
  }
});

//getBusinessDetail

app.get("/api/getBusinessDetail/:name", async (req, res) => {
  let name = req.params.name;
  await knex("accounts_businesses")
    .select()
    .where("business_name", "=", name)
    .then((data) => res.send(data));
});

//getBusinessCoupon
app.get("/api/getCoupon/:name", async (req, res) => {
  let name = req.params.name;
  await knex("business_coupons")
    .select()
    .where("business_name", "=", name)
    .then((data) => res.send(data));
});

app.post("/api/claimCoupon/:name", async (req, res) => {
  let name = req.params.name;
  let id = req.body.id;
  await knew();
});

//setting up data to the backend table account_users
app.post("/edit", async (req, res) => {
  console.log(req.body);
  let userProfile = {
    photo: req.body.photo,
  };

  try {
    await knex("accounts_users")
      .where("account_id", "=", req.body.id)
      .update(userProfile);
    //let user_data = await knex("accounts_users")
    //  .select()
    //  .where("account_id", "=", req.body.id)
    //console.log(user_data)
    res.send(user_data[0]);
  } catch (error) {
    res.send("There is some error, maybe not updated");
  }
});

app.get("/photo/:id", async (req, res) => {
  let data = await knex("accounts_users")
    .select("photo")
    .where("account_id", "=", req.params.id);
  res.send(data);
});

//get search post from the frontend
app.get("/api/search/:ggoptions/:filter", async (req, res) => {
  console.log("many many");
  if (req.params.ggoptions === "Brands") {
    let data = await knex("accounts_businesses")
      .select()
      .where("description", "Ilike", `%${req.params.filter}%`)
      .orWhere("category", "Ilike", `%${req.params.filter}%`);
    res.send(data);
  }
});

//setting up port to listen to backend
const port = 5000;
app.listen(port);

console.log("App is listening on port " + port);
