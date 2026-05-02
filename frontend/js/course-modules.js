// course-modules.js

const params   = new URLSearchParams(window.location.search);
const courseId = params.get('course_id');
let   userRole = null;

async function init() {
    if (!courseId) { window.location.href = '/pages/login.html'; return; }

    const user = await requireAuth();
    if (!user) return;

    userRole = user.role;

    if (userRole === 'instructor') {
        document.getElementById('backLink').href = '/pages/instructor-dashboard.html';
        document.getElementById('addModuleSection').style.display = 'block';
        document.getElementById('enrolledSection').style.display  = 'block';
        loadEnrolledStudents();
    } else {
        document.getElementById('backLink').href = '/pages/student-dashboard.html';
        await checkEnrollment();
    }

    loadCourse();
    loadModules();
}

async function checkEnrollment() {
    const res  = await apiGet(`/enrollments/check/${courseId}`);
    const data = await res.json();
    if (!res.ok || !data.enrolled) {
        document.getElementById('enrollBanner').style.display = 'flex';
    }
}

async function loadCourse() {
    const res  = await apiGet(`/courses/${courseId}`);
    const data = await res.json();
    if (!res.ok) { document.getElementById('courseTitle').textContent = 'Course not found'; return; }
    document.getElementById('courseTitle').textContent = data.title;
    document.getElementById('courseDesc').textContent  = data.description || '';
    if (userRole === 'instructor' && data.join_code) {
        document.getElementById('courseJoinCode').textContent     = data.join_code;
        document.getElementById('joinCodeBadge').style.display    = 'flex';
    }
}

function copyJoinCode() {
    const code = document.getElementById('courseJoinCode').textContent;
    const btn  = document.querySelector('.btn-copy-code');
    navigator.clipboard.writeText(code).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
    });
}

async function loadModules() {
    const res  = await apiGet(`/modules/course/${courseId}`);
    const data = await res.json();
    const list = document.getElementById('moduleList');
    if (!res.ok) { list.innerHTML = '<p class="empty-msg">Failed to load modules.</p>'; return; }
    if (data.length === 0) { list.innerHTML = '<p class="empty-msg">No modules yet.</p>'; return; }
    list.innerHTML = data.map(mod => buildModuleHTML(mod)).join('');
}

function buildModuleHTML(mod) {
    const deleteBtn = userRole === 'instructor'
        ? `<button class="btn-delete-module" onclick="event.stopPropagation(); deleteModule(${mod.module_id})">Delete</button>`
        : '';

    const materialsHTML = mod.materials.length === 0
        ? '<p class="no-materials">No materials attached.</p>'
        : mod.materials.map(mat => buildMaterialHTML(mat)).join('');

    let quizHTML = '';
    if (userRole === 'instructor') {
        quizHTML = mod.quiz
            ? `<div class="quiz-bar">
                   <div class="quiz-bar-left">
                       <span class="quiz-type-badge">Quiz</span>
                       <span class="quiz-label">${escapeHtml(mod.quiz.title)}</span>
                   </div>
                   <a class="btn-quiz" href="/pages/quiz-manage.html?module_id=${mod.module_id}&course_id=${courseId}">Manage</a>
               </div>`
            : `<div class="quiz-bar quiz-bar--empty">
                   <div class="quiz-bar-left">
                       <span class="quiz-label no-quiz">No quiz attached</span>
                   </div>
                   <a class="btn-quiz create" href="/pages/quiz-manage.html?module_id=${mod.module_id}&course_id=${courseId}">+ Add Quiz</a>
               </div>`;
    } else {
        quizHTML = mod.quiz
            ? `<div class="quiz-bar">
                   <div class="quiz-bar-left">
                       <span class="quiz-type-badge">Quiz</span>
                       <span class="quiz-label">${escapeHtml(mod.quiz.title)}</span>
                   </div>
                   <a class="btn-quiz" href="/pages/quiz-view.html?module_id=${mod.module_id}&course_id=${courseId}">Attempt Quiz</a>
               </div>`
            : '';
    }

    return `
    <div class="module-item" id="module-${mod.module_id}">
        <div class="module-header" onclick="toggleModule(${mod.module_id})">
            <div class="module-info">
                <div class="module-title-text">${escapeHtml(mod.title)}</div>
            </div>
            ${deleteBtn}
            <span class="module-chevron">▼</span>
        </div>
        <div class="module-body">
            <div class="materials-body">
                <div class="materials-title">Materials</div>
                ${materialsHTML}
            </div>
            ${quizHTML}
        </div>
    </div>`;
}

