const ThemeManager = {
  currentTheme: 'light',

  init() {
    const saved = localStorage.getItem('theme');
    // 立即恢复保存的主题（不等待 DOMContentLoaded）
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
      this.currentTheme = 'dark';
    }

    document.addEventListener('DOMContentLoaded', () => {
      const btn = document.getElementById('btn-theme');
      btn.textContent = this.currentTheme === 'dark' ? '☀️' : '🌙';
      btn.title = this.currentTheme === 'dark' ? '切换浅色' : '切换深色';
      btn.addEventListener('click', () => this.toggle());
    });
  },

  setTheme(theme) {
    this.currentTheme = theme;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
    const btn = document.getElementById('btn-theme');
    if (btn) {
      btn.textContent = theme === 'dark' ? '☀️' : '🌙';
      btn.title = theme === 'dark' ? '切换浅色' : '切换深色';
    }
  },

  toggle() {
    this.setTheme(this.currentTheme === 'light' ? 'dark' : 'light');
  }
};

// 立即执行，在 DOM 解析前恢复主题
ThemeManager.init();
