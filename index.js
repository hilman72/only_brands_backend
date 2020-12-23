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
const crypto = require("crypto");
const { resolveSoa } = require("dns");

const configOptions = require("./knexfile").development;
const knex = require("knex")(configOptions);

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());

let today = new Date().toISOString().slice(0, 10);

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
        my_coupon: JSON.stringify([]),
        point: JSON.stringify([]),
        your_ref_coupon: JSON.stringify([]),
        received_ref: JSON.stringify([]),
        followed_users: JSON.stringify([]),

        followed_brands: JSON.stringify([]),
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
        provided_coupon: JSON.stringify([]),
        review: JSON.stringify([]),
        point: JSON.stringify([]),
        point_detail: JSON.stringify([]),
        ref_coupon: JSON.stringify([]),
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
      .then(() => { })
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

//when claim coupon

app.post("/api/claimCoupon/:name", async (req, res) => {
  let name = req.params.name;
  let business_id = req.body.business_id;
  let date = req.body.date;
  let description = req.body.description;
  let title = req.body.title;
  let number = req.body.number;
  let id = req.body.id;
  let b_name = req.body.name;

  let uuid = crypto.randomBytes(4).toString("hex");

  const user = await knex("accounts_users")
    .select()
    .where("user_name", "=", name);
  let coupon = JSON.parse(user[0].my_coupon);

  const business = await knex("accounts_businesses")
    .select()
    .where("id", "=", business_id);
  let p_coupon = JSON.parse(business[0].provided_coupon);

  const each_coupon = await knex("business_coupons")
    .select()
    .where("id", "=", id);
  let coupon_claim = each_coupon.claim_number;
  let coupon_limit = each_coupon.limit;

  //max limit
  if (coupon_claim === coupon_limit) {
    console.log("error3");
    res.send("error");
  }

  //set filter

  const filterFilter = () => {
    if (coupon.length === 0) {
      return [];
    } else if (coupon.length > 0) {
      let x = coupon.filter((rowFilter) => {
        return rowFilter.business_name === b_name;
      });
      return x;
    }
  };

  let filter = filterFilter();
  // console.log(filter);
  // console.log(coupon);

  let newCoupon = {
    coupon_id: uuid,
    linked_id: id,
    title: title,
    description: description,
    date: date,
    user_name: name,
    business_name: b_name,
    used: false,
    expired: false,
    creation_date: today,
  };

  let newCoupon2 = {
    coupon_id: uuid,
    linked_id: id,
    title: title,
    description: description,
    date: date,
    user_name: name,
    business_name: b_name,
    used: false,
    expired: false,
    creation_date: today,
  };

  if (filter === undefined) {
    console.log("error1");
    res.send("error");
  } else if (filter.length <= 0 || coupon.length <= 0) {
    // console.log(
    //   JSON.stringify([...coupon, newCoupon]),
    //   JSON.stringify([...p_coupon, newCoupon2])
    // );
    console.log(name);
    await knex("accounts_users")
      .where("user_name", "=", name)
      .update({ my_coupon: JSON.stringify([...coupon, newCoupon]) });
    await knex("accounts_businesses")
      .where("id", "=", business_id)
      .update({ provided_coupon: JSON.stringify([...p_coupon, newCoupon2]) });
    await knex("business_coupons")
      .where("id", "=", id)
      .update({ claim_number: number + 1 });
    console.log("ok");
    res.send("ok");
  } else {
    console.log("error2");
    res.send("error");
  }
});

//make a ref coupon
app.post("/api/makeRef/", async (req, res) => {
  const name = req.body.u_name;
  const b_name = req.body.b_name;

  await knex("referal_coupons")
    .insert({
      business_name: b_name,
      send_by: name,
    })
    .then(() => {
      console.log("ok");
    })
    .catch((err) => console.log(err));
});

//display your ref coupon
app.post("/api/yourRef/", async (req, res) => {
  let name = req.body.name;

  await knex("referal_coupons")
    .select()
    .where("send_by", "=", name)
    .then((data) => {
      res.send(data);
    });
});

//send referal coupon

