// routes/auth.js
// POST /auth/register → create new user
// POST /auth/login    → verify credentials, return JWT token
// GET  /auth/me       → decode token and return user info (token sent in header)

const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../db');

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'lms_jwt_secret_2026';

// ── REGISTER ──────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
        return res.status(400).json({ message: 'All fields are required.' });
    }
    if (role !== 'student' && role !== 'instructor') {
        return res.status(400).json({ message: 'Role must be student or instructor.' });
    }

    try {
        const [existing] = await db.query('SELECT user_id FROM Users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({ message: 'Email already registered.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query(
            'INSERT INTO Users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, role]
        );

        res.status(201).json({ message: 'Registration successful. Please login.' });

    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

// ── LOGIN ─────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        const [rows] = await db.query('SELECT * FROM Users WHERE email = ?', [email]);
        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const user  = rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        // Create JWT — expires in 2 hours
        // Payload stores just enough info so routes don't need extra DB lookups
        const token = jwt.sign(
            { user_id: user.user_id, name: user.name, role: user.role },
            SECRET,
            { expiresIn: '2h' }
        );

        res.json({ token, role: user.role, name: user.name });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

// ── ME — return current user from token ───────────────────────────────────────
// Frontend pages call this on load to verify the token is still valid
router.get('/me', (req, res) => {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Not logged in.' });
    }

    const token = header.split(' ')[1];

    try {
        const user = jwt.verify(token, SECRET);
        // Return only what the frontend needs
        res.json({ user_id: user.user_id, name: user.name, role: user.role });
    } catch (err) {
        res.status(401).json({ message: 'Session expired. Please login again.' });
    }
});

module.exports = router;
