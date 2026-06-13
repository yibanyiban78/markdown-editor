# 极简Markdown编辑器

一款轻量、快速、所见即所得的桌面 Markdown 编辑器，基于 Electron 构建。

## 功能特性

- **三种编辑模式**：预览模式、双栏模式（源码+预览同步滚动）、源码模式
- **实时 Markdown 渲染**：基于 marked 解析，支持 GFM 标准语法
- **语法高亮**：基于 highlight.js，支持 190+ 编程语言
- **数学公式**：支持 KaTeX 行内公式 `$...$` 和独立公式 `$$...$$`
- **图表支持**：集成 Mermaid，支持流程图、时序图、甘特图等
- **文件管理**：打开/新建/保存文件，支持拖拽打开 .md 文件
- **自动保存**：修改后 1.5 秒自动存盘（可在设置中关闭）
- **搜索功能**：支持全文搜索、匹配高亮、上下跳转，兼容中文输入法
- **文档导出**：支持导出为 HTML 和 PDF 格式
- **大纲面板**：自动提取 H1-H3 标题生成目录，点击可跳转
- **深色/浅色主题**：一键切换，自动记住偏好
- **字体调节**：编辑器字号可调（11px–24px）
- **字数统计**：实时显示中文字数和总字符数
- **文件关联**：支持从命令行打开 .md 文件，支持文件关联单实例复用
- **键盘快捷键**：Ctrl+N/O/S/F 等常用快捷键

## 开始使用

### 下载安装

从 [Releases 页面](https://github.com/yibanyiban78/markdown-editor/releases) 下载最新版本的安装包或便携版：

- **安装版**（推荐）：`极简Markdown编辑器-v版本号.exe`，双击安装，会创建桌面快捷方式和开始菜单
- **便携版**（Portable）：`极简Markdown编辑器-v版本号-portable.exe`，解压即用，无需安装

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

> **提示**：GitHub Actions 已配置自动构建。推送 `v*` 标签（如 `v1.0.0`）到 GitHub 后，Actions 会自动编译并发布到 Releases 页面，用户可直接下载安装包。

## 项目结构

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

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl + N | 新建文件 |
| Ctrl + O | 打开文件 |
| Ctrl + S | 保存文件 |
| Ctrl + F | 搜索 |
| Ctrl + Shift + O | 切换大纲面板 |
| Escape | 关闭搜索栏 |

## 技术栈

- **Electron 28** — 桌面应用框架
- **marked** — Markdown 解析
- **highlight.js** — 代码语法高亮
- **KaTeX** — 数学公式渲染
- **Mermaid** — 图表渲染
- **rcedit** — Windows 可执行文件图标设置

## 许可证

[MIT](LICENSE)
