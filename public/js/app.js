// 从 URL 读取设置令牌 ?token=xxx
const SETTINGS_TOKEN = new URLSearchParams(location.search).get('token') || '';

// 简单的 fetch 封装，自动带上设置令牌
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (SETTINGS_TOKEN) headers['X-Settings-Token'] = SETTINGS_TOKEN;
  const res = await fetch(path, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`);
  return data;
}

function app() {
  return {
    tab: 'digests',
    settingsTab: 'generate',
    status: { emailConfigured: false, translationEnabled: false, settingsProtected: false, settingsUnlocked: false },
    toast: '',
    toastType: 'info',

    // 摘要
    digests: [],
    current: null,
    genHours: 24,
    genEmail: false,
    generating: false,

    // 源
    feeds: [],
    feedForm: { show: false, id: null, title: '', xmlUrl: '', htmlUrl: '', category: '', description: '' },

    // 调度
    schedules: [],
    scheduleForm: { show: false, id: null, name: '', cron: '0 8 * * *', hours: 24, sendEmail: true, enabled: true },

    async init() {
      try {
        this.status = await api('/api/status');
      } catch (e) { /* 忽略 */ }
      this.genEmail = this.status.emailConfigured;
      await this.loadDigests();
      // 默认打开最近一次生成的摘要（列表已按时间倒序）
      if (this.digests.length > 0) {
        await this.openDigest(this.digests[0].id);
      }
    },

    toggleSettings() {
      if (!this.status.settingsUnlocked) {
        this.notify('设置已锁定，请在地址后加 ?token=你的令牌 访问', 'error');
        return;
      }
      if (this.tab === 'settings') {
        this.tab = 'digests';
        return;
      }
      this.tab = 'settings';
      if (this.settingsTab === 'feeds') this.loadFeeds();
      else if (this.settingsTab === 'schedules') this.loadSchedules();
    },

    notify(msg, type = 'info') {
      this.toast = msg;
      this.toastType = type;
      setTimeout(() => { if (this.toast === msg) this.toast = ''; }, 4000);
    },

    fmtDate(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      return isNaN(d) ? iso : d.toLocaleString('zh-CN');
    },

    lastRunText(lr) {
      if (!lr) return '<span class="muted">从未运行</span>';
      const time = this.fmtDate(lr.at);
      if (lr.status === 'success') {
        let t = `<span class="ok">✓ ${time}</span> 文章 ${lr.totalArticles ?? '-'}`;
        if (lr.emailError) t += ` <span class="warn">(邮件: ${lr.emailError})</span>`;
        return t;
      }
      return `<span class="warn">✗ ${time} ${lr.error || ''}</span>`;
    },

    // ===== 摘要 =====
    async loadDigests() {
      try { this.digests = await api('/api/digests'); }
      catch (e) { this.notify(e.message, 'error'); }
    },
    async openDigest(id) {
      try { this.current = await api(`/api/digests/${id}`); }
      catch (e) { this.notify(e.message, 'error'); }
    },
    async generate() {
      this.generating = true;
      try {
        const r = await api('/api/digests/generate', {
          method: 'POST',
          body: { hours: this.genHours, sendEmail: this.genEmail }
        });
        let msg = `已生成：新文章 ${r.totalArticles} 篇`;
        if (r.emailed) msg += '，邮件已发送';
        else if (r.emailError) msg += `，邮件未发送(${r.emailError})`;
        // 翻译失败时明确告警（多为 key 无效/欠费）
        if (r.translationError) {
          this.notify(`⚠️ ${r.translationError}`, 'error');
        } else {
          this.notify(msg, 'success');
        }
        await this.loadDigests();
        await this.openDigest(r.id);
        this.tab = 'digests'; // 生成后跳回摘要页查看结果
      } catch (e) { this.notify(e.message, 'error'); }
      finally { this.generating = false; }
    },
    async removeDigest(id) {
      if (!confirm('确定删除这份摘要？')) return;
      try {
        await api(`/api/digests/${id}`, { method: 'DELETE' });
        if (this.current && this.current.id === id) this.current = null;
        await this.loadDigests();
      } catch (e) { this.notify(e.message, 'error'); }
    },

    // ===== 源 =====
    async loadFeeds() {
      try { this.feeds = await api('/api/feeds'); }
      catch (e) { this.notify(e.message, 'error'); }
    },
    openFeedForm(f) {
      this.feedForm = f
        ? { show: true, id: f.id, title: f.title, xmlUrl: f.xmlUrl, htmlUrl: f.htmlUrl, category: f.category, description: f.description || '' }
        : { show: true, id: null, title: '', xmlUrl: '', htmlUrl: '', category: '', description: '' };
    },
    async saveFeed() {
      const f = this.feedForm;
      if (!f.xmlUrl) { this.notify('RSS 地址必填', 'error'); return; }
      try {
        if (f.id) {
          await api(`/api/feeds/${f.id}`, { method: 'PUT', body: f });
        } else {
          await api('/api/feeds', { method: 'POST', body: f });
        }
        this.feedForm.show = false;
        this.notify('已保存', 'success');
        await this.loadFeeds();
      } catch (e) { this.notify(e.message, 'error'); }
    },
    async removeFeed(f) {
      if (!confirm(`删除源「${f.title}」？`)) return;
      try {
        await api(`/api/feeds/${f.id}`, { method: 'DELETE' });
        await this.loadFeeds();
      } catch (e) { this.notify(e.message, 'error'); }
    },

    // ===== 调度 =====
    async loadSchedules() {
      try { this.schedules = await api('/api/schedules'); }
      catch (e) { this.notify(e.message, 'error'); }
    },
    openScheduleForm(s) {
      this.scheduleForm = s
        ? { show: true, id: s.id, name: s.name, cron: s.cron, hours: s.hours, sendEmail: s.sendEmail, enabled: s.enabled }
        : { show: true, id: null, name: '', cron: '0 8 * * *', hours: 24, sendEmail: true, enabled: true };
    },
    async saveSchedule() {
      const s = this.scheduleForm;
      if (!s.cron) { this.notify('cron 表达式必填', 'error'); return; }
      try {
        if (s.id) {
          await api(`/api/schedules/${s.id}`, { method: 'PUT', body: s });
        } else {
          await api('/api/schedules', { method: 'POST', body: s });
        }
        this.scheduleForm.show = false;
        this.notify('已保存', 'success');
        await this.loadSchedules();
      } catch (e) { this.notify(e.message, 'error'); }
    },
    async removeSchedule(s) {
      if (!confirm(`删除任务「${s.name}」？`)) return;
      try {
        await api(`/api/schedules/${s.id}`, { method: 'DELETE' });
        await this.loadSchedules();
      } catch (e) { this.notify(e.message, 'error'); }
    },
    async runSchedule(s) {
      this.notify(`正在运行「${s.name}」…`, 'info');
      try {
        const lr = await api(`/api/schedules/${s.id}/run`, { method: 'POST' });
        this.notify(lr.status === 'success' ? '运行成功' : `运行失败: ${lr.error}`,
                    lr.status === 'success' ? 'success' : 'error');
        await this.loadSchedules();
        if (this.tab === 'digests') await this.loadDigests();
      } catch (e) { this.notify(e.message, 'error'); }
    }
  };
}
