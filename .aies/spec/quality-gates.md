# 质量门规范

> 代码合并前的质量标准。**不符合者不能合并**。

---

## 提交前必过项

### 编译 / 类型检查

- [ ] 项目主构建命令通过（`go build` / `tsc` / `python -m py_compile` 等）
- [ ] 无类型错误
- [ ] 无未使用的 import

### Lint / 格式化

- [ ] 项目 lint 工具通过
- [ ] 代码已格式化（gofmt / prettier / black 等）

### 测试

- [ ] 相关单元测试通过
- [ ] 新增代码有基本测试覆盖（核心路径）
- [ ] 测试不依赖外部环境（DB/网络 → 用 mock）

### 文档

- [ ] 新增/修改的 API 有文档（Swagger / JSDoc / docstring）
- [ ] `.ai/index.md` 已更新（如涉及路由/模型/文件变更）
- [ ] 复杂决策有注释说明

---

## 质量自检清单

参照 `.ai/review-checklist.md` 逐项检查。

---

## 禁止合并的情况

- ❌ 编译/类型/lint 不通过
- ❌ 跳过 Hooks 提交（`--no-verify`）
- ❌ 包含 `TODO: fixme before merge` 等临时标记
- ❌ commit message 不符合规范
- ❌ `.ai/index.md` 与实际代码不一致
- ❌ AI 生成代码但未标注 `[ai-assisted]`

---

## 特殊情况处理

### 紧急修复（hotfix）

允许跳过部分质量门，但必须：
- [ ] commit message 注明 `[hotfix]`
- [ ] 次日补齐文档和测试
- [ ] 在 `.ai/changelog.md` 标红记录

### 重构（refactor）

重构必须：
- [ ] 不改变外部行为
- [ ] 保留原有测试全部通过
- [ ] 单次重构只做一件事

### 实验性功能

允许质量降级，但必须：
- [ ] feature flag 控制
- [ ] 默认关闭
- [ ] 文档注明「实验性，不保证稳定」

---

## 项目特定质量门

TODO: 各项目补充特有的质量要求，如：
- 性能基准（接口 P99 < 100ms）
- 测试覆盖率阈值
- 安全扫描（SAST/DAST）
