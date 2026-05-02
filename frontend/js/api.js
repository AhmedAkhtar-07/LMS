// api.js — shared helper for authenticated fetch calls
// Include this before any page-specific JS that calls the backend
//
// Why sessionStorage?
//   sessionStorage is TAB-SPECIFIC — each browser tab has its own copy.
//   This means Tab 1 (instructor) and Tab 2 (student) each store their own
//   token independently and never interfere with each other.

// ── Get token from this tab's sessionStorage ──────────────────────────────────
function getToken() {
    return sessionStorage.getItem('token');
}

// ── Auth headers — added to every API request ─────────────────────────────────
function authHeaders(extra = {}) {
    return { 'Authorization': `Bearer ${getToken()}`, ...extra };
}

// ── Authenticated fetch wrappers ──────────────────────────────────────────────

// GET request with auth header
function apiGet(url) {
    return fetch(url, { headers: authHeaders() });
}

// POST request with JSON body and auth header
function apiPost(url, body) {
    return fetch(url, {
        method:  'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body:    JSON.stringify(body)
    });
}

// POST request with FormData (file uploads) — no Content-Type header (browser sets it)
function apiPostForm(url, formData) {
    return fetch(url, {
        method:  'POST',
        headers: authHeaders(), // no Content-Type — browser sets multipart boundary
        body:    formData
    });
}

// PATCH request with JSON body and auth header
function apiPatch(url, body) {
    return fetch(url, {
        method:  'PATCH',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body:    JSON.stringify(body)
    });
}

// DELETE request with auth header
function apiDelete(url) {
    return fetch(url, { method: 'DELETE', headers: authHeaders() });
}

// ── Check auth and redirect if not logged in ──────────────────────────────────
// role: 'student' | 'instructor' | null (any logged-in user)
async function requireAuth(role = null) {
    const token = getToken();

    if (!token) { window.location.href = '/pages/login.html'; return null; }

    const res  = await apiGet('/auth/me');
    const data = await res.json();

    if (!res.ok) { window.location.href = '/pages/login.html'; return null; }

    if (role && data.role !== role) { window.location.href = '/pages/login.html'; return null; }

    return data; // returns { user_id, name, role }
}

// ── Logout — clears this tab's token and redirects ───────────────────────────
function logout() {
    sessionStorage.removeItem('token');
    window.location.href = '/pages/login.html';
}

// ── Escape HTML to prevent XSS when rendering user content ───────────────────
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
