
exports.up = knex =>
    knex.schema.createTable("accounts", tbl => {
        tbl.increments();

    });

exports.down = knex => knex.schema.dropTableIfExists("accounts");
