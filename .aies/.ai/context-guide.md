# AI 开发上下文指南

> 不同开发场景需要给 AI 提供不同的上下文文件。
> 遵循「最小充分上下文」原则：给够参考但不过载。
>
> **本文件是通用模板，请根据具体项目补充场景。**

---

## 使用方法

AI 收到用户任务时，按任务类型对照本指南**主动读取**对应文件，不要等用户 @ 引入。

---

## 场景 1：新增 API / 接口 / 模块

**通用必读**：
- `.ai/index.md` → 定位同类代码
- `.aies/spec/architecture.md` → 分层约束
- `.aies/spec/code-style.md` → 代码风格

**按语言/框架补充**：
| 场景 | 必读文件 |
|------|---------|
| Go + Gin + GORM | router.go、同类 `api/*_api.go`、`service/*_service.go`、`model/*_model.go`、`entity/dto.go` |
| TypeScript + NestJS | `app.module.ts`、同类 `controller.ts`、`service.ts`、`entity.ts`、`dto.ts` |
| Python + FastAPI | `main.py`、同类 `routers/*.py`、`services/*.py`、`models/*.py`、`schemas/*.py` |

---

## 场景 2：修改现有功能

- `.ai/index.md` → 定位目标文件
- 目标文件本身
- 目标文件的直接调用方（单层即可）
- 相关 DTO/Model 定义

---

## 场景 3：新增数据模型 / 表

- 现有数据模型文件（保持风格一致）
- 迁移脚本模板
- DB 初始化/迁移工具配置

---

## 场景 4：新增中间件 / 拦截器 / 过滤器

- 现有同类中间件
- 路由/入口注册文件（了解挂载方式）

---

## 场景 5：修改配置

- 当前配置文件
- 配置结构定义（type / schema）
- 配置读取位置

---

## 场景 6：Bug 修复

- `.ai/index.md` → 快速定位
- `.ai/known-issues.md` → 检查是否已知问题
- 出问题的具体文件
- 该文件的调用链（向上 2 层）
- 相关测试文件（如有）

---

## 场景 7：重构 / 性能优化

- `.aies/spec/quality-gates.md` → 避免引入反模式
- 目标代码及其所有调用方
- 相关性能测试/基准测试

---

## 场景 8：Code Review / 代码审查

- `.ai/review-checklist.md` → 完整清单
- `.ai/index.md` → 定位待审查文件
- 待审查文件及其上下文

---

## 通用提示

1. **始终加载 Spec**：`.aies/spec/index.md` 由平台入口文件引导 AI 自动加载
2. **给一个参考范本**：AI 模仿现有代码比从零开始更一致
3. **明确说"参考 XXX 的风格"**：比详细描述规范更高效
4. **大改动先给索引**：附带 `.ai/index.md` 帮 AI 理解全局
5. **上下文不足时禁止猜测**：缺少关键文件必须先读取，不得凭空编写
