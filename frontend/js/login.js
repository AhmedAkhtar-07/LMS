// login.js — handles login, stores JWT in sessionStorage (tab-specific)

document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const msg      = document.getElementById('msg');

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        msg.textContent = 'Please enter a valid email address (e.g. name@example.com).';
        msg.className   = 'msg error';
        document.getElementById('email').focus();
        return;
    }

    const res  = await fetch('/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (res.ok) {
        // Store token in sessionStorage — this is TAB-SPECIFIC
        // Each tab has its own sessionStorage, so student and instructor
        // can be logged in simultaneously in different tabs
        sessionStorage.setItem('token', data.token);

        // Redirect based on role
        if (data.role === 'student') {
            window.location.href = '/pages/student-dashboard.html';
        } else if (data.role === 'instructor') {
            window.location.href = '/pages/instructor-dashboard.html';
        }
    } else {
        msg.textContent = data.message;
        msg.className   = 'msg error';
    }
});
