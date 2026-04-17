// routes/courses.js
// POST /courses            → create course (instructor only)
// GET  /courses/my         → get instructor's own courses
// GET  /courses/:course_id → get single course (any logged-in user)

const express                        = require('express');
const db                             = require('../db');
const { loginRequired, instructorOnly } = require('../middleware/auth');

const router = express.Router();

// ── Generate a unique 6-char alphanumeric join code ───────────────────────────
function generateJoinCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/1/I to avoid confusion
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

// ── CREATE COURSE ─────────────────────────────────────────────────────────────
router.post('/', instructorOnly, async (req, res) => {
    const { title, description } = req.body;
    const instructor_id          = req.user.user_id;

    if (!title || !title.trim()) {
        return res.status(400).json({ message: 'Course title is required.' });
    }

    try {
        // Generate a unique join code (retry on collision)
        let join_code, attempts = 0;
        while (attempts < 10) {
            const candidate = generateJoinCode();
            const [existing] = await db.query(
                'SELECT course_id FROM Courses WHERE join_code = ?', [candidate]
            );
            if (existing.length === 0) { join_code = candidate; break; }
            attempts++;
        }
        if (!join_code) {
            return res.status(500).json({ message: 'Could not generate a unique code. Try again.' });
        }

        const [result] = await db.query(
            'INSERT INTO Courses (title, description, instructor_id, join_code) VALUES (?, ?, ?, ?)',
            [title.trim(), description ? description.trim() : '', instructor_id, join_code]
        );

        res.status(201).json({
            message:   'Course created successfully.',
            course_id: result.insertId,
            join_code
        });

    } catch (err) {
        console.error('Create course error:', err);
        res.status(500).json({ message: 'Server error while creating course.' });
    }
});

// ── GET ALL COURSES — for students to browse ──────────────────────────────────
router.get('/all', loginRequired, async (req, res) => {
    try {
        const [courses] = await db.query(
            `SELECT c.course_id, c.title, c.description, u.name AS instructor_name
             FROM Courses c
             JOIN Users u ON c.instructor_id = u.user_id
             ORDER BY c.course_id DESC`
        );
        res.json(courses);
    } catch (err) {
        console.error('Fetch all courses error:', err);
        res.status(500).json({ message: 'Server error while fetching courses.' });
    }
});

// ── GET MY COURSES ────────────────────────────────────────────────────────────
router.get('/my', instructorOnly, async (req, res) => {
    const instructor_id = req.user.user_id;

    try {
        const [courses] = await db.query(
            'SELECT course_id, title, description, join_code FROM Courses WHERE instructor_id = ? ORDER BY course_id DESC',
            [instructor_id]
        );

        // Auto-generate codes for any courses that don't have one yet
        for (const course of courses) {
            if (!course.join_code) {
                let join_code, attempts = 0;
                while (attempts < 10) {
                    const candidate = generateJoinCode();
                    const [exists] = await db.query(
                        'SELECT course_id FROM Courses WHERE join_code = ?', [candidate]
                    );
                    if (exists.length === 0) { join_code = candidate; break; }
                    attempts++;
                }
                if (join_code) {
                    await db.query('UPDATE Courses SET join_code = ? WHERE course_id = ?',
                        [join_code, course.course_id]);
                    course.join_code = join_code;
                }
            }
        }

        res.json(courses);

    } catch (err) {
        console.error('Fetch courses error:', err);
        res.status(500).json({ message: 'Server error while fetching courses.' });
    }
});

// ── GET SINGLE COURSE ─────────────────────────────────────────────────────────
router.get('/:course_id', loginRequired, async (req, res) => {
    const { course_id } = req.params;

    try {
        const [rows] = await db.query(
            'SELECT course_id, title, description, instructor_id, join_code FROM Courses WHERE course_id = ?',
            [course_id]
        );

        if (rows.length === 0) return res.status(404).json({ message: 'Course not found.' });

        const course = rows[0];

        // Auto-generate a join code if the course doesn't have one yet
        if (!course.join_code && req.user.role === 'instructor' &&
            req.user.user_id === course.instructor_id) {
            let join_code, attempts = 0;
            while (attempts < 10) {
                const candidate = generateJoinCode();
                const [exists] = await db.query(
                    'SELECT course_id FROM Courses WHERE join_code = ?', [candidate]
                );
                if (exists.length === 0) { join_code = candidate; break; }
                attempts++;
            }
            if (join_code) {
                await db.query('UPDATE Courses SET join_code = ? WHERE course_id = ?', [join_code, course_id]);
                course.join_code = join_code;
            }
        }

        res.json(course);

    } catch (err) {
        console.error('Fetch course error:', err);
        res.status(500).json({ message: 'Server error while fetching course.' });
    }
});

module.exports = router;
