// courses.js — browse all courses; enrolled students see "Open Course", others see nothing actionable

let currentUser = null;
let enrolledIds = new Set();

async function init() {
    currentUser = await requireAuth();
    if (!currentUser) return;

    document.getElementById('userName').textContent = currentUser.name;

    document.getElementById('dashboardLink').href =
        currentUser.role === 'instructor'
            ? '/pages/instructor-dashboard.html'
            : '/pages/student-dashboard.html';

    // Students: load their enrolled courses so we can show "Open Course" on enrolled ones
    if (currentUser.role === 'student') {
        const eRes  = await apiGet('/enrollments/my');
        const eData = await eRes.json();
        if (eRes.ok) eData.forEach(e => enrolledIds.add(e.course_id));
    }

    loadCourses();
}

async function loadCourses() {
    const res  = await apiGet('/courses/all');
    const data = await res.json();
    const grid = document.getElementById('courseGrid');

    if (!res.ok) { grid.innerHTML = '<p class="empty-msg">Failed to load courses.</p>'; return; }
    if (data.length === 0) { grid.innerHTML = '<p class="empty-msg">No courses available yet.</p>'; return; }

    grid.innerHTML = data.map(course => buildCard(course)).join('');
}

function buildCard(course) {
    if (currentUser.role === 'instructor') {
        return `
            <div class="course-card" onclick="window.location.href='/pages/course-modules.html?course_id=${course.course_id}'">
                <h3>${escapeHtml(course.title)}</h3>
                <p class="desc">${escapeHtml(course.description || 'No description.')}</p>
                <p class="instructor">👤 ${escapeHtml(course.instructor_name)}</p>
                <p class="card-link">View Modules →</p>
            </div>`;
    }

    // Student: show "Open Course" if enrolled, otherwise show a hint to use a code
    const isEnrolled = enrolledIds.has(course.course_id);
    const action = isEnrolled
        ? `<button class="btn-open" onclick="event.stopPropagation(); window.location.href='/pages/course-modules.html?course_id=${course.course_id}'">Open Course →</button>`
        : `<span class="not-enrolled-hint">Use a code to join</span>`;

    return `
        <div class="course-card ${isEnrolled ? 'enrolled' : ''}">
            <div class="card-top">
                <h3>${escapeHtml(course.title)}</h3>
                ${isEnrolled ? '<span class="enrolled-badge">✓ Enrolled</span>' : ''}
            </div>
            <p class="desc">${escapeHtml(course.description || 'No description.')}</p>
            <p class="instructor">👤 ${escapeHtml(course.instructor_name)}</p>
            <div class="card-actions">${action}</div>
        </div>`;
}

init();