app.post("/api/sendRef/", async (req, res) => {
  let name = req.body.name;
  let b_name = req.body.business_name;
  let id = req.body.id;

  const detail = await knex("accounts")
    .select("email")
    .where("username", "=", name);

  let email = detail[0].email;

  const url = `${process.env.URL}api/redirectRef/${id}/`;

  let tags = `
          <p>Thankyou For Your Send Referal</p>
          <br/>
          <br/>
          <h3>Please Copy The Link Below and Send to your friends to earn Rewards</h3>
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
    to: `${email}`,
    subject: "👻  Your Referal Link from Only Brands  👻 ",
    text: "✔ Hello, ",
    html: `${tags}`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log(error);
    }
    console.log("Message sent: %s", info.messageId);
  });
});

//redirect referal link

app.get("/api/redirectRef/:id/", async (req, res) => {
  let id = req.params.id;

  const detail = await knex("referal_coupons").select().where("id", "=", id);

  res.redirect(
    `http://localhost:3000/ClaimRoute/${id}/${detail[0].send_by}/${detail[0].business_name}`
  );
});

//claim referal coupon

app.post("/api/claimRef/", async (req, res) => {
  let name = req.body.name;
  let b_name = req.body.b_name;
  let sent_by = req.body.sent_by;
  let id = req.body.id;

  let uuid = crypto.randomBytes(4).toString("hex");

  const user = await knex("accounts_users")
    .select()
    .where("user_name", "=", name);
  let rece_ref = JSON.parse(user[0].received_ref);

  const business = await knex("accounts_businesses")
    .select()
    .where("business_name", "=", b_name);
  let ref_coupon = JSON.parse(business[0].ref_coupon);

  const filterFilter = () => {
    if (rece_ref.length === 0) {
      return [];
    } else if (rece_ref.length > 0) {
      let x = rece_ref.filter((rowFilter) => {
        return rowFilter.business_name === b_name;
      });
      return x;
    }
  };

  let filter = filterFilter();
  console.log(filter);

  let newRef = {
    coupon_id: uuid,
    linked_id: id,
    title: `${b_name}s Referal Coupon`,
    description: `refer from ${sent_by}`,
    user_name: name,
    business_name: b_name,
    sent_by: sent_by,
    used: false,
    creation_date: today,
  };

  let newRef2 = {
    coupon_id: uuid,
    linked_id: id,
    title: `${b_name}s Referal Coupon`,
    description: `refer from ${sent_by}`,
    user_name: name,
    business_name: b_name,
    sent_by: sent_by,
    used: false,
    creation_date: today,
  };

  if (filter === undefined) {
    console.log("error1");
    res.send("error");
  } else if (filter.length <= 0) {
    await knex("accounts_users")
      .where("user_name", "=", name)
      .update({ received_ref: JSON.stringify([...rece_ref, newRef]) });
    await knex("accounts_businesses")
      .where("business_name", "=", b_name)
      .update({ ref_coupon: JSON.stringify([...ref_coupon, newRef2]) });
    res.send("ok");
  } else {
    console.log("error2");
    res.send("error");
  }
});

//get ref coupon for the claim ref page

app.get("/api/getForClaim/:id", async (req, res) => {
  let id = req.params.id;
  console.log("hi");

  await knex("referal_coupons")
    .select()
    .where("id", "=", id)
    .then((data) => {
      console.log(data);
      res.send(data);
    });
});

//get the received referal coupon and display on my coupon page(user)
app.post("/api/getReceivedRef/", async (req, res) => {
  let name = req.body.name;

  const data = await knex("accounts_users")
    .select("received_ref")
    .where("user_name", "=", name)
    .then((data) => {
      let x = data[0].received_ref;
      res.send(x);
    });
});

//get the received referal coupon and display on my coupon page(business)
app.post("/api/getReceivedRefBusiness/", async (req, res) => {
  let name = req.body.name;

  const data = await knex("accounts_businesses")
    .select("ref_coupon")
    .where("business_name", "=", name)
    .then((data) => {
      let x = data[0].ref_coupon;
      res.send(x);
    });
});

//get for my_coupon page (user)
app.get("/api/myCoupon/user/:name", (req, res) => {
  const name = req.params.name;
  knex("accounts_users")
    .select()
    .where("user_name", "=", name)
    .then((data) => {
      // console.log(JSON.parse(data[0].my_coupon));
      let x = JSON.parse(data[0].my_coupon);
      res.send(x);
    });
});

//get for my_coupon page (business)
app.get("/api/myCoupon/business/:name", (req, res) => {
  const name = req.params.name;
  knex("accounts_businesses")
    .select()
    .where("business_name", "=", name)
    .then((data) => {
      // console.log(JSON.parse(data[0].provided_coupon));
      let x = JSON.parse(data[0].provided_coupon);
      res.send(x);
    });
});

