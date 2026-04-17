// routes/modules.js
// POST   /modules                   → create module + optional materials (instructor only)
// GET    /modules/course/:course_id → get modules with materials (any logged-in user)
// DELETE /modules/:module_id        → delete module + cascade materials (instructor only)

const express                           = require('express');
const multer                            = require('multer');
const path                              = require('path');
const db                                = require('../db');
const { loginRequired, instructorOnly } = require('../middleware/auth');

const router = express.Router();

// ── Multer — save uploads to backend/uploads/ ─────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
    filename:    (req, file, cb) => {
        const unique = Date.now() + '-' + file.originalname.replace(/\s+/g, '_');
        cb(null, unique);
    }
});

const fileFilter = (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx'];
    const ext     = path.extname(file.originalname).toLowerCase();
    allowed.includes(ext) ? cb(null, true) : cb(new Error('Only PDF, DOC, DOCX files are allowed.'));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

// ── CREATE MODULE + OPTIONAL MATERIALS ────────────────────────────────────────
router.post('/', instructorOnly, upload.single('pdf_file'), async (req, res) => {
    const { course_id, title, module_order, video_url, announcement } = req.body;
    const instructor_id = req.user.user_id;

    if (!course_id || !title || !title.trim()) {
        return res.status(400).json({ message: 'Course and module title are required.' });
    }

    const order = parseInt(module_order);
    if (!module_order || isNaN(order) || order < 1) {
        return res.status(400).json({ message: 'Module order must be a positive number.' });
    }

    if (video_url && video_url.trim()) {
        try { new URL(video_url.trim()); }
        catch { return res.status(400).json({ message: 'Please enter a valid video URL.' }); }
    }

    try {
        // Verify course belongs to this instructor
        const [courseRows] = await db.query(
            'SELECT course_id FROM Courses WHERE course_id = ? AND instructor_id = ?',
            [course_id, instructor_id]
        );
        if (courseRows.length === 0) {
            return res.status(403).json({ message: 'Course not found or access denied.' });
        }

        const [existing] = await db.query(
            'SELECT module_id FROM Modules WHERE course_id = ? AND module_order = ?',
            [course_id, order]
        );

        // Insert module
        const [moduleResult] = await db.query(
            'INSERT INTO Modules (course_id, title, module_order) VALUES (?, ?, ?)',
            [course_id, title.trim(), order]
        );
        const module_id = moduleResult.insertId;

        // Insert optional materials
        if (req.file) {
            await db.query(
                'INSERT INTO Materials (module_id, title, type, file_url) VALUES (?, ?, ?, ?)',
                [module_id, req.file.originalname, 'pdf', '/uploads/' + req.file.filename]
            );
        }
        if (video_url && video_url.trim()) {
            await db.query(
                'INSERT INTO Materials (module_id, title, type, content) VALUES (?, ?, ?, ?)',
                [module_id, 'Video', 'video', video_url.trim()]
            );
        }
        if (announcement && announcement.trim()) {
            await db.query(
                'INSERT INTO Materials (module_id, title, type, content) VALUES (?, ?, ?, ?)',
                [module_id, 'Announcement', 'announcement', announcement.trim()]
            );
        }

        res.status(201).json({
            message:   existing.length > 0
                        ? 'Module created. Note: another module has the same order number.'
                        : 'Module created successfully.',
            module_id
        });

    } catch (err) {
        console.error('Create module error:', err);
        res.status(500).json({ message: 'Server error while creating module.' });
    }
});

// ── GET MODULES WITH MATERIALS ────────────────────────────────────────────────
router.get('/course/:course_id', loginRequired, async (req, res) => {
    const { course_id } = req.params;

    try {
        const [rows] = await db.query(
            `SELECT m.module_id, m.title AS module_title, m.module_order,
                    mat.material_id, mat.title AS material_title,
                    mat.type, mat.content, mat.file_url,
                    q.quiz_id, q.title AS quiz_title, q.passing_score
             FROM Modules m
             LEFT JOIN Materials mat ON mat.module_id = m.module_id
             LEFT JOIN Quizzes   q   ON q.module_id   = m.module_id
             WHERE m.course_id = ?
             ORDER BY m.module_order ASC, m.module_id ASC, mat.material_id ASC`,
            [course_id]
        );

        // Group materials under their parent module, include quiz info
        const modulesMap = {};
        for (const row of rows) {
            if (!modulesMap[row.module_id]) {
                modulesMap[row.module_id] = {
                    module_id:    row.module_id,
                    title:        row.module_title,
                    module_order: row.module_order,
                    materials:    [],
                    // quiz is null if module has no quiz
                    quiz: row.quiz_id
                        ? { quiz_id: row.quiz_id, title: row.quiz_title, passing_score: row.passing_score }
                        : null
                };
            }
            if (row.material_id) {
                modulesMap[row.module_id].materials.push({
                    material_id: row.material_id, title: row.material_title,
                    type: row.type, content: row.content, file_url: row.file_url
                });
            }
        }

        res.json(Object.values(modulesMap));

    } catch (err) {
        console.error('Fetch modules error:', err);
        res.status(500).json({ message: 'Server error while fetching modules.' });
    }
});

// ── DELETE MODULE ─────────────────────────────────────────────────────────────
router.delete('/:module_id', instructorOnly, async (req, res) => {
    const { module_id } = req.params;
    const instructor_id = req.user.user_id;

    try {
        const [rows] = await db.query(
            `SELECT m.module_id FROM Modules m
             JOIN Courses c ON c.course_id = m.course_id
             WHERE m.module_id = ? AND c.instructor_id = ?`,
            [module_id, instructor_id]
        );

        if (rows.length === 0) {
            return res.status(403).json({ message: 'Module not found or access denied.' });
        }

        await db.query('DELETE FROM Modules WHERE module_id = ?', [module_id]);
        res.json({ message: 'Module deleted.' });

    } catch (err) {
        console.error('Delete module error:', err);
        res.status(500).json({ message: 'Server error while deleting module.' });
    }
});

module.exports = router;
