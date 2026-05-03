# 修复: 文件树未同步更新已删除/移动的文件

## Bug 描述

**现象**: 从 VSCode 删除或移动文件后,在 App 中仍显示原文件,点击报错 "ENOENT: no such file or directory"。

**根因分析**:
- 文件树刷新机制不完善
- 删除文件后,App 中的 file cache 和编辑器列表未清理
- 持久化的 editors 数据未同步更新

## 技术方案

需要修改的文件:
- `src/components/ProjectList.vue` - `handleRefreshDirectory` 方法需增强
- `src/store/AppBusiness.ts` - 添加清理不存在文件的逻辑

### 1. 增强 `handleRefreshDirectory`

```javascript
handleRefreshDirectory(dirPath: string) {
  // 触发目录树重新加载
  const currentExpanded = this.expandedId
  this.expandedId = null
  this.$nextTick(() => {
    this.expandedId = currentExpanded
  })
  
  // 清理已不存在的编辑器
  this.cleanupInvalidEditors()
}
```

### 2. 添加 `cleanupInvalidEditors` 方法

在 `AppBusiness.ts` 中添加方法,检查所有编辑器路径是否仍然存在,不存在则关闭。

## 验证方式

1. 在 VSCode 中删除一个在 App 中打开的文件
2. 返回 App,文件树仍显示该文件
3. 点击时报错 "读取文件失败: Error: ENOENT..."
4. 预期: 手动刷新后文件树正确更新,不再显示已删除文件