// confirm using ref coupon
app.post("/api/confirmRefCoupon/", async (req, res) => {
  const name = req.body.u_name;
  const b_name = req.body.b_name;
  const coupon_id = req.body.id;

  let user = await knex("accounts_users")
    .select("received_ref")
    .where("user_name", "=", name)
    .then((data) => {
      return JSON.parse(data[0].received_ref);
    });

  let user_coupon = await user.filter((rowFilter) => {
    return rowFilter.coupon_id === coupon_id;
  })[0];

  let user_index = await user.indexOf(user_coupon);

  let business = await knex("accounts_businesses")
    .select("ref_coupon")
    .where("business_name", "=", b_name)
    .then((data) => {
      return JSON.parse(data[0].ref_coupon);
    });

  let business_coupon = await business.filter((rowFilter) => {
    return rowFilter.coupon_id === coupon_id;
  })[0];

  let business_index = await business.indexOf(business_coupon);

  user_coupon.used = true;
  business_coupon.used = true;

  user.splice(user_index, 1, user_coupon);
  business.splice(business_index, 1, business_coupon);

  await knex("accounts_users")
    .where("user_name", "=", name)
    .update({ received_ref: JSON.stringify(user) });
  await knex("accounts_businesses")
    .where("business_name", "=", b_name)
    .update({ ref_coupon: JSON.stringify(business) });
});

//confirm using the coupon
app.post("/api/confirmCoupon/", async (req, res) => {
  const name = req.body.u_name;
  const b_name = req.body.b_name;
  const coupon_id = req.body.id;

  let user = await knex("accounts_users")
    .select("my_coupon")
    .where("user_name", "=", name)
    .then((data) => {
      return JSON.parse(data[0].my_coupon);
    });

  let user_coupon = await user.filter((rowFilter) => {
    return rowFilter.coupon_id === coupon_id;
  })[0];

  let user_index = await user.indexOf(user_coupon);

  let business = await knex("accounts_businesses")
    .select("provided_coupon")
    .where("business_name", "=", b_name)
    .then((data) => {
      return JSON.parse(data[0].provided_coupon);
    });

  let business_coupon = await business.filter((rowFilter) => {
    return rowFilter.coupon_id === coupon_id;
  })[0];

  let business_index = await business.indexOf(business_coupon);

  user_coupon.used = true;
  business_coupon.used = true;

  user.splice(user_index, 1, user_coupon);
  business.splice(business_index, 1, business_coupon);

  await knex("accounts_users")
    .where("user_name", "=", name)
    .update({ my_coupon: JSON.stringify(user) });
  await knex("accounts_businesses")
    .where("business_name", "=", b_name)
    .update({ provided_coupon: JSON.stringify(business) });
});

