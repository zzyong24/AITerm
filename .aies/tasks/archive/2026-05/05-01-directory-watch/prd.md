# 修复目录树文件监听

## 需求背景

左侧项目目录栏（DirectoryTree）无法及时反映文件的实时变化。用户通过终端/git/其他工具创建、删除或重命名文件后，目录栏不会自动刷新，必须手动右键 → 刷新。

根本原因：DirectoryTree 只有初始加载逻辑，缺少文件监听机制。

## 核心目标

- 目录树能自动感知文件系统的变化（创建/删除/重命名/移动）
- 变化后自动刷新对应目录节点，无须用户手动操作
- 保持良好的性能，不影响大目录的展开速度

## 技术方案（草稿）

### 方案选择：chokidar（跨平台文件监听库）

**备选方案对比**：
| 方案 | 优点 | 缺点 |
|------|------|------|
| chokidar | 跨平台、API 简洁、Electron 兼容性好 | 需 npm 引入 |
| fs.watch (Node) | 原生无需引入 | macOS/\. folders 兼容性差 |
| Electron ipc | 可监听主进程文件系统 | 需主进程配合，IPC 开销 |

**最终选择**：chokidar（`readDirectoryBatch` 调用链在 Electron 主进程已有文件操作，直接在主进程服务层接入监听更合理）

### 实现路径

1. **主进程层**（`electron/services/FileService.ts` 或新建 `WatcherService.ts`）：
   - 对每个打开的项目目录启动 chokidar watcher
   - 监听 `add`/`unlink`/`change`/`addDir`/`unlinkDir` 事件
   - 通过 IPC 通知前端

2. **前端 DirectoryTree**：
   - 接收 watcher 事件通知
   - 精确定位到变化的目录节点，局部更新（insert/remove 节点）
   - 若变化节点未展开则忽略（下次展开时自然加载最新数据）

3. **与 AppBusiness 解耦**：
   - DirectoryTree 直接订阅 IPC 事件，不走 EventBus（避免污染业务层）

### 影响范围

- 修改文件：
  - `electron/services/FileService.ts` — 新增 watcher 管理
  - `src/components/DirectoryTree.vue` — 接收变化事件，局部更新 treeData
  - `src/api/electron-ipc.ts` — 新增 watcher 相关的 IPC 通道
- 新增文件：
  - `electron/services/WatcherService.ts` — chokidar 封装（如独立）

## 🤔 Agent 的不确定点

1. **是否需要监听重命名和移动？** 这类事件在 chokidar 中表现为 `unlink` + `add` 组合，是否需要合并处理避免两次 UI 更新？
2. **Electron IPC 通道**：`src/api/electron-ipc.ts` 中是否已有类似的 IPC 通道定义？需要先确认现有模式
3. **多项目监听**：多个项目同时展开时，是否需要为每个项目独立启动 watcher？如何管理生命周期（避免 watcher 泄漏）？
