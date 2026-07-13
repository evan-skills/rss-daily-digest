const { generateDigest } = require('./digest');
const { saveDigest } = require('./store');
const { sendDigestEmail, isEmailConfigured } = require('./mailer');

// 生成摘要 → 保存 → （可选）发邮件。scheduler / routes / cli 共用
async function runDigest({ hours, sendEmail = false, onProgress } = {}) {
  const digest = await generateDigest({ hours, onProgress });
  const id = await saveDigest(digest);

  let emailed = false;
  let emailError = null;
  if (sendEmail) {
    if (!isEmailConfigured()) {
      emailError = '未配置邮件参数，已跳过发送';
    } else {
      try {
        await sendDigestEmail(digest);
        emailed = true;
      } catch (err) {
        emailError = err.message;
      }
    }
  }

  return { id, digest, emailed, emailError };
}

module.exports = { runDigest };
