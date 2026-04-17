// routes/dashboard.js
// GET /dashboard/student    → stats + per-course progress + recent quiz attempts
// GET /dashboard/instructor → stats + per-course analytics (enrolled count, avg score, pass rate)
//
// Progress formula (student):
//   Per course:  (distinct quizzes attempted in that course / total quizzes in course) × 100
//   Overall:     (sum of attempted across all courses / sum of total across all courses) × 100
//   Score shown: best attempt per quiz (not latest), then averaged across quizzes in a course.
//
// Schema note:
//   - No material-view tracking exists, so progress is quiz-based only.
//   - Multiple attempts are allowed; we use MAX(score) per quiz for fairness.
//   - If a course has zero quizzes, progress shows 0% (no quizzes = nothing to complete).

const express      = require('express');
const db           = require('../db');
const { loginRequired } = require('../middleware/auth');

const router = express.Router();

// ── STUDENT DASHBOARD DATA ────────────────────────────────────────────────────
router.get('/student', loginRequired, async (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ message: 'Students only.' });
    }

    const student_id = req.user.user_id;

    try {
        // Per-course: total quizzes, attempted quizzes, avg of best scores
        const [courses] = await db.query(`
            SELECT
                c.course_id,
                c.title,
                u.name                                  AS instructor_name,

                /* How many quizzes exist in this course */
                (SELECT COUNT(*)
                 FROM   Modules m
                 JOIN   Quizzes q ON q.module_id = m.module_id
                 WHERE  m.course_id = c.course_id)      AS total_quizzes,

                /* How many of those quizzes this student has attempted at least once */
                (SELECT COUNT(DISTINCT qa.quiz_id)
                 FROM   QuizAttempts qa
                 JOIN   Quizzes      q  ON q.quiz_id   = qa.quiz_id
                 JOIN   Modules      m  ON m.module_id = q.module_id
                 WHERE  m.course_id = c.course_id
                   AND  qa.student_id = ?)               AS attempted_quizzes,

                /* Average of best score per quiz in this course */
                (SELECT ROUND(AVG(bs.best), 1)
                 FROM  (SELECT MAX(qa.score) AS best
                        FROM   QuizAttempts qa
                        JOIN   Quizzes      q  ON q.quiz_id   = qa.quiz_id
                        JOIN   Modules      m  ON m.module_id = q.module_id
                        WHERE  m.course_id = c.course_id
                          AND  qa.student_id = ?
                        GROUP BY qa.quiz_id) bs)         AS course_avg_score,

                /* How many quizzes student has PASSED (best score >= passing_score) */
                (SELECT COUNT(*)
                 FROM  (SELECT MAX(qa.score) AS best_score, q.passing_score
                        FROM   QuizAttempts qa
                        JOIN   Quizzes      q  ON q.quiz_id   = qa.quiz_id
                        JOIN   Modules      m  ON m.module_id = q.module_id
                        WHERE  m.course_id = c.course_id AND qa.student_id = ?
                        GROUP BY qa.quiz_id, q.passing_score
                        HAVING MAX(qa.score) >= q.passing_score) AS pq) AS passed_quizzes,

                /* Certificate ID if already issued for this course */
                (SELECT cert.certificate_id
                 FROM   Certificates cert
                 WHERE  cert.student_id = ? AND cert.course_id = c.course_id
                 LIMIT  1)                               AS certificate_id

            FROM  Enrollments e
            JOIN  Courses c ON c.course_id = e.course_id
            JOIN  Users   u ON u.user_id   = c.instructor_id
            WHERE e.student_id = ?
            ORDER BY e.enroll_date DESC
        `, [student_id, student_id, student_id, student_id, student_id]);

        // Compute progress % and certificate eligibility per course
        courses.forEach(c => {
            c.progress_pct = c.total_quizzes > 0
                ? Math.round((c.attempted_quizzes / c.total_quizzes) * 100)
                : 0;
            // Eligible = has quizzes AND passed all of them
            c.eligible = c.total_quizzes > 0 && c.passed_quizzes >= c.total_quizzes;
        });

        // Overall summary
        const totalQuizzes     = courses.reduce((s, c) => s + c.total_quizzes,     0);
        const attemptedQuizzes = courses.reduce((s, c) => s + c.attempted_quizzes, 0);
        const overallProgress  = totalQuizzes > 0
            ? Math.round((attemptedQuizzes / totalQuizzes) * 100)
            : 0;

        // Overall avg score across all attempted quizzes (best per quiz)
        const [avgRow] = await db.query(`
            SELECT ROUND(AVG(best_score), 1) AS overall_avg
            FROM (
                SELECT MAX(score) AS best_score
                FROM   QuizAttempts
                WHERE  student_id = ?
                GROUP BY quiz_id
            ) best
        `, [student_id]);

        // Last 5 quiz attempts (for "Recent Activity")
        const [recent] = await db.query(`
            SELECT
                q.title          AS quiz_title,
                c.title          AS course_title,
                qa.score,
                q.passing_score,
                (qa.score >= q.passing_score) AS passed,
                qa.attempt_date
            FROM   QuizAttempts qa
            JOIN   Quizzes q  ON q.quiz_id   = qa.quiz_id
            JOIN   Modules m  ON m.module_id  = q.module_id
            JOIN   Courses c  ON c.course_id  = m.course_id
            WHERE  qa.student_id = ?
            ORDER BY qa.attempt_date DESC
            LIMIT  5
        `, [student_id]);

        res.json({
            summary: {
                total_courses:     courses.length,
                overall_progress:  overallProgress,
                overall_avg_score: avgRow[0]?.overall_avg ?? null,
                total_quizzes:     totalQuizzes,
                attempted_quizzes: attemptedQuizzes
            },
            courses,
            recent_attempts: recent
        });

    } catch (err) {
        console.error('Student dashboard error:', err);
        res.status(500).json({ message: 'Server error loading dashboard.' });
    }
});

