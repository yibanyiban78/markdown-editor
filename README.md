# 极简Markdown编辑器

<p align="center">
  <img src="assets/icon.png" alt="极简Markdown编辑器" width="100">
</p>

<p align="center">
  <strong>一款轻量、快速、所见即所得的桌面 Markdown 编辑器</strong>
  <br>
  基于 Electron · 开源免费 · 支持 Mermaid / KaTeX / 代码高亮
</p>

<p align="center">
  <a href="https://github.com/yibanyiban78/markdown-editor/releases/latest">
    <img src="https://img.shields.io/github/v/release/yibanyiban78/markdown-editor?style=flat-square&label=最新版本" alt="最新版本">
  </a>
  <a href="https://github.com/yibanyiban78/markdown-editor/releases">
    <img src="https://img.shields.io/github/downloads/yibanyiban78/markdown-editor/total?style=flat-square&label=下载次数" alt="下载">
  </a>
  <a href="https://github.com/yibanyiban78/markdown-editor/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="MIT License">
  </a>
</p>

---

## 📸 预览

> *（截图待补充 — 可以用截图工具截取软件界面后放入 `assets/screenshot.png`）*

| 预览模式 | 双栏编辑模式 |
|:--------:|:-----------:|
| ![](assets/screenshot-preview.png) | ![](assets/screenshot-split.png) |

*按住 Ctrl+O 打开 .md 文件，即刻开始编辑。*

---

## ✨ 功能特性

### 编辑体验
- **三种编辑模式**：预览模式、双栏模式（源码+预览同步滚动）、源码模式
- **实时 Markdown 渲染**：基于 marked 解析，支持 GFM 标准语法
- **语法高亮**：基于 highlight.js，支持 190+ 编程语言
- **数学公式**：支持 KaTeX 行内公式 `$...$` 和独立公式 `$$...$$`
- **图表支持**：集成 Mermaid，支持流程图、时序图、甘特图等

### 文件管理
- **打开/新建/保存**：支持 .md/.markdown/.txt 文件
- **拖拽打开**：将文件拖入窗口即可
- **自动保存**：修改后 1.5 秒自动存盘（可在设置中关闭）
- **搜索功能**：支持全文搜索、匹配高亮、上下跳转

### 导出分享
- **导出 HTML**：生成完整网页文件，底部附带来源信息
- **导出 PDF**：通过浏览器打印功能导出

### 界面
- **深色/浅色主题**：一键切换，自动记住偏好
- **大纲面板**：自动提取 H1-H3 标题生成目录，点击跳转
- **字体调节**：编辑器字号可调（11px–24px）
- **字数统计**：实时显示中文字数和总字符数
- **键盘快捷键**：Ctrl+N/O/S/F 等常用快捷键

---

## 🚀 开始使用

### 下载安装

从 [Releases 页面](https://github.com/yibanyiban78/markdown-editor/releases) 下载最新版本的安装包或便携版：

| 文件 | 说明 |
|------|------|
| `极简Markdown编辑器-v版本号-setup.exe` | **安装版**（推荐）— 双击安装，创建桌面快捷方式 |
| `极简Markdown编辑器-v版本号-portable.exe` | **便携版** — 解压即用，无需安装 |

### 从源码构建

#### 环境要求

- [Node.js](https://nodejs.org/) >= 18
- npm

#### 安装

```bash
# 克隆项目
git clone https://github.com/yibanyiban78/markdown-editor.git
cd markdown-editor

# 安装依赖
npm install

# 启动开发模式
npm start
```

### 构建可执行文件

```bash
# 方式一：build.ps1（手动构建，国内网络友好）
# 在 PowerShell 中执行：
.\build.ps1

# 方式二：electron-builder
npm run dist
```

构建产物位于 `release/` 目录。

> **提示**：GitHub Actions 已配置自动构建。推送 `v*` 标签（如 `v1.0.1`）到 GitHub 后，Actions 会自动编译并发布到 Releases 页面，用户可直接下载安装包。

---

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl + N | 新建文件 |
| Ctrl + O | 打开文件 |
| Ctrl + S | 保存文件 |
| Ctrl + F | 搜索 |
| Ctrl + Shift + O | 切换大纲面板 |
| Escape | 关闭搜索栏 |

---

## 📦 项目结构

```
markdown-editor/
├── main.js              # Electron 主进程
├── preload.js           # 预加载脚本（安全上下文桥接）
├── package.json         # 项目配置
├── build.ps1            # 构建脚本
├── assets/
│   ├── icon.png         # 应用图标（透明背景）
│   └── icon.ico         # Windows 图标文件
└── src/
    ├── index.html       # 应用入口页面
    ├── js/
    │   ├── app.js       # 应用初始化、快捷键、拖拽
    │   ├── editor.js    # 编辑器核心逻辑
    │   ├── preview.js   # Markdown 渲染器
    │   ├── theme.js     # 主题切换
    │   ├── search.js    # 搜索功能
    │   ├── outline.js   # 大纲面板
    │   ├── export.js    # 导出功能
    │   └── settings.js  # 设置面板
    └── styles/
        ├── theme.css    # CSS 变量（主题色定义）
        ├── main.css     # 主样式
        └── editor.css   # Markdown 渲染样式
```

---

## 🛠 技术栈

| 技术 | 用途 |
|------|------|
| Electron 28 | 桌面应用框架 |
| marked | Markdown 解析引擎 |
| highlight.js | 代码语法高亮（190+ 语言） |
| KaTeX | 数学公式渲染 |
| Mermaid | 图表渲染（流程图/时序图/甘特图） |
| electron-builder | 应用打包与分发 |

---

## ⭐ 支持项目

如果你觉得这个工具有用，欢迎：

- **Star** ⭐ 本仓库 — 让更多人发现它
- **Fork** 🍴 并提交 Pull Request — 一起改进
- **分享** 📢 给你的朋友和同事
- **反馈** 💬 提交 [Issue](https://github.com/yibanyiban78/markdown-editor/issues) 报告问题或建议

---

## 📄 许可证

[MIT](LICENSE) © yibanyiban78
