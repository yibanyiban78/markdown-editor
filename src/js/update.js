const UpdateManager = {
  activeDialog: null,
  lastShownVersion: null,

  init() {
    const updateButton = document.getElementById('btn-update');
    if (updateButton) {
      updateButton.addEventListener('click', () => this.checkNow());
    }

    if (!window.electronAPI || !window.electronAPI.onUpdateStatus) return;
    window.electronAPI.onUpdateStatus((state) => this.handleStatus(state));
    window.electronAPI.getUpdateStatus?.().then((state) => this.handleStatus(state));
  },

  async checkNow() {
    if (!window.electronAPI || !window.electronAPI.checkForUpdates) {
      this.showMessage('当前环境不支持自动更新。');
      return;
    }

    Editor.showStatus('正在检查更新...');
    const state = await window.electronAPI.checkForUpdates({ manual: true });
    this.handleStatus(state);
  },

  handleStatus(state) {
    if (!state || !state.status) return;

    if (state.status === 'checking') {
      Editor.showStatus('正在检查更新...');
      return;
    }

    if (state.status === 'disabled') {
      if (state.manual) this.showMessage('自动更新仅在安装后的正式版本中可用。');
      return;
    }

    if (state.status === 'not-available') {
      if (state.manual) this.showMessage(`当前已是最新版本：v${state.version}`);
      else Editor.showStatus('已是最新版本');
      return;
    }

    if (state.status === 'available') {
      const version = state.updateInfo?.version || '新版本';
      if (!state.manual && this.lastShownVersion === version) return;
      this.lastShownVersion = version;
      this.showAvailableDialog(state);
      return;
    }

    if (state.status === 'downloading') {
      const percent = state.progress?.percent ?? 0;
      Editor.showStatus(`正在下载更新... ${percent}%`);
      return;
    }

    if (state.status === 'downloaded') {
      this.showDownloadedDialog(state);
      return;
    }

    if (state.status === 'error') {
      const message = state.error || '更新检查失败';
      if (state.manual) this.showMessage(message);
      else Editor.showStatus('更新检查失败');
    }
  },

  closeDialog() {
    if (this.activeDialog) {
      this.activeDialog.remove();
      this.activeDialog = null;
    }
  },

  createDialog(title, description) {
    this.closeDialog();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'modal';

    const heading = document.createElement('h2');
    heading.textContent = title;
    modal.appendChild(heading);

    if (description) {
      const paragraph = document.createElement('p');
      paragraph.className = 'modal-description';
      paragraph.textContent = description;
      modal.appendChild(paragraph);
    }

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) this.closeDialog();
    });

    this.activeDialog = overlay;
    return { overlay, modal };
  },

  normalizeReleaseNotes(notes) {
    if (!notes) return '';
    if (Array.isArray(notes)) {
      return notes.map((item) => {
        if (typeof item === 'string') return item;
        return item?.note || item?.version || '';
      }).filter(Boolean).join('\n\n');
    }
    return String(notes);
  },

  appendReleaseNotes(modal, notes) {
    const text = this.normalizeReleaseNotes(notes).trim();
    if (!text) return;

    const details = document.createElement('pre');
    details.className = 'update-notes';
    details.textContent = text.length > 2000 ? `${text.slice(0, 2000)}\n...` : text;
    modal.appendChild(details);
  },

  appendActions(modal, actions) {
    const container = document.createElement('div');
    container.className = 'modal-actions';
    for (const action of actions) {
      const button = document.createElement('button');
      button.textContent = action.label;
      if (action.primary) button.className = 'btn-primary';
      button.addEventListener('click', action.onClick);
      container.appendChild(button);
    }
    modal.appendChild(container);
  },

  showAvailableDialog(state) {
    const info = state.updateInfo || {};
    const version = info.version ? `v${info.version}` : '新版本';
    const { modal } = this.createDialog(
      `发现 ${version}`,
      '可以现在下载更新。下载完成后，应用会询问是否重启安装。'
    );

    this.appendReleaseNotes(modal, info.releaseNotes);
    this.appendActions(modal, [
      {
        label: '下载更新',
        primary: true,
        onClick: async () => {
          this.closeDialog();
          Editor.showStatus('开始下载更新...');
          await window.electronAPI.downloadUpdate();
        }
      },
      {
        label: '稍后',
        onClick: () => this.closeDialog()
      }
    ]);
  },

  showDownloadedDialog(state) {
    const version = state.updateInfo?.version ? `v${state.updateInfo.version}` : '新版本';
    const { modal } = this.createDialog(
      `${version} 已下载`,
      '重启应用后会安装更新。安装前会先处理当前文档的未保存修改。'
    );

    this.appendActions(modal, [
      {
        label: '重启并安装',
        primary: true,
        onClick: async () => {
          if (!await Editor.prepareToReplaceDocument('安装更新并重启应用')) return;
          this.closeDialog();
          await window.electronAPI.installUpdate();
        }
      },
      {
        label: '稍后',
        onClick: () => this.closeDialog()
      }
    ]);
  },

  showMessage(message) {
    const { modal } = this.createDialog('检查更新', message);
    this.appendActions(modal, [
      {
        label: '知道了',
        primary: true,
        onClick: () => this.closeDialog()
      }
    ]);
  }
};
