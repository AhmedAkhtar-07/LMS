// certificate.js — load and display a certificate

const params        = new URLSearchParams(window.location.search);
const certificateId = params.get('certificate_id');

async function init() {
    // Auth check — any logged-in user can view a certificate link
    const user = await requireAuth();
    if (!user) return;

    if (!certificateId) {
        showError('No certificate ID provided.');
        return;
    }

    const res  = await apiGet(`/certificates/${certificateId}`);
    const data = await res.json();

    if (!res.ok) {
        showError(data.message || 'Certificate not found.');
        return;
    }

    render(data);
}

let currentCert = null;

function render(cert) {
    currentCert = cert;

    document.getElementById('loadingMsg').style.display = 'none';

    document.getElementById('certStudent').textContent    = cert.student_name;
    document.getElementById('certCourse').textContent     = cert.course_title;
    document.getElementById('certInstructor').textContent = cert.instructor_name;
    document.getElementById('certDate').textContent       = formatDate(cert.issue_date);
    document.getElementById('certId').textContent         = '#' + cert.certificate_id;

    document.title = `Certificate — ${cert.course_title}`;
    document.getElementById('certificate').style.display = 'block';

    // Enable the save button now that the cert is rendered
    const btn = document.getElementById('saveBtn');
    btn.textContent = '💾 Save as PDF';
    btn.disabled    = false;
}

async function savePDF() {
    const btn = document.getElementById('saveBtn');
    btn.textContent = 'Generating PDF...';
    btn.disabled    = true;

    try {
        const certEl = document.getElementById('certificate');
        const { jsPDF } = window.jspdf;

        // Capture the certificate div as a high-res canvas
        const canvas = await html2canvas(certEl, {
            scale:           2,
            useCORS:         true,
            backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');

        // Fit the image into an A4 landscape page
        const pdf    = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pgW    = pdf.internal.pageSize.getWidth();
        const pgH    = pdf.internal.pageSize.getHeight();

        // Scale image to fill the page while keeping aspect ratio
        const ratio  = Math.min(pgW / canvas.width, pgH / canvas.height);
        const imgW   = canvas.width  * ratio;
        const imgH   = canvas.height * ratio;
        const x      = (pgW - imgW) / 2;
        const y      = (pgH - imgH) / 2;

        pdf.addImage(imgData, 'PNG', x, y, imgW, imgH);

        const filename = `certificate-${currentCert.course_title.replace(/\s+/g, '_')}.pdf`;
        pdf.save(filename);

    } catch (err) {
        console.error('PDF save error:', err);
        alert('Could not generate PDF. Please try again.');
    }

    btn.textContent = '💾 Save as PDF';
    btn.disabled    = false;
}

function showError(msg) {
    document.getElementById('loadingMsg').style.display = 'none';
    const el = document.getElementById('errorMsg');
    el.textContent  = msg;
    el.style.display = 'block';
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

init();
