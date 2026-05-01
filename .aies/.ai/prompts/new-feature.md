# Prompt 模板：新增功能 / API / 模块

## 适用场景

需要为项目新增功能时使用。适用于 API 接口、新业务模块、新页面、新命令等。

---

## 使用方法

复制以下模板，替换 `{实体名}` 和 `{操作}` 后发给 AI。

---

## 模板

```
我需要在 {{PROJECT_NAME}} 项目中新增 {实体名} 的 {操作} 功能。

## 需求描述
{简要描述业务需求}

## 技术要求
{列出特殊要求，如：需要事务、需要幂等、需要鉴权}

## 参考文件（AI 自行读取）
请按 `.ai/context-guide.md` 的「场景 1：新增功能」读取对应参考文件。

## 执行流程
1. 输出 Phase 1 任务启动清单（包括：任务类型、参考文件、规范要点、预计变更文件、索引是否需要更新）
2. 读取参考文件
3. 按项目架构分层生成代码
4. 输出 Phase 3 任务完成清单（质量自检 + 索引更新 + commit message 建议）
5. 如有新发现的约定，提醒我沉淀到 `.aies/spec/`
```

---

## 示例

```
我需要在 agent-manage-backend 项目中新增 Workspace 的 CRUD 功能。

## 需求描述
- Workspace 有 name、description、owner、status 字段
- 支持创建、查询、更新、删除、分页列表
- 每个 Workspace 可以关联多个 Agent

## 技术要求
- 创建时检查 name 唯一性
- 删除时级联处理关联的 Agent
- status 使用枚举：draft/active/inactive/archived

## 参考文件
请按 context-guide.md 场景 1 读取相关文件

## 执行流程
按 Phase 1/2/3 协议执行
```

---

## 检查点（AI 必须做到）

- [ ] 输出了 Phase 1 清单
- [ ] 读取了 `.ai/context-guide.md` 指定的参考文件
- [ ] 遵循了 `.aies/spec/architecture.md` 的分层
- [ ] 生成了结构化字段注释
- [ ] 使用了项目统一的错误处理/响应封装
- [ ] 更新了 `.ai/index.md`
- [ ] 输出了 Phase 3 清单