function toggleModule(moduleId) {
    const item = document.getElementById(`module-${moduleId}`);
    if (item) item.classList.toggle('open');
}

function buildMaterialHTML(mat) {
    const deleteBtn = userRole === 'instructor'
        ? `<button class="btn-delete-mat" onclick="deleteMaterial(${mat.material_id})">Remove</button>`
        : '';

    let iconText, label, contentHTML;
    if (mat.type === 'pdf') {
        iconText = 'PDF'; label = 'Document';
        contentHTML = `<a href="${mat.file_url}" target="_blank">${escapeHtml(mat.title)}</a>`;
    } else if (mat.type === 'video') {
        iconText = 'VID'; label = 'Video';
        contentHTML = `<a href="${escapeHtml(mat.content)}" target="_blank">${escapeHtml(mat.content)}</a>`;
    } else {
        iconText = 'ANN'; label = 'Announcement';
        contentHTML = `<p>${escapeHtml(mat.content)}</p>`;
    }

    return `
    <div class="material-row" id="material-${mat.material_id}">
        <div class="material-icon ${mat.type}">${iconText}</div>
        <div class="material-content">
            <div class="material-label">${label}</div>
            ${contentHTML}
        </div>
        ${deleteBtn}
    </div>`;
}

// ── Add Module Form ───────────────────────────────────────────────────────────
document.getElementById('addModuleForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const title        = document.getElementById('moduleTitle').value.trim();
    const videoUrl     = document.getElementById('videoUrl').value.trim();
    const announcement = document.getElementById('announcement').value.trim();
    const pdfFile      = document.getElementById('pdfFile').files[0];
    const quizTitle    = document.getElementById('newQuizTitle').value.trim();
    const passingScore = document.getElementById('newPassingScore').value;
    const msg          = document.getElementById('msg');

    if (!title) { msg.textContent = 'Module title is required.'; msg.className = 'msg error'; return; }

    if (videoUrl) {
        try { new URL(videoUrl); }
        catch { msg.textContent = 'Please enter a valid video URL.'; msg.className = 'msg error'; return; }
    }

    if (pdfFile) {
        const ext = pdfFile.name.substring(pdfFile.name.lastIndexOf('.')).toLowerCase();
        if (!['.pdf', '.doc', '.docx'].includes(ext)) {
            msg.textContent = 'Only PDF, DOC, DOCX files are allowed.'; msg.className = 'msg error'; return;
        }
    }

    const formData = new FormData();
    formData.append('course_id', courseId);
    formData.append('title',     title);
    if (pdfFile)      formData.append('pdf_file',     pdfFile);
    if (videoUrl)     formData.append('video_url',    videoUrl);
    if (announcement) formData.append('announcement', announcement);

    const res  = await apiPostForm('/modules', formData);
    const data = await res.json();

    if (!res.ok) { msg.textContent = data.message; msg.className = 'msg error'; return; }

    // Optionally create a quiz for this module
    if (quizTitle) {
        const score = parseInt(passingScore) || 50;
        const qRes  = await apiPost('/quizzes', {
            module_id:     data.module_id,
            title:         quizTitle,
            passing_score: score
        });
        const qData = await qRes.json();
        if (!qRes.ok) {
            msg.textContent = `Module created, but quiz failed: ${qData.message}`;
            msg.className   = 'msg error';
            document.getElementById('addModuleForm').reset();
            loadModules();
            return;
        }
    }

    msg.textContent = quizTitle ? 'Module and quiz created!' : data.message;
    msg.className   = 'msg success';
    document.getElementById('addModuleForm').reset();
    loadModules();
});

