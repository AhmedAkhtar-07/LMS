// db.js — creates a MySQL connection pool and exports it
// All route files import this to run queries

const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

// Export the promise-based version so we can use async/await in routes
module.exports = pool.promise();
