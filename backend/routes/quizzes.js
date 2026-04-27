// routes/quizzes.js
// POST   /quizzes                        → create quiz for a module (instructor only)
// GET    /quizzes/module/:module_id      → get quiz + questions for a module (any logged-in user)
// POST   /quizzes/:quiz_id/questions     → add MCQ question to quiz (instructor only)
// POST   /quizzes/:quiz_id/attempt       → student submits answers, backend grades and saves score
// DELETE /quizzes/:quiz_id               → delete quiz + all its questions (instructor only)
// DELETE /quizzes/questions/:question_id → delete a single question (instructor only)

const express                           = require('express');
const db                                = require('../db');
const { loginRequired, instructorOnly } = require('../middleware/auth');

const router = express.Router();

// ── CREATE QUIZ ───────────────────────────────────────────────────────────────
router.post('/', instructorOnly, async (req, res) => {
    const { module_id, title, passing_score } = req.body;
    const instructor_id = req.user.user_id;

    if (!module_id || !title || !title.trim()) {
        return res.status(400).json({ message: 'Module and quiz title are required.' });
    }

    // passing_score defaults to 50 if not provided
    const score = passing_score ? parseFloat(passing_score) : 50;
    if (isNaN(score) || score < 0 || score > 100) {
        return res.status(400).json({ message: 'Passing score must be between 0 and 100.' });
    }

    try {
        // Verify the module belongs to a course owned by this instructor
        const [rows] = await db.query(
            `SELECT m.module_id FROM Modules m
             JOIN Courses c ON c.course_id = m.course_id
             WHERE m.module_id = ? AND c.instructor_id = ?`,
            [module_id, instructor_id]
        );
        if (rows.length === 0) {
            return res.status(403).json({ message: 'Module not found or access denied.' });
        }

        // Each module can only have one quiz
        const [existing] = await db.query(
            'SELECT quiz_id FROM Quizzes WHERE module_id = ?', [module_id]
        );
        if (existing.length > 0) {
            return res.status(409).json({ message: 'This module already has a quiz.' });
        }

        const [result] = await db.query(
            'INSERT INTO Quizzes (module_id, title, passing_score) VALUES (?, ?, ?)',
            [module_id, title.trim(), score]
        );

        res.status(201).json({ message: 'Quiz created successfully.', quiz_id: result.insertId });

    } catch (err) {
        console.error('Create quiz error:', err);
        res.status(500).json({ message: 'Server error while creating quiz.' });
    }
});

// ── GET QUIZ + QUESTIONS FOR A MODULE ─────────────────────────────────────────
// Returns null if no quiz exists for the module
// For students: correct_option is hidden (omitted from response)
router.get('/module/:module_id', loginRequired, async (req, res) => {
    const { module_id } = req.params;
    const role          = req.user.role;

    try {
        const [quizRows] = await db.query(
            'SELECT quiz_id, title, passing_score FROM Quizzes WHERE module_id = ?',
            [module_id]
        );

        if (quizRows.length === 0) return res.json(null); // no quiz for this module

        const quiz = quizRows[0];

        const [rows] = await db.query(
            `SELECT q.question_id, q.question_text,
                    ${role === 'instructor' ? 'q.correct_option,' : ''}
                    o.option_label, o.option_text
             FROM Questions q
             JOIN QuestionOptions o ON o.question_id = q.question_id
             WHERE q.quiz_id = ?
             ORDER BY q.question_id ASC, o.option_label ASC`,
            [quiz.quiz_id]
        );

        // Reshape joined rows into one object per question with option_a/b/c/d keys
        const questionsMap = {};
        for (const row of rows) {
            if (!questionsMap[row.question_id]) {
                questionsMap[row.question_id] = {
                    question_id:   row.question_id,
                    question_text: row.question_text,
                    ...(role === 'instructor' ? { correct_option: row.correct_option } : {})
                };
            }
            questionsMap[row.question_id][`option_${row.option_label.toLowerCase()}`] = row.option_text;
        }
        const questions = Object.values(questionsMap);

        res.json({ ...quiz, questions });

    } catch (err) {
        console.error('Fetch quiz error:', err);
        res.status(500).json({ message: 'Server error while fetching quiz.' });
    }
});

// ── ADD QUESTION TO QUIZ ──────────────────────────────────────────────────────
router.post('/:quiz_id/questions', instructorOnly, async (req, res) => {
    const { quiz_id }                                          = req.params;
    const { question_text, option_a, option_b, option_c, option_d, correct_option } = req.body;
    const instructor_id = req.user.user_id;

    // Validate required fields
    if (!question_text || !question_text.trim()) {
        return res.status(400).json({ message: 'Question text is required.' });
    }
    if (!option_a || !option_a.trim() || !option_b || !option_b.trim()) {
        return res.status(400).json({ message: 'Options A and B are required.' });
    }
    if (!correct_option || !['A','B','C','D'].includes(correct_option.toUpperCase())) {
        return res.status(400).json({ message: 'Correct option must be A, B, C, or D.' });
    }

    // If correct_option is C or D, ensure that option is actually filled in
    const co = correct_option.toUpperCase();
    if (co === 'C' && (!option_c || !option_c.trim())) {
        return res.status(400).json({ message: 'Option C is required when correct answer is C.' });
    }
    if (co === 'D' && (!option_d || !option_d.trim())) {
        return res.status(400).json({ message: 'Option D is required when correct answer is D.' });
    }

    try {
        // Verify quiz belongs to a course owned by this instructor
        const [rows] = await db.query(
            `SELECT q.quiz_id FROM Quizzes q
             JOIN Modules m  ON m.module_id   = q.module_id
             JOIN Courses c  ON c.course_id   = m.course_id
             WHERE q.quiz_id = ? AND c.instructor_id = ?`,
            [quiz_id, instructor_id]
        );
        if (rows.length === 0) {
            return res.status(403).json({ message: 'Quiz not found or access denied.' });
        }

        const [result] = await db.query(
            `INSERT INTO Questions (quiz_id, question_text, correct_option) VALUES (?, ?, ?)`,
            [quiz_id, question_text.trim(), co]
        );

        const qid = result.insertId;

        // Insert each option as its own row in QuestionOptions
        const optionRows = [
            [qid, 'A', option_a.trim()],
            [qid, 'B', option_b.trim()],
            ...(option_c && option_c.trim() ? [[qid, 'C', option_c.trim()]] : []),
            ...(option_d && option_d.trim() ? [[qid, 'D', option_d.trim()]] : [])
        ];
        await db.query(
            `INSERT INTO QuestionOptions (question_id, option_label, option_text) VALUES ?`,
            [optionRows]
        );

        res.status(201).json({ message: 'Question added.', question_id: qid });

    } catch (err) {
        console.error('Add question error:', err);
        res.status(500).json({ message: 'Server error while adding question.' });
    }
});

