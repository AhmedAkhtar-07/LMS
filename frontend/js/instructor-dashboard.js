// instructor-dashboard.js

async function init() {
    const user = await requireAuth('instructor');
    if (!user) return;

    document.getElementById('userName').textContent = user.name;
    loadDashboard();
}

async function loadDashboard() {
    const res  = await apiGet('/dashboard/instructor');
    const data = await res.json();

    if (!res.ok) {
        document.getElementById('courseList').innerHTML =
            '<p class="empty-msg">Failed to load dashboard.</p>';
        return;
    }

    renderStats(data.summary);
    renderCourses(data.courses);
    renderAnalytics(data.courses);
}

// ── Stat cards ────────────────────────────────────────────────────────────────
function renderStats(s) {
    document.getElementById('statCourses').textContent  = s.total_courses;
    document.getElementById('statStudents').textContent = s.total_students;
    document.getElementById('statQuizzes').textContent  = s.total_quizzes;
}

// ── Course cards ──────────────────────────────────────────────────────────────
function renderCourses(courses) {
    const list = document.getElementById('courseList');

    if (courses.length === 0) {
        list.innerHTML = '<p class="empty-msg">No courses yet. Click "Create Course" to add one.</p>';
        return;
    }

    list.innerHTML = `<div class="course-grid">${courses.map(c => `
        <div class="course-card">
            <div class="card-body" onclick="openCourse(${c.course_id})">
                <h3>${escapeHtml(c.title)}</h3>
                <div class="card-meta-row">
                    <span class="meta-chip">${c.enrolled_count} student${c.enrolled_count !== 1 ? 's' : ''}</span>
                    <span class="meta-chip">${c.quiz_count} quiz${c.quiz_count !== 1 ? 'zes' : ''}</span>
                </div>
                <p class="card-link">Manage Modules →</p>
            </div>
            <div class="join-code-bar">
                <span class="join-label">Join Code</span>
                <span class="join-code">${escapeHtml(c.join_code || '—')}</span>
                <button class="btn-copy" onclick="copyCode('${c.join_code || ''}', this)">Copy</button>
            </div>
        </div>
    `).join('')}</div>`;
}

// ── Analytics table ───────────────────────────────────────────────────────────
function renderAnalytics(courses) {
    const hasData = courses.some(c => c.avg_score !== null || c.enrolled_count > 0);
    if (!hasData && courses.length === 0) return;

    document.getElementById('analyticsSection').style.display = 'block';

    document.getElementById('analyticsBody').innerHTML = courses.map(c => {
        const avg      = c.avg_score  !== null ? c.avg_score  + '%' : '—';
        const passRate = c.pass_rate  !== null ? c.pass_rate  + '%' : '—';

        // Colour pass rate
        const prClass = c.pass_rate === null ? '' :
                        c.pass_rate >= 70 ? 'good' :
                        c.pass_rate >= 40 ? 'mid'  : 'poor';

        return `
        <tr>
            <td class="course-name-cell">${escapeHtml(c.title)}</td>
            <td>${c.enrolled_count}</td>
            <td>${c.quiz_count}</td>
            <td>${avg}</td>
            <td><span class="pass-rate ${prClass}">${passRate}</span></td>
        </tr>`;
    }).join('');
}

function openCourse(courseId) {
    window.location.href = `/pages/course-modules.html?course_id=${courseId}`;
}

function copyCode(code, btn) {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
    });
}

init();
