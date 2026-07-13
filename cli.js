// CLI 入口：兼容旧用法。生成摘要、保存、可选发邮件。
const { runDigest } = require('./src/runner');
const { DEFAULT_HOURS } = require('./src/config');

async function main() {
  const args = process.argv.slice(2);
  const noEmail = args.includes('--no-email');

  let hours = DEFAULT_HOURS;
  const hoursIndex = args.indexOf('--hours');
  if (hoursIndex !== -1) {
    const parsed = parseInt(args[hoursIndex + 1], 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      console.error('❌ --hours 参数无效，请提供一个正整数（例如 --hours 48）');
      process.exit(1);
    }
    hours = parsed;
  }

  console.log('🚀 开始生成 RSS 摘要...');
  console.log(`⏰ 时间范围: 最近 ${hours} 小时`);

  const result = await runDigest({
    hours,
    sendEmail: !noEmail,
    onProgress: (msg) => console.log(`📥 ${msg}`)
  });

  console.log(`\n📊 订阅源 ${result.digest.feedCount} 个，新文章 ${result.digest.totalArticles} 篇`);
  console.log(`💾 摘要已保存: ${result.id}`);

  if (noEmail) {
    console.log('⏭️  跳过邮件发送（--no-email）');
  } else if (result.emailed) {
    console.log('✅ 邮件发送成功');
  } else if (result.emailError) {
    console.log(`⚠️  邮件未发送: ${result.emailError}`);
  }

  console.log('✨ 完成！');
}

main().catch((error) => {
  console.error('❌ 错误:', error);
  process.exit(1);
});
