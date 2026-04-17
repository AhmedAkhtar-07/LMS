// routes/enrollments.js
// POST /enrollments                    → student enrolls in a course
// GET  /enrollments/my                 → student's enrolled courses
// GET  /enrollments/check/:course_id   → check if student is enrolled in a course
// GET  /enrollments/course/:course_id  → instructor views enrolled students
// DELETE /enrollments/:enrollment_id   → student unenrolls

const express                           = require('express');
const db                                = require('../db');
const { loginRequired, instructorOnly } = require('../middleware/auth');

const router = express.Router();

// ── JOIN COURSE BY CODE ───────────────────────────────────────────────────────
router.post('/join', loginRequired, async (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ message: 'Only students can join courses.' });
    }

    const { code }   = req.body;
    const student_id = req.user.user_id;

    if (!code || !code.trim()) {
        return res.status(400).json({ message: 'Please enter a course code.' });
    }

    try {
        // Find course by join code (case-insensitive)
        const [courses] = await db.query(
            'SELECT course_id, title FROM Courses WHERE UPPER(join_code) = UPPER(?)',
            [code.trim()]
        );
        if (courses.length === 0) {
            return res.status(404).json({ message: 'Invalid course code. Please check and try again.' });
        }

        const course = courses[0];

        // Check already enrolled
        const [existing] = await db.query(
            'SELECT enrollment_id FROM Enrollments WHERE student_id = ? AND course_id = ?',
            [student_id, course.course_id]
        );
        if (existing.length > 0) {
            return res.status(409).json({ message: `You are already enrolled in "${course.title}".` });
        }

        const [result] = await db.query(
            'INSERT INTO Enrollments (student_id, course_id, status) VALUES (?, ?, ?)',
            [student_id, course.course_id, 'active']
        );

        res.status(201).json({
            message:       `Successfully joined "${course.title}"!`,
            enrollment_id: result.insertId,
            course_id:     course.course_id,
            course_title:  course.title
        });

    } catch (err) {
        console.error('Join course error:', err);
        res.status(500).json({ message: 'Server error while joining course.' });
    }
});

// ── ENROLL IN COURSE ──────────────────────────────────────────────────────────
router.post('/', loginRequired, async (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ message: 'Only students can enroll.' });
    }

    const { course_id } = req.body;
    const student_id    = req.user.user_id;

    if (!course_id) return res.status(400).json({ message: 'course_id is required.' });

    try {
        // Check if already enrolled
        const [existing] = await db.query(
            'SELECT enrollment_id FROM Enrollments WHERE student_id = ? AND course_id = ?',
            [student_id, course_id]
        );
        if (existing.length > 0) {
            return res.status(409).json({ message: 'You are already enrolled in this course.' });
        }

        // Verify course exists
        const [courses] = await db.query(
            'SELECT course_id FROM Courses WHERE course_id = ?', [course_id]
        );
        if (courses.length === 0) {
            return res.status(404).json({ message: 'Course not found.' });
        }

        const [result] = await db.query(
            'INSERT INTO Enrollments (student_id, course_id, status) VALUES (?, ?, ?)',
            [student_id, course_id, 'active']
        );

        res.status(201).json({ message: 'Enrolled successfully.', enrollment_id: result.insertId });

    } catch (err) {
        console.error('Enroll error:', err);
        res.status(500).json({ message: 'Server error while enrolling.' });
    }
});

// ── MY ENROLLED COURSES (student) ────────────────────────────────────────────
router.get('/my', loginRequired, async (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ message: 'Students only.' });
    }

    const student_id = req.user.user_id;

    try {
        const [rows] = await db.query(
            `SELECT e.enrollment_id, e.course_id, e.status, e.enroll_date,
                    c.title, c.description,
                    u.name AS instructor_name
             FROM Enrollments e
             JOIN Courses c ON c.course_id = e.course_id
             JOIN Users   u ON u.user_id   = c.instructor_id
             WHERE e.student_id = ?
             ORDER BY e.enroll_date DESC`,
            [student_id]
        );
        res.json(rows);

    } catch (err) {
        console.error('My enrollments error:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});

// ── CHECK ENROLLMENT STATUS FOR A COURSE ─────────────────────────────────────
router.get('/check/:course_id', loginRequired, async (req, res) => {
    const { course_id } = req.params;
    const student_id    = req.user.user_id;

    try {
        const [rows] = await db.query(
            'SELECT enrollment_id, status FROM Enrollments WHERE student_id = ? AND course_id = ?',
            [student_id, course_id]
        );
        res.json({
            enrolled: rows.length > 0,
            status:   rows[0]?.status || null,
            enrollment_id: rows[0]?.enrollment_id || null
        });

    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// ── VIEW ENROLLED STUDENTS FOR A COURSE (instructor) ─────────────────────────
router.get('/course/:course_id', loginRequired, async (req, res) => {
    const { course_id } = req.params;
    const user          = req.user;

    try {
        // Instructor must own the course; students can also check (for enrollment gating)
        if (user.role === 'instructor') {
            const [owned] = await db.query(
                'SELECT course_id FROM Courses WHERE course_id = ? AND instructor_id = ?',
                [course_id, user.user_id]
            );
            if (owned.length === 0) {
                return res.status(403).json({ message: 'Access denied.' });
            }
        }

        const [rows] = await db.query(
            `SELECT e.enrollment_id, e.status, e.enroll_date,
                    u.user_id, u.name, u.email
             FROM Enrollments e
             JOIN Users u ON u.user_id = e.student_id
             WHERE e.course_id = ?
             ORDER BY e.enroll_date DESC`,
            [course_id]
        );
        res.json(rows);

    } catch (err) {
        console.error('Course enrollments error:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});

// ── UNENROLL ──────────────────────────────────────────────────────────────────
router.delete('/:enrollment_id', loginRequired, async (req, res) => {
    const { enrollment_id } = req.params;
    const student_id        = req.user.user_id;

    try {
        const [rows] = await db.query(
            'SELECT enrollment_id FROM Enrollments WHERE enrollment_id = ? AND student_id = ?',
            [enrollment_id, student_id]
        );
        if (rows.length === 0) {
            return res.status(403).json({ message: 'Enrollment not found.' });
        }

        await db.query('DELETE FROM Enrollments WHERE enrollment_id = ?', [enrollment_id]);
        res.json({ message: 'Unenrolled successfully.' });

    } catch (err) {
        console.error('Unenroll error:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});

module.exports = router;