//setting up data to the backend table account_users
app.post("/edit", async (req, res) => {
  // console.log(req.body);
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

app.get("/photo/:username", async (req, res) => {
  let data = await knex("accounts_users")
    .select("photo")
    .where("user_name", "=", req.params.username);
  res.send(data);
});

//get search post from the frontend
app.get("/api/search/:ggoptions/:filter", async (req, res) => {
  console.log("many many");
  if (req.params.ggoptions === "Brands") {
    let data = await knex("accounts_businesses")
      .select()
      .where("description", "Ilike", `%${req.params.filter}%`)
      .orWhere("category", "Ilike", `%${req.params.filter}%`)
      .orWhere("business_name", "Ilike", `%${req.params.filter}%`);
    console.log(data);
    res.send(data);
    return;
  } else if (req.params.ggoptions === "Coupons") {
    let data2 = await knex("business_coupons")
      .select()
      .where("description", "Ilike", `%${req.params.filter}%`)
      .orWhere("business_name", "Ilike", `%${req.params.filter}%`);
    res.send(data2);
    console.log("you are checking coupons");
  } else if (req.params.ggoptions === "Users") {
    try {
      let data3 = await knex("accounts_users")
        .select()
        .where("description", "Ilike", `%${req.params.filter}%`)
        .orWhere("user_name", "Ilike", `%${req.params.filter}%`);
      res.send(data3);
      console.log("you are checking Users");
    } catch (err) {
      console.log(err);
    }
  }
});

//write some description into database
app.post("/editdetails", async (req, res) => {
  let datadetails = {
    description: req.body.description,
  };
  try {
    await knex("accounts_users")
      .where("account_id", "=", req.body.id)
      .update(datadetails);
    res.send("this is done in backend");
  } catch (error) {
    res.send("There is some error, maybe not updated");
  }
});

//get the data from backend description from account_users
app.get("/textdescription/:id", async (req, res) => {
  let data = await knex("accounts_users")
    .select("description")
    .where("account_id", "=", req.params.id);
  res.send(data);
});

//Add followers

app.post("/api/followers", async (req, res) => {
  // console.log(req.body.username)
  // console.log(req.body.ownUser)

  let id = req.body.ownUser;
  let follower = req.body.username;
  let data = await knex("accounts_users").select().where("account_id", "=", id);

  // console.log(follower)

  let followers = JSON.parse(data[0].followed_users);

  // console.log(followers)

  const filterFilter2 = () => {
    if (followers.length === 0) {
      return [];
    } else if (followers.length > 0) {
      let x = followers.filter((rowFilter) => {
        return rowFilter == follower;
      });
      // console.log(x);
      return x;
    }
  };

  const filter1 = filterFilter2();

  if (filter1 === undefined) {
    console.log("error1");
    res.send("error");
  } else if (filter1.length > 0) {
    res.send("You already follow this user");
    // console.log("Already followed");
  } else if (filter1.length <= 0) {
    // console.log(filter1.length);

    await knex("accounts_users")
      .where("account_id", "=", id)
      .update({ followed_users: JSON.stringify([...followers, follower]) })
      .then((data) => {
        console.log(data);
      });
    console.log("finished");
    return;
  }
});

//Setting followers

app.get("/api/followersAdd/:username", async (req, res) => {
  let user = req.params.username;
  console.log(user);

  await knex("accounts_users")
    .select("followed_users")
    .where("user_name", "=", user)
    .then((data) => {
      console.log(data);
      let length = JSON.parse(data[0].followed_users);
      let aLength = length.length;

      let num = String(aLength);

      // console.log(num);
      res.send(num);
    });

  return;
});

//Handle unfollow

app.post("/api/unfollow", async (req, res) => {
  let id = req.body.ownUser;
  console.log(id);
  let follower = req.body.username;
  console.log(follower);
  let data = await knex("accounts_users").select().where("account_id", "=", id);

  let followers = JSON.parse(data[0].followed_users);

  const filterFilter2 = () => {
    if (followers.length === 0) {
      return [];
    } else if (followers.length > 0) {
      let x = followers.filter((rowFilter) => {
        return rowFilter == follower;
      });
      return x;
    }
  };

  const filter1 = filterFilter2();

  if (filter1 === undefined) {
    res.send("error");
  } else if (filter1.length > 0) {
    let index = followers.indexOf(follower);

    followers.splice(index, 1);

    console.log(followers);

    await knex("accounts_users")
      .where("account_id", "=", id)
      .update({ followed_users: JSON.stringify(followers) })
      .then((data) => {
        console.log("deleted");
        console.log(data);
      });
  }
});

//Count Followers

app.get("/api/countFollowers/:user", (req, res) => {
  console.log(req.params.user);
  let user = req.params.user;

  knex("accounts_users")
    .count("user_name")
    .where("followed_users", "ilike", `%"${user}"%`)
    .then((data) => {
      let count = data[0].count;
      res.send(count);

      console.log(count);
    });
});

//Check if user is followed

app.get("/api/checkFollowed/:username/:id", (req, res) => {
  let username = req.params.username;
  let id = req.params.id;

  knex("accounts_users")
    .select("*")
    .where("account_id", "=", id)
    .andWhere("followed_users", "ilike", `%"${username}"%`)
    .then((data) => {
      if (data.length > 0) {
        res.send(true);
      } else {
        res.send(false);
      }
    });
});

//Following a Business

app.post("/api/followBrand", async (req, res) => {
  console.log(req.body.username);
  console.log(req.body.ownUser);

  let id = req.body.ownUser;
  let follower = req.body.username;
  let data = await knex("accounts_users").select().where("account_id", "=", id);

  console.log(follower);
  console.log("jofj");

  let followers = JSON.parse(data[0].followed_brands);
  console.log(followers);

  // console.log(followers)

  const filterFilter2 = () => {
    if (followers.length === 0) {
      return [];
    } else if (followers.length > 0) {
      let x = followers.filter((rowFilter) => {
        return rowFilter == follower;
      });
      // console.log(x);
      return x;
    }
  };

  const filter1 = filterFilter2();

  if (filter1 === undefined) {
    console.log("error1");
    res.send("error");
  } else if (filter1.length > 0) {
    res.send("You already follow this user");
    // console.log("Already followed");
  } else if (filter1.length <= 0) {
    console.log(filter1.length);

    knex("accounts_users")
      .where("account_id", "=", id)
      .update({ followed_brands: JSON.stringify([...followers, follower]) })
      .then((data) => {
        console.log(data);
      });
    console.log("finished");
    return;
  }
});

//Unfollow a Brand

app.post("/api/unfollowBrand", async (req, res) => {
  console.log("boom");
  let id = req.body.ownUser;

  let follower = req.body.username;
  console.log(follower);
  let data = await knex("accounts_users").select().where("account_id", "=", id);

  let followers = JSON.parse(data[0].followed_brands);

  const filterFilter2 = () => {
    if (followers.length === 0) {
      return [];
    } else if (followers.length > 0) {
      let x = followers.filter((rowFilter) => {
        return rowFilter == follower;
      });
      return x;
    }
  };

  const filter1 = filterFilter2();

  if (filter1 === undefined) {
    res.send("error");
  } else if (filter1.length > 0) {

    let index = followers.indexOf(follower);

    followers.splice(index, 1);

    // console.log(followers);

    knex("accounts_users")
      .where("account_id", "=", id)
      .update({ followed_brands: JSON.stringify(followers) })
      .then((data) => {
        console.log("deleted");
        // console.log(data);
      });
  }
});

//Check if Brand is Followed

app.get("/api/checkBrandFollowed/:username/:id", (req, res) => {

  let username = req.params.username;
  let id = req.params.id;

  knex("accounts_users")

    .select("*")
    .where("account_id", "=", id)
    .andWhere("followed_brands", "ilike", `%"${username}"%`)
    .then((data) => {
      // console.log(data);

      if (data.length > 0) {
        res.send(true);
      } else {
        res.send(false);
      }
    });
});

app.get("/api/countBrandFollowers/:user", (req, res) => {
  // console.log(req.params.user);
  let user = req.params.user;

  knex("accounts_users")
    .count("user_name")
    .where("followed_brands", "ilike", `%"${user}"%`)
    .then((data) => {
      let count = data[0].count;
      res.send(count);

      // console.log(count);
    });
});

//post review data to database
app.post("/api/reviewdetails", async (req, res) => {
  let reviewdata = {
    userid: req.body.userid,
    reviewdetail: req.body.reviewdetail,
  };
  let reviewdataAll = await knex("accounts_businesses")
    .select("review")
    .where("business_name", "=", req.body.businessname);
  //console.log(reviewdata)
  let final = JSON.parse(reviewdataAll[0].review);
  final.push(reviewdata);
  // console.log(final);
  try {
    await knex("accounts_businesses")
      .where("business_name", "=", req.body.businessname)
      .update({ review: JSON.stringify(final) });
    res.send("thats done");
  } catch (error) {
    res.send("There is some error, maybe not updated");
  }
});

app.post("/api/businessphotoedit", async (req, res) => {
  let businessphotoinput = { photo: req.body.photo };
  try {
    await knex("accounts_businesses")
      .where("account_id", "=", req.body.id)
      .update(businessphotoinput);
    res.send("its done");
  } catch (error) {
    res.send("There is some error, maybe not updated");
  }
  return;
});

app.get("/api/getbusinessphoto/:username", async (req, res) => {
  try {
    let photodata = await knex("accounts_businesses")
      .select("photo")
      .where("business_name", "=", req.params.username);
    res.send(photodata);
  } catch (error) {
    res.send("There is some error, maybe not updated");
  }
  return;
});

app.get("/api/getown/:businessname/:user_id", async (req, res) => {
  try {
    let ownreviewdata = await knex("accounts_businesses")
      .select("review")
      .where("business_name", "=", req.params.businessname);
    let final = await JSON.parse(ownreviewdata[0].review);
    let realfinal = final.filter((data) => data.userid == req.params.user_id)
    res.send(realfinal);
    return
  }
  catch (error) { console.log(error) }

  //res.send("it works")
})

app.post("/api/displayCoupon/", async (req, res) => {
  knex("business_coupons")
    .select()
    .then((data) => res.send(data));
});

//setting up port to listen to backend
const port = 5000;
app.listen(port);

console.log("App is listening on port " + port);
