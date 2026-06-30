require('dotenv').config();
const express = require('express');
const path = require('path');
const pool = require('./db');
const { registerUser, loginUser } = require('./auth');
const authenticateToken = require('./middleware');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

function encodeBase62(num) {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  while (num > 0) {
    result = chars[num % 62] + result;
    num = Math.floor(num / 62);
  }
  return result || '0';
}

app.post('/api/shorten', authenticateToken, async (req, res) => {
  const { originalUrl } = req.body;

  if (!originalUrl) {
    return res.status(400).json({ error: 'Please provide a URL' });
  }

  try {
    const insertQuery = `
      INSERT INTO urls (original_url, short_code, user_id)
      VALUES ($1, 'temp', $2)
      RETURNING id;
    `;
    const insertResult = await pool.query(insertQuery, [originalUrl, req.userId]);
    const newId = insertResult.rows[0].id;

    const shortCode = encodeBase62(newId);

    await pool.query(
      'UPDATE urls SET short_code = $1 WHERE id = $2',
      [shortCode, newId]
    );

    res.json({ shortUrl: `http://localhost:${PORT}/${shortCode}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

app.get('/:code', async (req, res) => {
  const { code } = req.params;

  try {
    const result = await pool.query(
      'SELECT original_url FROM urls WHERE short_code = $1',
      [code]
    );

    if (result.rows.length === 0) {
      return res.status(404).send('Short URL not found');
    }

    res.redirect(result.rows[0].original_url);
  } catch (error) {
    console.error(error);
    res.status(500).send('Something went wrong');
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const user = await registerUser(email, password);
    res.json({ message: 'User registered successfully', user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const token = await loginUser(email, password);
    res.json({ token });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});