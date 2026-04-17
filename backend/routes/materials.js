// routes/materials.js
// DELETE /materials/:material_id → delete a single material (instructor only)

const express                           = require('express');
const db                                = require('../db');
const { instructorOnly }                = require('../middleware/auth');

const router = express.Router();

// ── DELETE MATERIAL ────────────────────────────────────────────────────────────
router.delete('/:material_id', instructorOnly, async (req, res) => {
    const { material_id } = req.params;
    const instructor_id   = req.user.user_id;

    try {
        const [rows] = await db.query(
            `SELECT mat.material_id FROM Materials mat
             JOIN Modules m ON m.module_id  = mat.module_id
             JOIN Courses c ON c.course_id  = m.course_id
             WHERE mat.material_id = ? AND c.instructor_id = ?`,
            [material_id, instructor_id]
        );

        if (rows.length === 0) {
            return res.status(403).json({ message: 'Material not found or access denied.' });
        }

        await db.query('DELETE FROM Materials WHERE material_id = ?', [material_id]);
        res.json({ message: 'Material deleted.' });

    } catch (err) {
        console.error('Delete material error:', err);
        res.status(500).json({ message: 'Server error while deleting material.' });
    }
});

module.exports = router;
