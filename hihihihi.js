const express = require("express");
const jwt = require("jwt-simple");
const axios = require("axios");
const nodemailer = require("nodemailer");
const bcrypt = require("../authentication/bcrypt.js");
const crypto = require("crypto");

const config = require("../authentication/config.js");

// Set up connection to postgres database via knex
require("dotenv").config();

const knexConfig = require("../knexfile").development;
const knex = require("knex")(knexConfig);

class AuthRouter {
  constructor() {
    this.router = express.Router();
  }

  route() {
    this.router.post("/signup", this.localSignup.bind(this));
    this.router.post("/local", this.localLogin.bind(this));
    this.router.post("/facebook", this.facebookLogin.bind(this));
    this.router.post("/resetPassword", this.resetPassword.bind(this));
    this.router.post("/checkEmail", this.checkEmailExist.bind(this));

    return this.router;
  }

  async checkEmailExist(req, res) {
    const email = req.body.email;
    const user = await knex("users")
      .where("email", email)
      .catch((err) => {
        console.log(err);
      });
    console.log(user);
    if (user.length) {
      res.sendStatus(200);
    }
    res.send("Unknown email");
  }

  async resetPassword(req, res) {
    const email = req.body.email;

    const resetPasswordCode = crypto.randomBytes(24).toString("hex");

    if (resetPasswordCode) {
      await knex("users")
        .update({ resetPasswordCode: resetPasswordCode })
        .where({ email: email })
        .catch((err) => console.log(err));
    }

    console.log(
      resetPasswordCode,
      email,
      process.env.AUTH_EMAIL,
      process.env.AUTH_PWD
    );

    const transporter = nodemailer.createTransport({
      host: "mail.privateemail.com",
      auth: {
        user: process.env.AUTH_EMAIL,
        pass: process.env.AUTH_PWD,
      },
    });

    const mailOptions = {
      from: process.env.AUTH_EMAIL,
      to: email,
      subject: "RH-software - Your new password reset code",
      text: `This is the url to reset your new password code: https://localhost:3000$/reset/${resetPasswordCode}`,
    };

    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        res.send(error);
      } else {
        console.log("Email sent: " + info.response);
        res.sendStatus(200);
      }
    });
  }

  async localSignup(req, res) {
    if (req.body.email && req.body.password) {
      const email = req.body.email;
      const password = req.body.password;

      const users = await knex("users").where({ email: email });
      if (users.length > 0) {
        res.sendStatus(401);
      }
      const hash = await bcrypt.hashPassword(password);
      const newUser = {
        email,
        password: hash,
        handyperson: req.body.handyperson,
        displayName: req.body.displayName,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        number: req.body.number,
        website: req.body.website,
        description: req.body.description,
        securityQuestion: req.body.securityQuestion,
        securityAnswer: req.body.securityAnswer,
        coverPhoto: req.body.coverPhoto,
        profilePicture: req.body.profilePicture,
      };

      let user = await knex("users")
        .insert(newUser)
        .returning("*")
        .catch((err) => console.log(err));

      user = user[0];

      // Add user job types
      for (const jobTypeId of req.body.types) {
        await knex("handyperson_job_types")
          .insert({
            handypersonId: user.id,
            jobTypeId,
          })
          .catch((err) => console.log(err));
      }

      // Add user locations
      for (const areaId of req.body.locations) {
        await knex("users_working_areas")
          .insert({
            handypersonId: user.id,
            areaId,
          })
          .catch((err) => console.log(err));
      }

      // Add user languages
      for (const languageId of req.body.languages) {
        await knex("users_languages")
          .insert({
            userId: user.id,
            languageId,
          })
          .catch((err) => console.log(err));
      }

      // Add user friends
      for (const secondUserId of req.body.friends) {
        await knex("users_friends")
          .insert({
            userId: user.id,
            secondUserId,
          })
          .catch((err) => console.log(err));
      }

      if (user) {
        const payload = {
          id: user.id,
        };
        const token = jwt.encode(payload, config.jwtSecret);
        res.json({
          token,
          id: user.id,
          handyperson: user.handyperson,
        });
      } else {
        res.sendStatus(401);
      }
    } else {
      res.sendStatus(401);
    }
  }

  async localLogin(req, res) {
    if (req.body.email && req.body.password) {
      const email = req.body.email;
      const password = req.body.password;

      // Read from database to check if user exists
      const users = await knex("users").where({ email });
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
          handyperson: user.handyperson,
        });
      } else {
        res.sendStatus(401);
      }
    } else {
      res.sendStatus(401);
    }
  }

  facebookLogin(req, res) {
    if (req.body.accessToken) {
      const accessToken = req.body.accessToken;
      axios
        .get(`https://graph.facebook.com/me?access_token=${accessToken}`)
        .then(async (data) => {
          if (!data.data.error) {
            let user;

            let users = await knex("users").where({ email: req.body.email });

            if (users.length > 0) {
              user = users[0];
            } else {
              const newUser = {
                displayName: req.body.displayName,
                firstName: req.body.firstName,
                lastName: req.body.lastName,
                email: req.body.email,
                profilePicture: req.body.profilePicture,
                fbAccessToken: accessToken,
                handyperson: false,
              };

              users = await knex("users")
                .insert(newUser)
                .returning("*")
                .catch((err) => console.log(err));

              user = users[0];
            }

            if (user) {
              const payload = {
                id: user.id,
              };
              const token = jwt.encode(payload, config.jwtSecret);
              res.json({
                token,
                id: user.id,
                handyperson: user.handyperson,
              });
            } else {
              res.sendStatus(401);
            }
          } else {
            res.sendStatus(401);
          }
        })
        .catch((err) => {
          console.log(err);
          res.sendStatus(401);
        });
    } else {
      res.sendStatus(401);
    }
  }
}

module.exports = AuthRouter;
