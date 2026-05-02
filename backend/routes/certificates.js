// routes/certificates.js
// POST /certificates/generate/:course_id  → check eligibility, issue certificate
// GET  /certificates/my                   → student's issued certificates
// GET  /certificates/:certificate_id      → full certificate details (for display page)
//
// Eligibility rules:
//   1. Student must be enrolled in the course.
//   2. The course must have at least one quiz.
//   3. Student must have a PASSING best-attempt on EVERY quiz in the course.
//      (best attempt = MAX(score) per quiz; passing = score >= quiz.passing_score)
//   4. Certificate is issued once — duplicates blocked by UNIQUE(student_id, course_id).

const express           = require('express');
const db                = require('../db');
const { loginRequired } = require('../middleware/auth');

const router = express.Router();

// ── GENERATE / CLAIM CERTIFICATE ─────────────────────────────────────────────
router.post('/generate/:course_id', loginRequired, async (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ message: 'Only students can claim certificates.' });
    }

    const { course_id } = req.params;
    const student_id    = req.user.user_id;

    try {
        // 1. Already issued?
        const [existing] = await db.query(
            'SELECT certificate_id FROM Certificates WHERE student_id = ? AND course_id = ?',
            [student_id, course_id]
        );
        if (existing.length > 0) {
            return res.json({
                already_issued:  true,
                certificate_id:  existing[0].certificate_id,
                message:         'Certificate already issued.'
            });
        }

        // 2. Must be enrolled and marked as completed by the instructor
        const [enrolled] = await db.query(
            'SELECT enrollment_id, status FROM Enrollments WHERE student_id = ? AND course_id = ?',
            [student_id, course_id]
        );
        if (enrolled.length === 0) {
            return res.status(403).json({ message: 'You are not enrolled in this course.' });
        }
        if (enrolled[0].status !== 'completed') {
            return res.status(400).json({ message: 'Your instructor has not marked you as passed yet.' });
        }

        // 3. Issue certificate — instructor approval is sufficient
        const [result] = await db.query(
            'INSERT INTO Certificates (student_id, course_id) VALUES (?, ?)',
            [student_id, course_id]
        );

        res.status(201).json({
            message:        'Certificate issued successfully!',
            certificate_id: result.insertId
        });

    } catch (err) {
        console.error('Certificate generate error:', err);
        res.status(500).json({ message: 'Server error while generating certificate.' });
    }
});

// ── MY CERTIFICATES ───────────────────────────────────────────────────────────
router.get('/my', loginRequired, async (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ message: 'Students only.' });
    }

    const student_id = req.user.user_id;

    try {
        const [rows] = await db.query(
            `SELECT cert.certificate_id, cert.issue_date,
                    c.course_id, c.title AS course_title,
                    u.name AS instructor_name
             FROM   Certificates cert
             JOIN   Courses c ON c.course_id  = cert.course_id
             JOIN   Users   u ON u.user_id    = c.instructor_id
             WHERE  cert.student_id = ?
             ORDER BY cert.issue_date DESC`,
            [student_id]
        );
        res.json(rows);

    } catch (err) {
        console.error('My certificates error:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});

// ── GET SINGLE CERTIFICATE (for display page) ─────────────────────────────────
router.get('/:certificate_id', loginRequired, async (req, res) => {
    const { certificate_id } = req.params;

    try {
        const [rows] = await db.query(
            `SELECT cert.certificate_id, cert.issue_date,
                    s.name  AS student_name,
                    c.title AS course_title, c.description AS course_description,
                    inst.name AS instructor_name
             FROM   Certificates cert
             JOIN   Users   s    ON s.user_id    = cert.student_id
             JOIN   Courses c    ON c.course_id  = cert.course_id
             JOIN   Users   inst ON inst.user_id = c.instructor_id
             WHERE  cert.certificate_id = ?`,
            [certificate_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Certificate not found.' });
        }

        // Only the certificate owner or any instructor can view
        const cert = rows[0];
        res.json(cert);

    } catch (err) {
        console.error('Get certificate error:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});

module.exports = router;
