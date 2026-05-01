# 验收与测试：Activity Bar + 可折叠侧边面板

> ⚠️ 本文件必须在 implement 阶段开始前填写完毕。

## P0 验收场景

| # | 场景 | 输入 | 期望结果 |
|---|------|------|--------|
| AC-01 | Activity Bar 显示 | 打开 App | 左侧 48px Activity Bar 可见，所有图标正常显示 |
| AC-02 | 点击图标展开面板 | 点击文件浏览器图标 | Sidebar 展开 260px，显示项目列表 |
| AC-03 | 切换面板 | 点击 Terminal 图标 | Sidebar 内容切换为终端列表，宽度不变 |
| AC-04 | 点击内容区折叠 | 展开 Sidebar 后点击 Main Content | Sidebar 折叠，Main Content 占满全屏 |
| AC-05 | 全局 Toggle 按钮 | 点击 Activity Bar 上的折叠按钮 | Sidebar 折叠/展开切换 |

## 验收通过标准

- [ ] 所有 P0 场景通过
- [ ] Playwright E2E 测试覆盖 AC-01, AC-04
