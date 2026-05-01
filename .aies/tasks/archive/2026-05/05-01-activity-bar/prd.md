# Activity Bar + 可折叠侧边面板

## 需求背景
将左侧项目栏改造成 VS Code 风格的 Activity Bar + 可折叠 Sidebar，提供更高效的空间利用和更现代的 UI 体验。

## 布局结构

```
┌────┬────────────────┬──────────────────────────────┐
│ AB │    Sidebar    │       Main Content           │
│    │  (可折叠)      │   (Terminal/Editor 全屏)     │
│ 🗂 │  项目列表       │                              │
│ ⌨️ │  搜索面板       │                              │
│ 📄 │  Kill Port    │                              │
│ ⚙️ │  设置面板      │                              │
└────┴────────────────┴──────────────────────────────┘

AB = Activity Bar (固定宽度 48px，始终显示)
Sidebar = 可折叠侧边栏 (默认折叠，展开时 260px)
Main Content = Terminal/Editor 区域 (全屏展示)
```

## Activity Bar 图标

| 图标 | 功能 | 说明 |
|------|------|------|
| 🗂 | 文件浏览器 | 显示项目列表，等同当前左侧项目栏 |
| ⌨️ | Terminal | 显示终端列表 |
| 🔍 | 搜索 | 全局搜索面板 |
| ⚙️ | 设置 | 设置面板 |

## 交互逻辑

### Sidebar 折叠/展开
- Sidebar 默认折叠（宽度 0），仅 Activity Bar 可见
- 点击 Activity Bar 图标 → 展开对应 Sidebar 面板（260px 宽）
- 点击其他 Activity Bar 图标 → 切换 Sidebar 内容（保持展开）
- 点击 Main Content 区域 → 折叠 Sidebar（全屏 Terminal/Editor）
- 展开状态下点击同一图标 → 折叠 Sidebar

### 全局 Toggle 按钮
- 保留当前的 sidebar toggle 按钮逻辑（点击切换展开/折叠）
- Activity Bar 始终显示，不受折叠影响

## UI 约束

- Activity Bar 宽度：48px，图标居中
- Sidebar 宽度：260px（与当前 sidebarWidth 一致）
- Sidebar 折叠/展开动画：200ms ease
- Main Content 在 Sidebar 展开时自动缩窄，折叠时占满全屏

## 技术方案

### 文件结构
- 新建 `src/components/ActivityBar.vue` — Activity Bar 组件
- 修改 `src/App.vue` — 集成 Activity Bar，调整布局
- 修改 `src/components/ProjectList.vue` — 迁移到 Sidebar 面板
- 修改 `src/components/Sidebar.vue`（如需新建或重构）

### 状态管理
- AppBusiness 新增 `sidebarVisible` + `activeSidebarPanel` 状态
- `sidebarVisible`: boolean — Sidebar 是否展开
- `activeSidebarPanel`: 'explorer' | 'terminal' | 'search' | 'settings' — 当前面板

### 布局实现
- 使用 CSS Flexbox 实现三栏布局
- Sidebar 用 `width: 0` + `overflow: hidden` 实现折叠效果（而非 `display: none`，保留动画）

## 依赖
- 纯 UI 改造，无新依赖

## 验收标准

| # | 场景 | 输入 | 期望结果 |
|---|------|------|--------|
| AC-01 | Activity Bar 显示 | 打开 App | 左侧 48px Activity Bar 可见，所有图标正常显示 |
| AC-02 | 点击图标展开面板 | 点击文件浏览器图标 | Sidebar 展开 260px，显示项目列表 |
| AC-03 | 切换面板 | 点击 Terminal 图标 | Sidebar 内容切换为终端列表，宽度不变 |
| AC-04 | 点击内容区折叠 | 展开 Sidebar 后点击 Main Content | Sidebar 折叠，Main Content 占满全屏 |
| AC-05 | 全局 Toggle 按钮 | 点击 Activity Bar 上的折叠按钮 | Sidebar 折叠/展开切换 |

## 待确认

- [x] Kill Port 按钮放在 Activity Bar（只挪位置，后续优化）
- [x] 搜索面板：只搜索文件，保持不变
- [x] Sidebar 宽度拖拽：已实现，隐藏拖拽手柄
