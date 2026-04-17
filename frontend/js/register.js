// register.js — handles registration form

document.getElementById('registerForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const name     = document.getElementById('name').value.trim();
    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const role     = document.getElementById('role').value;
    const msg      = document.getElementById('msg');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        msg.textContent = 'Please enter a valid email address (e.g. name@example.com).';
        msg.className   = 'msg error';
        document.getElementById('email').focus();
        return;
    }

    if (!role) {
        msg.textContent = 'Please select a role.';
        msg.className   = 'msg error';
        return;
    }

    const res  = await fetch('/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, email, password, role })
    });

    const data = await res.json();

    if (res.ok) {
        msg.textContent = data.message + ' Redirecting to login...';
        msg.className   = 'msg success';
        setTimeout(() => { window.location.href = '/pages/login.html'; }, 1500);
    } else {
        msg.textContent = data.message;
        msg.className   = 'msg error';
    }
});
