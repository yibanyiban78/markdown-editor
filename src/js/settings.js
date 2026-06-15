const SettingsManager = {
  outlinePosition: 'right', // 'left' | 'right'

  init() {
    // 加载保存的大纲位置
    const saved = localStorage.getItem('editorSettings');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        this.outlinePosition = settings.outlinePosition || 'right';
      } catch(e) {}
    }
    this.applyOutlinePosition();

    document.getElementById('btn-settings').addEventListener('click', () => this.showSettings());
  },

  applyOutlinePosition() {
    const container = document.getElementById('main-container');
    if (this.outlinePosition === 'left') {
      container.classList.add('outline-left');
    } else {
      container.classList.remove('outline-left');
    }
  },

  showSettings() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'settings-modal';
    overlay.innerHTML = `
      <div class="modal">
        <h2>⚙️ 设置</h2>

        <label style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <input type="checkbox" id="setting-autosave" ${Editor.autoSaveEnabled ? 'checked' : ''}>
          自动保存（修改后 1.5 秒自动存盘）
        </label>

        <div style="margin-bottom:12px;">
          <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:4px;">大纲面板位置</label>
          <label style="display:inline-flex;align-items:center;gap:6px;margin-right:16px;cursor:pointer;">
            <input type="radio" name="outline-pos" value="right" ${this.outlinePosition === 'right' ? 'checked' : ''}>
            右侧
          </label>
          <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
            <input type="radio" name="outline-pos" value="left" ${this.outlinePosition === 'left' ? 'checked' : ''}>
            左侧
          </label>
        </div>

        <div class="modal-actions">
          <button class="btn-primary" id="settings-save">保存</button>
          <button id="settings-cancel">取消</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('settings-save').addEventListener('click', () => {
      const autoSave = document.getElementById('setting-autosave').checked;
      const outlinePos = overlay.querySelector('input[name="outline-pos"]:checked').value;

      Editor.autoSaveEnabled = autoSave;
      Editor.updateSaveButtonVisibility();
      if (autoSave) {
        Editor.scheduleAutoSave();
      } else {
        clearTimeout(Editor.autoSaveTimer);
        Editor.autoSaveTimer = null;
      }

      this.outlinePosition = outlinePos;
      this.applyOutlinePosition();

      // 合并保存所有设置
      const existing = localStorage.getItem('editorSettings');
      let settings = {};
      try {
        settings = existing ? JSON.parse(existing) : {};
      } catch {
        settings = {};
      }
      settings.autoSave = autoSave;
      settings.outlinePosition = outlinePos;
      localStorage.setItem('editorSettings', JSON.stringify(settings));

      document.body.removeChild(overlay);
      document.getElementById('status-text').textContent = '设置已保存';
      setTimeout(() => { document.getElementById('status-text').textContent = '就绪'; }, 2000);
    });

    document.getElementById('settings-cancel').addEventListener('click', () => {
      document.body.removeChild(overlay);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) document.body.removeChild(overlay);
    });
  }
};
