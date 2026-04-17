// course-modules.js — load course/modules/materials, create module, delete

const params   = new URLSearchParams(window.location.search);
const courseId = params.get('course_id');
let   userRole = null;

async function init() {
    if (!courseId) { window.location.href = '/pages/login.html'; return; }

    const user = await requireAuth(); // any logged-in user
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
        // Show enroll banner above module list
        document.getElementById('enrollBanner').style.display = 'flex';
    }
}

async function loadCourse() {
    const res  = await apiGet(`/courses/${courseId}`);
    const data = await res.json();
    if (!res.ok) { document.getElementById('courseTitle').textContent = 'Course not found'; return; }
    document.getElementById('courseTitle').textContent = data.title;
    document.getElementById('courseDesc').textContent  = data.description || '';

    // Show join code badge to instructors
    if (userRole === 'instructor' && data.join_code) {
        document.getElementById('courseJoinCode').textContent = data.join_code;
        document.getElementById('joinCodeBadge').style.display = 'flex';
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
        ? `<button class="btn-delete-module" onclick="deleteModule(${mod.module_id})">Delete Module</button>`
        : '';

    const materialsHTML = mod.materials.length === 0
        ? '<p class="no-materials">No materials attached.</p>'
        : mod.materials.map(mat => buildMaterialHTML(mat)).join('');

    // Quiz section — instructor sees Manage Quiz, student sees View Quiz
    let quizHTML = '';
    if (userRole === 'instructor') {
        quizHTML = mod.quiz
            ? `<div class="quiz-bar">
                   <span class="quiz-label">📝 ${escapeHtml(mod.quiz.title)}</span>
                   <a class="btn-quiz" href="/pages/quiz-manage.html?module_id=${mod.module_id}&course_id=${courseId}">Manage Quiz</a>
               </div>`
            : `<div class="quiz-bar quiz-bar--empty">
                   <span class="quiz-label no-quiz">No quiz yet</span>
                   <a class="btn-quiz" href="/pages/quiz-manage.html?module_id=${mod.module_id}&course_id=${courseId}">+ Create Quiz</a>
               </div>`;
    } else {
        quizHTML = mod.quiz
            ? `<div class="quiz-bar">
                   <span class="quiz-label">📝 ${escapeHtml(mod.quiz.title)}</span>
                   <a class="btn-quiz" href="/pages/quiz-view.html?module_id=${mod.module_id}&course_id=${courseId}">View Quiz</a>
               </div>`
            : '';
    }

    return `
        <div class="module-item" id="module-${mod.module_id}">
            <div class="module-header">
                <div class="order-badge">${mod.module_order}</div>
                <div class="module-info">
                    <div class="module-title-text">${escapeHtml(mod.title)}</div>
                    <div class="module-id-text">Module ID: ${mod.module_id}</div>
                </div>
                ${deleteBtn}
            </div>
            <div class="materials-body">${materialsHTML}</div>
            ${quizHTML}
        </div>`;
}

function buildMaterialHTML(mat) {
    const deleteBtn = userRole === 'instructor'
        ? `<button class="btn-delete-mat" onclick="deleteMaterial(${mat.material_id})">✕</button>`
        : '';

    let icon, label, contentHTML;
    if (mat.type === 'pdf') {
        icon = '📄'; label = 'Document';
        contentHTML = `<a href="${mat.file_url}" target="_blank">${escapeHtml(mat.title)}</a>`;
    } else if (mat.type === 'video') {
        icon = '▶'; label = 'Video';
        contentHTML = `<a href="${escapeHtml(mat.content)}" target="_blank">${escapeHtml(mat.content)}</a>`;
    } else {
        icon = '📢'; label = 'Announcement';
        contentHTML = `<p>${escapeHtml(mat.content)}</p>`;
    }

    return `
        <div class="material-row" id="material-${mat.material_id}">
            <div class="material-icon ${mat.type}">${icon}</div>
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
    const module_order = document.getElementById('moduleOrder').value;
    const videoUrl     = document.getElementById('videoUrl').value.trim();
    const announcement = document.getElementById('announcement').value.trim();
    const pdfFile      = document.getElementById('pdfFile').files[0];
    const msg          = document.getElementById('msg');

    if (!title) { msg.textContent = 'Module title is required.'; msg.className = 'msg error'; return; }

    const order = parseInt(module_order);
    if (!module_order || isNaN(order) || order < 1) {
        msg.textContent = 'Order must be a positive number.'; msg.className = 'msg error'; return;
    }

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

    // Use FormData for file upload
    const formData = new FormData();
    formData.append('course_id',    courseId);
    formData.append('title',        title);
    formData.append('module_order', order);
    if (pdfFile)      formData.append('pdf_file',     pdfFile);
    if (videoUrl)     formData.append('video_url',    videoUrl);
    if (announcement) formData.append('announcement', announcement);

    const res  = await apiPostForm('/modules', formData);
    const data = await res.json();

    if (res.ok) {
        msg.textContent = data.message;
        msg.className   = 'msg success';
        document.getElementById('addModuleForm').reset();
        loadModules();
    } else {
        msg.textContent = data.message;
        msg.className   = 'msg error';
    }
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

// ── Enrolled Students (instructor only) ──────────────────────────────────────
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
            <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Status</th><th>Enrolled</th></tr></thead>
            <tbody>
                ${data.map((s, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td>${escapeHtml(s.name)}</td>
                        <td>${escapeHtml(s.email)}</td>
                        <td><span class="status-badge status-${s.status}">${s.status}</span></td>
                        <td>${new Date(s.enroll_date).toLocaleDateString()}</td>
                    </tr>`).join('')}
            </tbody>
        </table>`;
}

function toggleEnrolledList() {
    const list   = document.getElementById('enrolledStudentList');
    const toggle = document.getElementById('enrolledToggle');
    const shown  = list.style.display !== 'none';
    list.style.display   = shown ? 'none' : 'block';
    toggle.textContent   = shown ? '▼' : '▲';
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