// ── INSTRUCTOR DASHBOARD DATA ─────────────────────────────────────────────────
router.get('/instructor', loginRequired, async (req, res) => {
    if (req.user.role !== 'instructor') {
        return res.status(403).json({ message: 'Instructors only.' });
    }

    const instructor_id = req.user.user_id;

    try {
        // Per-course analytics
        const [courses] = await db.query(`
            SELECT
                c.course_id,
                c.title,
                c.join_code,

                /* How many students enrolled */
                (SELECT COUNT(*)
                 FROM   Enrollments e
                 WHERE  e.course_id = c.course_id)       AS enrolled_count,

                /* How many quizzes in this course */
                (SELECT COUNT(*)
                 FROM   Modules m
                 JOIN   Quizzes q ON q.module_id = m.module_id
                 WHERE  m.course_id = c.course_id)       AS quiz_count,

                /* Average score across ALL attempts in this course */
                (SELECT ROUND(AVG(qa.score), 1)
                 FROM   QuizAttempts qa
                 JOIN   Quizzes      q  ON q.quiz_id   = qa.quiz_id
                 JOIN   Modules      m  ON m.module_id = q.module_id
                 WHERE  m.course_id = c.course_id)       AS avg_score,

                /* Pass rate = attempts that passed / total attempts × 100 */
                (SELECT ROUND(
                     SUM(CASE WHEN qa.score >= q.passing_score THEN 1 ELSE 0 END)
                     / NULLIF(COUNT(qa.attempt_id), 0) * 100, 0)
                 FROM   QuizAttempts qa
                 JOIN   Quizzes      q  ON q.quiz_id   = qa.quiz_id
                 JOIN   Modules      m  ON m.module_id = q.module_id
                 WHERE  m.course_id = c.course_id)       AS pass_rate

            FROM  Courses c
            WHERE c.instructor_id = ?
            ORDER BY c.course_id DESC
        `, [instructor_id]);

        const totalStudents = courses.reduce((s, c) => s + c.enrolled_count, 0);
        const totalQuizzes  = courses.reduce((s, c) => s + c.quiz_count,     0);

        res.json({
            summary: {
                total_courses:  courses.length,
                total_students: totalStudents,
                total_quizzes:  totalQuizzes
            },
            courses
        });

    } catch (err) {
        console.error('Instructor dashboard error:', err);
        res.status(500).json({ message: 'Server error loading dashboard.' });
    }
});

module.exports = router;
