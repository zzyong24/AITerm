# 验收标准：修复终端滚动卡顿

## P0 验收场景（必须全部通过）

| # | 场景描述 | 输入条件 | 期望结果 |
|---|---------|---------|---------|
| AC-01 | 终端使用 WebGL 渲染 | 打开终端，观察渲染模式 | 使用 WebGLAddon 渲染（可通过 devtools 检查） |
| AC-02 | 大文件输出时滚动流畅 | 在终端执行 `ls -laR /` 或类似大量输出命令 | 滚动无明显卡顿，60fps |
| AC-03 | 等待确认提醒 | 执行 `rm -i file` 触发 `[y/N]` | ActivityPanel 显示"等待确认"提醒 |
| AC-04 | 等待密码提醒 | 执行需要密码的命令 | ActivityPanel 显示"等待密码"提醒 |
| AC-05 | 命令失败提醒 | 执行 `ls /nonexistent` | ActivityPanel 显示"文件不存在"或类似提醒 |
| AC-06 | Prompt 检测命令完成 | 执行一个正常命令（如 `echo hello`）后 | 检测到 prompt，自动标记"等待下一条指令" |
| AC-07 | 用户输入后清除提醒 | 在 AC-03/04/05 状态后输入 `y` 或密码并回车 | ActivityPanel 清除干预提醒 |
| AC-08 | WebGL 失败时 graceful fallback | 模拟 WebGL 不可用环境 | 终端仍可使用 Canvas 渲染正常工作 |

## P1 验收场景（尽量通过）

| # | 场景描述 | 输入条件 | 期望结果 |
|---|---------|---------|---------|
| AC-09 | Claude UI prompt 检测 | 在 Claude session 中执行命令 | 正确识别 ❯ prompt，不误判 |
| AC-10 | zsh prompt 检测 | zsh 环境下执行命令 | 正确识别 % prompt |

## 验收通过标准

- [ ] 所有 P0 场景通过
- [ ] 无回归：原有终端功能正常（输入、输出、滚动、history）
