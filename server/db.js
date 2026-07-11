// ============================================
// MariaDB 连接池
// ============================================
const mariadb = require('mariadb');

const pool = mariadb.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  connectionLimit: 5,
  charset: 'utf8mb4',
  acquireTimeout: 20000
});

module.exports = pool;
