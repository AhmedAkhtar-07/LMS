// student-dashboard.js

async function init() {
    const user = await requireAuth('student');
    if (!user) return;

    document.getElementById('userName').textContent    = user.name;
    document.getElementById('welcomeName').textContent = user.name;

    document.getElementById('joinCodeInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') joinCourse();
    });

    loadDashboard();
}

// ── Load full dashboard ───────────────────────────────────────────────────────
async function loadDashboard() {
    const [dashRes, certsRes] = await Promise.all([
        apiGet('/dashboard/student'),
        apiGet('/certificates/my')
    ]);

    const dash  = await dashRes.json();
    const certs = await certsRes.json();

    if (!dashRes.ok) {
        document.getElementById('courseList').innerHTML =
            '<p class="empty-msg">Failed to load dashboard.</p>';
        return;
    }

    renderStats(dash.summary);
    renderCourses(dash.courses);
    renderRecent(dash.recent_attempts);
    renderCertificates(certsRes.ok ? certs : []);
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
function renderStats(s) {
    document.getElementById('statCourses').textContent  = s.total_courses;
    document.getElementById('statProgress').textContent = s.overall_progress + '%';
    document.getElementById('statAvg').textContent      =
        s.overall_avg_score !== null ? s.overall_avg_score + '%' : 'N/A';
    document.getElementById('statQuizzes').textContent  =
        s.attempted_quizzes + ' / ' + s.total_quizzes;
}

// ── Course progress cards ─────────────────────────────────────────────────────
function renderCourses(courses) {
    const list = document.getElementById('courseList');

    if (courses.length === 0) {
        list.innerHTML = '<p class="empty-msg">No courses yet. Enter a code above to join one.</p>';
        return;
    }

    list.innerHTML = courses.map(c => {
        const pct      = c.progress_pct;
        const barColor = pct === 100 ? '#16a34a' : pct >= 50 ? '#2563eb' : '#f59e0b';
        const scoreStr = c.course_avg_score !== null ? c.course_avg_score + '%' : 'No attempts yet';

        // Certificate action button
        let certBtn = '';
        if (c.certificate_id) {
            certBtn = `<a class="btn-cert view"
                          href="/pages/certificate.html?certificate_id=${c.certificate_id}"
                          onclick="event.stopPropagation()">View Certificate</a>`;
        } else if (c.eligible) {
            certBtn = `<button class="btn-cert claim"
                               onclick="event.stopPropagation(); claimCertificate(${c.course_id}, this)">
                           Claim Certificate
                       </button>`;
        } else if (c.total_quizzes > 0) {
            certBtn = `<span class="cert-hint">${c.passed_quizzes}/${c.total_quizzes} quizzes passed</span>`;
        }

        return `
        <div class="course-progress-card"
             onclick="window.location.href='/pages/course-modules.html?course_id=${c.course_id}'">
            <div class="cp-top">
                <div class="cp-info">
                    <div class="cp-title">${escapeHtml(c.title)}</div>
                    <div class="cp-meta">By ${escapeHtml(c.instructor_name)}</div>
                </div>
                <div class="cp-stats">
                    <span class="cp-score">${scoreStr}</span>
                    <span class="cp-pct">${pct}%</span>
                </div>
            </div>
            <div class="progress-track">
                <div class="progress-fill" style="width:${pct}%; background:${barColor};"></div>
            </div>
            <div class="cp-foot">
                <span>${c.attempted_quizzes} of ${c.total_quizzes} quiz${c.total_quizzes !== 1 ? 'zes' : ''} attempted</span>
                <span>${certBtn}</span>
            </div>
        </div>`;
    }).join('');
}

// ── Claim certificate ─────────────────────────────────────────────────────────
async function claimCertificate(courseId, btn) {
    btn.disabled    = true;
    btn.textContent = 'Generating...';

    const res  = await apiPost(`/certificates/generate/${courseId}`, {});
    const data = await res.json();

    if (res.ok || data.already_issued) {
        // Redirect to certificate page
        window.location.href = `/pages/certificate.html?certificate_id=${data.certificate_id}`;
    } else {
        btn.disabled    = false;
        btn.textContent = '🏅 Claim Certificate';
        alert(data.message);
    }
}

// ── Recent quiz activity ──────────────────────────────────────────────────────
function renderRecent(attempts) {
    if (!attempts || attempts.length === 0) return;

    document.getElementById('recentSection').style.display = 'block';
    document.getElementById('recentList').innerHTML = attempts.map(a => {
        const passed  = parseInt(a.passed);
        const dateStr = new Date(a.attempt_date).toLocaleDateString();
        return `
        <div class="recent-row">
            <div class="recent-info">
                <span class="recent-quiz">${escapeHtml(a.quiz_title)}</span>
                <span class="recent-course">${escapeHtml(a.course_title)}</span>
            </div>
            <div class="recent-right">
                <span class="recent-score ${passed ? 'pass' : 'fail'}">${a.score}%</span>
                <span class="recent-date">${dateStr}</span>
            </div>
        </div>`;
    }).join('');
}

// ── My certificates section ───────────────────────────────────────────────────
function renderCertificates(certs) {
    if (!certs || certs.length === 0) return;

    document.getElementById('certsSection').style.display = 'block';
    document.getElementById('certsList').innerHTML = certs.map(c => `
        <div class="cert-row"
             onclick="window.location.href='/pages/certificate.html?certificate_id=${c.certificate_id}'">
            <div class="cert-row-icon">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="2" y="5" width="16" height="12" rx="2" stroke="#0d7a5f" stroke-width="2"/><path d="M7 10l2 2 4-4" stroke="#0d7a5f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div class="cert-row-info">
                <div class="cert-row-title">${escapeHtml(c.course_title)}</div>
                <div class="cert-row-meta">Issued ${new Date(c.issue_date).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</div>
            </div>
            <span class="cert-row-link">View →</span>
        </div>
    `).join('');
}

// ── Join course ───────────────────────────────────────────────────────────────
async function joinCourse() {
    const input = document.getElementById('joinCodeInput');
    const msg   = document.getElementById('joinMsg');
    const code  = input.value.trim().toUpperCase();

    if (!code) { msg.textContent = 'Please enter a course code.'; msg.className = 'msg error'; return; }

    const res  = await apiPost('/enrollments/join', { code });
    const data = await res.json();

    if (res.ok) {
        msg.textContent = data.message;
        msg.className   = 'msg success';
        input.value     = '';
        loadDashboard();
    } else {
        msg.textContent = data.message;
        msg.className   = 'msg error';
    }
}

init();
