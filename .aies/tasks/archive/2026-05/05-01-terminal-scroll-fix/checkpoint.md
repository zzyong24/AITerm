# Checkpoint: 修复终端滚动卡顿

## 当前状态

- **阶段**：✅ COMPLETED
- **最后更新**：2026-05-01 20:09:47

## 实现亮点
1. **WebGL 渲染**：替代默认 Canvas，显著提升滚动性能
2. **智能检测**：自动识别等待确认/密码/选择等交互场景
3. **Prompt 检测**：通过 prompt 模式判断命令是否执行完成
4. **状态机**：hasOutputSinceInput + detectedWaiting 跟踪交互状态

## 状态跟踪变量
```typescript
detectedWaiting: boolean     // 是否已检测到需要干预的状态
hasOutputSinceInput: boolean // 用户输入后是否有新输出
hasCommandOutput: boolean   // 是否有实质命令输出
```

## 修改文件
- `src/components/Terminal.vue` — 核心实现

## 已知问题
- WebGL fallback 尚未测试
- prompt 误判可能性
- 缺少 E2E 测试