// ── SUBMIT QUIZ ATTEMPT ───────────────────────────────────────────────────────
// Student sends: { answers: { "question_id": "A", ... } }
// Backend fetches correct answers, grades, saves score to QuizAttempts
router.post('/:quiz_id/attempt', loginRequired, async (req, res) => {
    const { quiz_id } = req.params;
    const { answers } = req.body;   // { "1": "A", "2": "C", ... }
    const student_id  = req.user.user_id;

    if (!answers || typeof answers !== 'object' || Object.keys(answers).length === 0) {
        return res.status(400).json({ message: 'Please answer at least one question.' });
    }

    try {
        // Fetch quiz to get passing_score
        const [quizRows] = await db.query(
            'SELECT quiz_id, passing_score FROM Quizzes WHERE quiz_id = ?', [quiz_id]
        );
        if (quizRows.length === 0) return res.status(404).json({ message: 'Quiz not found.' });

        const { passing_score } = quizRows[0];

        // Fetch all questions with correct answers for grading
        const [questions] = await db.query(
            'SELECT question_id, correct_option FROM Questions WHERE quiz_id = ?', [quiz_id]
        );
        if (questions.length === 0) {
            return res.status(400).json({ message: 'This quiz has no questions yet.' });
        }

        // Grade: count correct answers
        let correct = 0;
        for (const q of questions) {
            const submitted = answers[q.question_id];
            if (submitted && submitted.toUpperCase() === q.correct_option) {
                correct++;
            }
        }

        // Score as percentage
        const score = parseFloat(((correct / questions.length) * 100).toFixed(2));
        const passed = score >= passing_score;

        // Save attempt to QuizAttempts table
        await db.query(
            'INSERT INTO QuizAttempts (student_id, quiz_id, score) VALUES (?, ?, ?)',
            [student_id, quiz_id, score]
        );

        res.json({
            score,
            passing_score,
            passed,
            correct,
            total:   questions.length,
            message: passed
                ? `You passed! Score: ${score}%`
                : `You did not pass. Score: ${score}%. Required: ${passing_score}%`
        });

    } catch (err) {
        console.error('Quiz attempt error:', err);
        res.status(500).json({ message: 'Server error while grading quiz.' });
    }
});

// ── DELETE QUIZ ───────────────────────────────────────────────────────────────
// ON DELETE CASCADE removes all questions automatically
router.delete('/:quiz_id', instructorOnly, async (req, res) => {
    const { quiz_id }   = req.params;
    const instructor_id = req.user.user_id;

    try {
        const [rows] = await db.query(
            `SELECT q.quiz_id FROM Quizzes q
             JOIN Modules m ON m.module_id = q.module_id
             JOIN Courses c ON c.course_id = m.course_id
             WHERE q.quiz_id = ? AND c.instructor_id = ?`,
            [quiz_id, instructor_id]
        );
        if (rows.length === 0) {
            return res.status(403).json({ message: 'Quiz not found or access denied.' });
        }

        await db.query('DELETE FROM Quizzes WHERE quiz_id = ?', [quiz_id]);
        res.json({ message: 'Quiz deleted.' });

    } catch (err) {
        console.error('Delete quiz error:', err);
        res.status(500).json({ message: 'Server error while deleting quiz.' });
    }
});

// ── DELETE SINGLE QUESTION ────────────────────────────────────────────────────
router.delete('/questions/:question_id', instructorOnly, async (req, res) => {
    const { question_id } = req.params;
    const instructor_id   = req.user.user_id;

    try {
        const [rows] = await db.query(
            `SELECT qn.question_id FROM Questions qn
             JOIN Quizzes q  ON q.quiz_id     = qn.quiz_id
             JOIN Modules m  ON m.module_id   = q.module_id
             JOIN Courses c  ON c.course_id   = m.course_id
             WHERE qn.question_id = ? AND c.instructor_id = ?`,
            [question_id, instructor_id]
        );
        if (rows.length === 0) {
            return res.status(403).json({ message: 'Question not found or access denied.' });
        }

        await db.query('DELETE FROM Questions WHERE question_id = ?', [question_id]);
        res.json({ message: 'Question deleted.' });

    } catch (err) {
        console.error('Delete question error:', err);
        res.status(500).json({ message: 'Server error while deleting question.' });
    }
});

module.exports = router;
