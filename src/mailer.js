const nodemailer = require('nodemailer');
const { email } = require('./config');
const { renderEmailHtml } = require('./render');

function isConfigured() {
  return Boolean(email.host && email.user && email.to);
}

// 发送摘要邮件；未配置时抛出可读错误
async function sendDigestEmail(digest) {
  if (!isConfigured()) {
    const err = new Error('未配置邮件参数（EMAIL_HOST / EMAIL_USER / EMAIL_TO）');
    err.status = 400;
    throw err;
  }

  const transporter = nodemailer.createTransport({
    host: email.host,
    port: email.port,
    secure: email.port === 465,
    auth: { user: email.user, pass: email.pass },
    tls: { rejectUnauthorized: false }
  });

  const date = new Date(digest.generatedAt).toLocaleDateString('zh-CN');
  await transporter.sendMail({
    from: email.user,
    to: email.to,
    subject: `📰 RSS每日摘要 - ${date}`,
    html: renderEmailHtml(digest)
  });
}

module.exports = { sendDigestEmail, isEmailConfigured: isConfigured };
