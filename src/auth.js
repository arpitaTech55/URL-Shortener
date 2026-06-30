const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('./db');

async function registerUser(email, password) {
  const existingUser = await pool.query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );

  if (existingUser.rows.length > 0) {
    throw new Error('Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const result = await pool.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
    [email, passwordHash]
  );

  return result.rows[0];
}

async function loginUser(email, password) {
  const result = await pool.query(
    'SELECT id, email, password_hash FROM users WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    throw new Error('Invalid email or password');
  }

  const user = result.rows[0];
  const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);

  if (!isPasswordCorrect) {
    throw new Error('Invalid email or password');
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return token;
}

module.exports = { registerUser, loginUser };