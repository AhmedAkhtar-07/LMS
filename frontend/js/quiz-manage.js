// quiz-manage.js — instructor quiz creation and question management

const params   = new URLSearchParams(window.location.search);
const moduleId = params.get('module_id');
const courseId = params.get('course_id');
let   currentQuizId = null;

async function init() {
    if (!moduleId) { window.location.href = '/pages/login.html'; return; }

    const user = await requireAuth('instructor');
    if (!user) return;

    document.getElementById('backLink').href =
        `/pages/course-modules.html?course_id=${courseId}`;

    loadModuleAndQuiz();
}

// ── Load module title + check if quiz already exists ─────────────────────────
async function loadModuleAndQuiz() {
    // Get module title from course modules (reuse course endpoint)
    const res  = await apiGet(`/quizzes/module/${moduleId}`);
    const quiz = await res.json();

    // Also fetch course info to show module context (use course_id from URL)
    const cRes  = await apiGet(`/courses/${courseId}`);
    const cData = await cRes.json();
    if (cRes.ok) document.getElementById('moduleTitle').textContent = cData.title;

    if (quiz) {
        // Quiz already exists — show quiz section
        showQuizSection(quiz);
    } else {
        // No quiz yet — show create form
        document.getElementById('createQuizSection').style.display = 'block';
    }
}

function showQuizSection(quiz) {
    currentQuizId = quiz.quiz_id;
    document.getElementById('createQuizSection').style.display = 'none';
    document.getElementById('quizSection').style.display       = 'block';
    document.getElementById('quizTitle').textContent           = quiz.title;
    document.getElementById('passingScoreDisplay').textContent = quiz.passing_score;
    renderQuestions(quiz.questions || []);
}

// ── Render question list ──────────────────────────────────────────────────────
function renderQuestions(questions) {
    document.getElementById('questionCount').textContent = questions.length;
    const list = document.getElementById('questionList');

    if (questions.length === 0) {
        list.innerHTML = '<p class="empty-msg">No questions yet. Add one above.</p>';
        return;
    }

    list.innerHTML = questions.map((q, i) => `
        <div class="question-item" id="q-${q.question_id}">
            <div class="question-header">
                <span class="question-num">Q${i + 1}</span>
                <button class="btn-del-q" onclick="deleteQuestion(${q.question_id})">✕ Delete</button>
            </div>
            <div class="question-text">${escapeHtml(q.question_text)}</div>
            <ul class="options-list">
                <li class="${q.correct_option === 'A' ? 'correct' : ''}">A. ${escapeHtml(q.option_a)}</li>
                <li class="${q.correct_option === 'B' ? 'correct' : ''}">B. ${escapeHtml(q.option_b)}</li>
                ${q.option_c ? `<li class="${q.correct_option === 'C' ? 'correct' : ''}">C. ${escapeHtml(q.option_c)}</li>` : ''}
                ${q.option_d ? `<li class="${q.correct_option === 'D' ? 'correct' : ''}">D. ${escapeHtml(q.option_d)}</li>` : ''}
            </ul>
        </div>
    `).join('');
}

// ── Create Quiz form ──────────────────────────────────────────────────────────
document.getElementById('createQuizForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const title        = document.getElementById('quizTitle').value.trim();
    const passingScore = document.getElementById('passingScore').value;
    const msg          = document.getElementById('createMsg');

    if (!title) { msg.textContent = 'Quiz title is required.'; msg.className = 'msg error'; return; }

    const res  = await apiPost('/quizzes', { module_id: moduleId, title, passing_score: passingScore });
    const data = await res.json();

    if (res.ok) {
        msg.textContent = data.message; msg.className = 'msg success';
        // Reload quiz data to show question section
        const qRes  = await apiGet(`/quizzes/module/${moduleId}`);
        const quiz  = await qRes.json();
        if (quiz) showQuizSection(quiz);
    } else {
        msg.textContent = data.message; msg.className = 'msg error';
    }
});

// ── Add Question form ─────────────────────────────────────────────────────────
document.getElementById('addQuestionForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const question_text  = document.getElementById('questionText').value.trim();
    const option_a       = document.getElementById('optionA').value.trim();
    const option_b       = document.getElementById('optionB').value.trim();
    const option_c       = document.getElementById('optionC').value.trim();
    const option_d       = document.getElementById('optionD').value.trim();
    const correct_option = document.getElementById('correctOption').value;
    const msg            = document.getElementById('questionMsg');

    if (!question_text) { msg.textContent = 'Question text is required.'; msg.className = 'msg error'; return; }
    if (!option_a || !option_b) { msg.textContent = 'Options A and B are required.'; msg.className = 'msg error'; return; }
    if (!correct_option) { msg.textContent = 'Please select the correct answer.'; msg.className = 'msg error'; return; }

    const res  = await apiPost(`/quizzes/${currentQuizId}/questions`,
        { question_text, option_a, option_b,
          option_c: option_c || null, option_d: option_d || null, correct_option });
    const data = await res.json();

    if (res.ok) {
        msg.textContent = data.message; msg.className = 'msg success';
        document.getElementById('addQuestionForm').reset();
        // Reload questions
        const qRes  = await apiGet(`/quizzes/module/${moduleId}`);
        const quiz  = await qRes.json();
        if (quiz) renderQuestions(quiz.questions || []);
    } else {
        msg.textContent = data.message; msg.className = 'msg error';
    }
});

// ── Delete Quiz ───────────────────────────────────────────────────────────────
async function deleteQuiz() {
    if (!confirm('Delete this quiz and all its questions?')) return;
    const res  = await apiDelete(`/quizzes/${currentQuizId}`);
    const data = await res.json();
    if (res.ok) {
        // Show create form again
        currentQuizId = null;
        document.getElementById('quizSection').style.display       = 'none';
        document.getElementById('createQuizSection').style.display = 'block';
        document.getElementById('createMsg').textContent           = 'Quiz deleted.';
        document.getElementById('createMsg').className             = 'msg success';
    } else { alert(data.message); }
}

// ── Delete Question ───────────────────────────────────────────────────────────
async function deleteQuestion(questionId) {
    if (!confirm('Delete this question?')) return;
    const res  = await apiDelete(`/quizzes/questions/${questionId}`);
    const data = await res.json();
    if (res.ok) {
        document.getElementById(`q-${questionId}`)?.remove();
        // Update count
        const current = parseInt(document.getElementById('questionCount').textContent);
        document.getElementById('questionCount').textContent = current - 1;
        if (current - 1 === 0)
            document.getElementById('questionList').innerHTML = '<p class="empty-msg">No questions yet.</p>';
    } else { alert(data.message); }
}

init();
