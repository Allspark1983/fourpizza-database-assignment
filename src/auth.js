const express = require('express');
const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');

const deriveKey = promisify(scrypt);
const hashOptions = { N: 32768, r: 8, p: 2, maxmem: 64 * 1024 * 1024 };
const issuer = 'four-pizza-menu';

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function validCredentials(email, password) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    && typeof password === 'string' && password.length >= 8 && password.length <= 128;
}

function publicUser(user) {
  return { email: user.email, role: user.role };
}

function createAuth(users, secret) {
  const router = express.Router();

  router.post('/register', async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    if (!validCredentials(email, password)) {
      return res.status(400).json({ error: 'Enter a valid email and a password of 8 to 128 characters.' });
    }
    const salt = randomBytes(16).toString('hex');
    const hash = await deriveKey(password, salt, 64, hashOptions);
    // Only the shop operator can promote an existing account to staff via the CLI.
    const user = { email, role: 'customer', salt, passwordHash: hash.toString('hex') };
    try {
      await users.insertOne(user);
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ error: 'This email is already registered.' });
      }
      throw error;
    }
    return res.status(201).json({ user: publicUser(user) });
  });

  router.post('/login', async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    const denied = () => res.status(401).json({ error: 'Email or password is incorrect.' });
    if (!validCredentials(email, password)) return denied();
    const user = await users.findOne({ email });
    // Spend the same hashing work even for an unknown email.
    const candidate = await deriveKey(password, user?.salt ?? 'unregistered', 64, hashOptions);
    const expected = user ? Buffer.from(user.passwordHash, 'hex') : Buffer.alloc(64);
    if (!timingSafeEqual(candidate, expected) || !user) return denied();
    const token = jwt.sign({}, secret, {
      subject: user._id.toHexString(), algorithm: 'HS256', expiresIn: '1h', issuer
    });
    return res.json({ token, user: publicUser(user) });
  });

  async function requireStaff(req, res, next) {
    const bearer = /^Bearer ([^\s]+)$/i.exec(req.get('authorization') || '');
    if (!bearer) return res.status(401).json({ error: 'Please sign in.' });
    let claims;
    try {
      claims = jwt.verify(bearer[1], secret, { algorithms: ['HS256'], issuer });
      if (!ObjectId.isValid(claims.sub)) throw new Error('Invalid subject.');
    } catch {
      return res.status(401).json({ error: 'Your sign-in has expired or is invalid.' });
    }
    // Read the current role so a removed or demoted staff account loses access immediately.
    const user = await users.findOne({ _id: new ObjectId(claims.sub) }, { projection: { role: 1 } });
    if (!user) return res.status(401).json({ error: 'This account no longer exists.' });
    if (user.role !== 'staff') return res.status(403).json({ error: 'Staff access is required.' });
    return next();
  }

  return { router, requireStaff };
}

module.exports = { createAuth, normalizeEmail };
