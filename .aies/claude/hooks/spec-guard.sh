#!/bin/bash
# spec-guard: 在写业务源码前检查规范文件是否存在
# 触发：PreToolUse Write|Edit
# 逻辑：目标文件是源码 → 找项目根（.git 目录）→ 检查 .aies/spec 或 .ai 是否存在且非空
#
# 通过：.aies/spec/ 或 .aies/ 或 .ai/ 存在且非空
# 拦截：上述目录均不存在或为空

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

[ -z "$FILE_PATH" ] && exit 0

# 白名单：spec/doc/config 类路径直接放行
if echo "$FILE_PATH" | grep -qE '(\.aies|\.ai/|/docs/|/doc/|CLAUDE\.md|\.claude/|settings\.json)'; then
  exit 0
fi

# 只拦截业务源码扩展名
if ! echo "$FILE_PATH" | grep -qE '\.(go|py|ts|tsx|js|jsx|java|rs|cpp|c|h)$'; then
  exit 0
fi

# 从文件路径往上找 project root（含 .git 的目录）
find_project_root() {
  local dir="$1"
  while [ "$dir" != "/" ]; do
    [ -d "$dir/.git" ] && echo "$dir" && return
    dir=$(dirname "$dir")
  done
  echo ""
}

PROJECT_ROOT=$(find_project_root "$(dirname "$FILE_PATH")")
[ -z "$PROJECT_ROOT" ] && PROJECT_ROOT=$(pwd)

# 检查 spec 目录（.aies/spec > .aies > .ai，任一存在且非空即通过）
SPEC_OK=false
for dir in ".aies/spec" ".aies" ".ai"; do
  full="$PROJECT_ROOT/$dir"
  if [ -d "$full" ] && [ -n "$(ls -A "$full" 2>/dev/null)" ]; then
    SPEC_OK=true
    break
  fi
done

if [ "$SPEC_OK" = "false" ]; then
  printf '{"decision":"block","reason":"⛔ 请先完成规范文件（.aies/spec/）再开始写业务代码\n\n目标文件: %s\n\n操作步骤：\n1. 先在 .aies/spec/ 目录创建需求和规范文件\n2. 规范补全后再编写业务代码"}' "$FILE_PATH"
  exit 0
fi

exit 0