async function deleteModule(moduleId) {
    if (!confirm('Delete this module and all its materials?')) return;
    const res  = await apiDelete(`/modules/${moduleId}`);
    const data = await res.json();
    if (res.ok) {
        document.getElementById(`module-${moduleId}`)?.remove();
        if (!document.querySelector('.module-item')) {
            document.getElementById('moduleList').innerHTML = '<p class="empty-msg">No modules yet.</p>';
        }
    } else { alert(data.message); }
}

async function deleteMaterial(materialId) {
    if (!confirm('Delete this material?')) return;
    const res  = await apiDelete(`/materials/${materialId}`);
    const data = await res.json();
    if (res.ok) {
        document.getElementById(`material-${materialId}`)?.remove();
    } else { alert(data.message); }
}

// ── Enrolled Students ─────────────────────────────────────────────────────────
async function loadEnrolledStudents() {
    const res  = await apiGet(`/enrollments/course/${courseId}`);
    const data = await res.json();
    const countEl = document.getElementById('enrolledCount');
    const listEl  = document.getElementById('enrolledStudentList');
    if (!res.ok) { countEl.textContent = ''; return; }
    countEl.textContent = `(${data.length})`;
    if (data.length === 0) {
        listEl.innerHTML = '<p class="empty-msg" style="padding:12px 0">No students enrolled yet.</p>';
        return;
    }
    listEl.innerHTML = `
        <table class="students-table">
            <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Status</th><th>Enrolled</th><th>Action</th></tr></thead>
            <tbody>${data.map((s, i) => `
                <tr id="enroll-row-${s.enrollment_id}">
                    <td>${i + 1}</td>
                    <td>${escapeHtml(s.name)}</td>
                    <td>${escapeHtml(s.email)}</td>
                    <td><span class="status-badge status-${s.status}" id="status-badge-${s.enrollment_id}">${s.status}</span></td>
                    <td>${new Date(s.enroll_date).toLocaleDateString()}</td>
                    <td>
                        ${s.status !== 'completed'
                            ? `<button class="btn-pass-student" onclick="markStudentPassed(${s.enrollment_id}, this)">Mark Passed</button>`
                            : `<span class="passed-label">Passed</span>`
                        }
                    </td>
                </tr>`).join('')}
            </tbody>
        </table>`;
}

async function markStudentPassed(enrollmentId, btn) {
    if (!confirm('Mark this student as passed? This will allow them to claim a certificate.')) return;
    btn.disabled    = true;
    btn.textContent = 'Saving...';
    const res  = await apiPatch(`/enrollments/${enrollmentId}/status`, { status: 'completed' });
    const data = await res.json();
    if (res.ok) {
        const badge = document.getElementById(`status-badge-${enrollmentId}`);
        if (badge) { badge.textContent = 'completed'; badge.className = 'status-badge status-completed'; }
        btn.replaceWith(Object.assign(document.createElement('span'), { className: 'passed-label', textContent: 'Passed' }));
    } else {
        btn.disabled    = false;
        btn.textContent = 'Mark Passed';
        alert(data.message);
    }
}

function toggleEnrolledList() {
    const list   = document.getElementById('enrolledStudentList');
    const toggle = document.getElementById('enrolledToggle');
    const shown  = list.style.display !== 'none';
    list.style.display = shown ? 'none' : 'block';
    toggle.textContent = shown ? '▼' : '▲';
}

async function enrollCourse() {
    const btn = document.getElementById('enrollBtn');
    btn.disabled    = true;
    btn.textContent = 'Enrolling...';
    const res  = await apiPost('/enrollments', { course_id: courseId });
    const data = await res.json();
    if (res.ok) {
        document.getElementById('enrollBanner').style.display = 'none';
    } else {
        btn.disabled    = false;
        btn.textContent = 'Enroll Now';
        alert(data.message);
    }
}

init();
