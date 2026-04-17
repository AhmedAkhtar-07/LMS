// server.js — main entry point

const express = require('express');
const path    = require('path');
require('dotenv').config();

const authRoutes        = require('./routes/auth');
const courseRoutes      = require('./routes/courses');
const moduleRoutes      = require('./routes/modules');
const materialRoutes    = require('./routes/materials');
const quizRoutes        = require('./routes/quizzes');
const enrollmentRoutes  = require('./routes/enrollments');
const dashboardRoutes    = require('./routes/dashboard');
const certificateRoutes  = require('./routes/certificates');

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Serve uploaded files (PDFs etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/auth',        authRoutes);
app.use('/courses',     courseRoutes);
app.use('/modules',     moduleRoutes);
app.use('/materials',   materialRoutes);
app.use('/quizzes',     quizRoutes);
app.use('/enrollments', enrollmentRoutes);
app.use('/dashboard',    dashboardRoutes);
app.use('/certificates', certificateRoutes);

// Default → landing page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages/index.html'));
});

// ── Start ──────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`LMS running at http://localhost:${PORT}`));
