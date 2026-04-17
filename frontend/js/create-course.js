// create-course.js — auth check and course creation form

async function init() {
    const user = await requireAuth('instructor');
    if (!user) return;
}

document.getElementById('createCourseForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const title       = document.getElementById('title').value.trim();
    const description = document.getElementById('description').value.trim();
    const msg         = document.getElementById('msg');

    if (!title) {
        msg.textContent = 'Course title is required.';
        msg.className   = 'msg error';
        return;
    }

    const res  = await apiPost('/courses', { title, description });
    const data = await res.json();

    if (res.ok) {
        msg.textContent = `Course created! (ID: ${data.course_id}) Redirecting...`;
        msg.className   = 'msg success';
        setTimeout(() => { window.location.href = '/pages/instructor-dashboard.html'; }, 1500);
    } else {
        msg.textContent = data.message;
        msg.className   = 'msg error';
    }
});

init();
