// middleware/auth.js — shared JWT auth middleware used by all routes
// Reads the token from the Authorization header: "Bearer <token>"
// Attaches decoded user info to req.user if valid

const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'lms_jwt_secret_2026';

// ── Any logged-in user (student or instructor) ────────────────────────────────
function loginRequired(req, res, next) {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Not logged in.' });
    }

    const token = header.split(' ')[1];

    try {
        // Verify token and attach decoded payload { user_id, name, role } to req.user
        req.user = jwt.verify(token, SECRET);
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Session expired. Please login again.' });
    }
}

// ── Instructor only ───────────────────────────────────────────────────────────
function instructorOnly(req, res, next) {
    loginRequired(req, res, () => {
        if (req.user.role !== 'instructor') {
            return res.status(403).json({ message: 'Access denied. Instructors only.' });
        }
        next();
    });
}

module.exports = { loginRequired, instructorOnly };
