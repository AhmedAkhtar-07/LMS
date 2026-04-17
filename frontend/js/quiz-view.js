// quiz-view.js — student quiz attempt: load questions, submit answers, show result

const params   = new URLSearchParams(window.location.search);
const moduleId = params.get('module_id');
const courseId = params.get('course_id');
let   quizId   = null;

async function init() {
    if (!moduleId) { window.location.href = '/pages/login.html'; return; }

    const user = await requireAuth('student');
    if (!user) return;

    // Back link goes to the course modules page
    document.getElementById('backLink').href =
        courseId ? `/pages/course-modules.html?course_id=${courseId}` : '/pages/courses.html';

    loadQuiz();
}

// ── Load quiz and render questions ────────────────────────────────────────────
async function loadQuiz() {
    const res  = await apiGet(`/quizzes/module/${moduleId}`);
    const quiz = await res.json();

    if (!res.ok || !quiz) {
        document.getElementById('quizBody').innerHTML = '<p class="empty-msg">No quiz available for this module.</p>';
        return;
    }

    quizId = quiz.quiz_id;
    document.getElementById('quizTitle').textContent    = quiz.title;
    document.getElementById('passingScore').textContent = quiz.passing_score;

    if (!quiz.questions || quiz.questions.length === 0) {
        document.getElementById('quizBody').innerHTML = '<p class="empty-msg">This quiz has no questions yet.</p>';
        return;
    }

    renderQuestions(quiz.questions);
    document.getElementById('submitSection').style.display = 'block';
}

// ── Render questions with radio button options ────────────────────────────────
function renderQuestions(questions) {
    document.getElementById('quizBody').innerHTML = questions.map((q, i) => `
        <div class="question-card" id="qcard-${q.question_id}">
            <div class="question-num">Question ${i + 1} of ${questions.length}</div>
            <div class="question-text">${escapeHtml(q.question_text)}</div>
            <ul class="options-list">
                ${buildOption(q.question_id, 'A', q.option_a)}
                ${buildOption(q.question_id, 'B', q.option_b)}
                ${q.option_c ? buildOption(q.question_id, 'C', q.option_c) : ''}
                ${q.option_d ? buildOption(q.question_id, 'D', q.option_d) : ''}
            </ul>
        </div>
    `).join('');

    // Highlight question card border when student selects an option
    document.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const card = document.getElementById(`qcard-${radio.dataset.qid}`);
            if (card) card.classList.add('answered');
        });
    });
}

function buildOption(questionId, letter, text) {
    return `
        <li>
            <label class="option-label">
                <input type="radio" name="q_${questionId}" value="${letter}" data-qid="${questionId}">
                <span><strong>${letter}.</strong> ${escapeHtml(text)}</span>
            </label>
        </li>`;
}

// ── Submit quiz ───────────────────────────────────────────────────────────────
async function submitQuiz() {
    const msg = document.getElementById('submitMsg');

    // Collect all selected answers: { question_id: selected_option }
    const radios  = document.querySelectorAll('input[type="radio"]:checked');
    const answers = {};
    radios.forEach(r => { answers[r.dataset.qid] = r.value; });

    if (Object.keys(answers).length === 0) {
        msg.textContent = 'Please answer at least one question before submitting.';
        msg.className   = 'msg error';
        return;
    }

    // Send answers to backend for grading
    const res  = await apiPost(`/quizzes/${quizId}/attempt`, { answers });
    const data = await res.json();

    if (res.ok) {
        showResult(data);
    } else {
        msg.textContent = data.message;
        msg.className   = 'msg error';
    }
}

// ── Show result card ──────────────────────────────────────────────────────────
function showResult(data) {
    // Hide quiz body and submit button
    document.getElementById('quizBody').style.display      = 'none';
    document.getElementById('submitSection').style.display = 'none';

    const card = document.getElementById('resultCard');
    card.style.display = 'block';
    card.classList.add(data.passed ? 'passed' : 'failed');

    document.getElementById('resultIcon').textContent    = data.passed ? '🎉' : '😞';
    document.getElementById('resultTitle').textContent   = data.passed ? 'Congratulations! You Passed!' : 'You Did Not Pass';
    document.getElementById('resultDetail').textContent  =
        `You got ${data.correct} out of ${data.total} questions correct. Required: ${data.passing_score}%`;
    document.getElementById('resultScore').textContent   = data.score + '%';
}

// ── Retry quiz — reload page to reset everything ──────────────────────────────
function retryQuiz() {
    window.location.reload();
}

init();
