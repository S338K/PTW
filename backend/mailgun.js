const FormData = require('form-data');
const Mailgun = require('mailgun.js');
const mailgun = new Mailgun(FormData);

const mg = mailgun.client({
    username: 'api',
    key: process.env.MAILGUN_API_KEY
});

async function sendResetEmail(toEmail, resetLink) {
    const msgData = {
        from: process.env.MAILGUN_FROM,
        to: toEmail,
        subject: 'Password Reset Request',
        text: `Click the link to reset your password: ${resetLink}`,
        html: `<p>Click the link to reset your password: <a href="${resetLink}">${resetLink}</a></p>`
    };

    try {
        const res = await mg.messages.create(process.env.MAILGUN_DOMAIN, msgData);
        console.log('[Forgot Password] Email sent via Mailgun:', res.id);
        return { ok: true, id: res.id };
    } catch (err) {
        console.error('[Forgot Password] Mailgun error:', err);
        return { ok: false, error: err.message || 'Mailgun send failed' };
    }
}

module.exports = { sendResetEmail };
