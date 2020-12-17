exports.up = function (knex, Promise) {
  return knex.schema
    .createTable("accounts", (table) => {
      table.increments("id").primary();
      table.string("password").unique();
      table.string("email").unique();
      table.string("username").unique();
      table.boolean("checked");
      table.boolean("user");
      table.boolean("business");
      table.boolean("admin");
    })
    .then(() => {
      return knex.schema.createTable("accounts_users", (details) => {
        details.increments("id").primary();
        details.string("photo");
        details.string("description");
        details.string("user_name");
        //to establish one-to-one relationship with accounts
        details.integer("account_id").unsigned().unique();
        details.foreign("account_id").references("accounts.id");
      });
    })
    .then(() => {
      return knex.schema.createTable("liked_businesses", (like) => {
        like.increments("id").primary();
        like.string("liked_business_id");
        //to establish one-to-many relationship with accounts_users
        like.integer("account_user_id").unsigned();
        like.foreign("account_user_id").references("accounts_users.id");
      });
    })
    .then(() => {
      return knex.schema.createTable("accounts_businesses", (businesses) => {
        businesses.increments("id").primary();
        businesses.specificType("fulltext", "tsvector");
        businesses.string("business_name");
        businesses.string("photo");
        businesses.string("address");
        businesses.string("description");
        businesses.string("contact");
        businesses.string("category");
        //one-to-one relationship with accounts
        businesses.integer("account_id").unsigned().unique();
        businesses.foreign("account_id").references("accounts.id");
      });
    })
    .then(() => {
      return knex.schema.createTable(
        "users_recommendations",
        (recommendations) => {
          recommendations.increments("id").primary();
          recommendations.string("description");
          recommendations.dateTime("date");
          //one to one relationship with accounts
          recommendations.integer("account_id").unsigned().unique();
          recommendations.foreign("account_id").references("accounts.id");
        }
      );
    })
    .then(() => {
      return knex.schema.createTable("business_coupons", (bus_coup) => {
        bus_coup.increments("id").primary();
        bus_coup.string("description");
        bus_coup.string("finished_date");
        bus_coup.boolean("used");
        bus_coup.string("discount");
        bus_coup.string("limit");
        bus_coup.string("business_name");
        //one to many relationship with accounts
        bus_coup.integer("account_id").unsigned();
        bus_coup.foreign("account_id").references("accounts.id");
        //one to many relationship with users_referals
        bus_coup.integer("account_business_id").unsigned();
        bus_coup
          .foreign("account_business_id")
          .references("accounts_businesses.id");
      });
    })
    .then(() => {
      return knex.schema.createTable("referal_coupons", (ref_coup) => {
        ref_coup.increments("id").primary();
        ref_coup.string("description");
        ref_coup.string("finished_date");
        ref_coup.string("send_by");
        ref_coup.string("business_name");
        ref_coup.boolean("finished");
        ref_coup.string("discount");
        ref_coup.string("point");
        //one to one relationship with business coupons
        ref_coup.integer("business_coupon_id").unsigned().unique();
        ref_coup
          .foreign("business_coupon_id")
          .references("business_coupons.id");
        //one to many relationship with accounts who generate the coupons
        ref_coup.integer("account_generate_id").unsigned();
        ref_coup.foreign("account_generate_id").references("accounts.id");
      });
    })
    .then(() => {
      return knex.schema.createTable("users_referals", (referals) => {
        referals.increments("id").primary();
        //one to many relationship with accounts
        referals.integer("account_id_received").unsigned();
        referals.foreign("account_id_received").references("accounts.id");
        //one to many relationship with referals_coupons
        referals.integer("referal_coupon_id").unsigned();
        referals.foreign("referal_coupon_id").references("referal_coupons.id");
      });
    });
};

exports.down = function (knex, Promise) {
  return knex.schema
    .dropTable("users_referals")
    .then(() => knex.schema.dropTable("referal_coupons"))
    .then(() => knex.schema.dropTable("business_coupons"))
    .then(() => knex.schema.dropTable("users_recommendations"))
    .then(() => knex.schema.dropTable("accounts_businesses"))
    .then(() => knex.schema.dropTable("liked_businesses"))
    .then(() => knex.schema.dropTable("accounts_users"))
    .then(() => knex.schema.dropTable("accounts"));
};
