#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Claude Code SessionStart Hook — 自动注入 AIES 上下文，检测初始化状态
"""

import json
import os
import subprocess
import sys
from io import StringIO
from pathlib import Path


def read_file(path: Path, fallback: str = "") -> str:
    try:
        return path.read_text(encoding="utf-8")
    except (FileNotFoundError, PermissionError):
        return fallback


def run_script(script: Path) -> str:
    if not script.is_file():
        return ""
    try:
        result = subprocess.run(
            [sys.executable, str(script), "get-context"],
            capture_output=True, text=True, encoding="utf-8",
            errors="replace", timeout=5,
            cwd=script.parent.parent.parent,
        )
        return result.stdout if result.returncode == 0 else ""
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return ""


def detect_language(project_dir: Path) -> str:
    """检测项目语言栈"""
    if (project_dir / "go.mod").exists():
        return "Go"
    if (project_dir / "pyproject.toml").exists() or (project_dir / "requirements.txt").exists():
        return "Python"
    if (project_dir / "package.json").exists():
        return "Node/TypeScript"
    if (project_dir / "Cargo.toml").exists():
        return "Rust"
    if (project_dir / "pom.xml").exists():
        return "Java"
    return "Unknown"


def main() -> int:
    project_dir = Path(os.environ.get("CLAUDE_PROJECT_DIR", ".")).resolve()
    aies = project_dir / ".aies"
    ai = project_dir / ".aies" / ".ai"

    out = StringIO()

    # ── 检测初始化状态 ──────────────────────────────────────────
    is_initialized = (aies / "workflow.md").exists()
    has_developer = (aies / ".developer").exists()
    lang = detect_language(project_dir)

    if not is_initialized:
        # 项目未初始化 — 注入引导提示
        out.write("<aies-uninitialized>\n")
        out.write(f"检测到当前项目（{project_dir.name}，{lang}）尚未初始化 AIES。\n\n")
        out.write("你的首要任务：执行 /aies:bootstrap 命令完成初始化。\n\n")
        out.write("流程：\n")
        out.write("1. 执行 /aies:bootstrap\n")
        out.write("2. 回答 3 个问题（项目名、分层、平台）\n")
        out.write("3. 引导用户填写项目地图\n")
        out.write("4. 初始化完成后再接收第一个任务\n\n")
        out.write("在初始化完成之前，不要直接帮用户写业务代码。\n")
        out.write("</aies-uninitialized>\n")
        result = {
            "hookSpecificOutput": {
                "hookEventName": "SessionStart",
                "additionalContext": out.getvalue(),
            }
        }
        print(json.dumps(result, ensure_ascii=False), flush=True)
        return 0

    # ── 已初始化 — 正常加载上下文 ──────────────────────────────

    out.write("<aies-session>\n")
    out.write(f"项目 [{project_dir.name}] 已启用 AIES。\n")
    out.write("你是这个项目的 Agent 操作者，遵循 AIES 工作流。\n")
    out.write("人描述意图，你判断做什么并驱动执行；在关键节点（prd确认/spec回流）暂停等待拍板。\n")
    out.write("</aies-session>\n\n")

    # 开发者身份检测
    if not has_developer:
        out.write("<no-developer>\n")
        out.write("⚠️ 未检测到开发者身份。在开始第一个任务前，询问用户名字并执行：\n")
        out.write("python3 .aies/scripts/init-developer.py {name}\n")
        out.write("</no-developer>\n\n")

    # 当前上下文
    out.write("<current-context>\n")
    ctx = run_script(aies / "scripts" / "session.py")
    out.write(ctx if ctx else "(上下文脚本不可用，直接继续)")
    out.write("\n</current-context>\n\n")

    # Workflow（Agent 行为协议）
    out.write("<workflow>\n")
    out.write(read_file(aies / "workflow.md", "(未找到 workflow.md)"))
    out.write("\n</workflow>\n\n")

    # Spec 索引
    out.write("<spec-index>\n")
    out.write(read_file(aies / "spec" / "index.md", "(未找到 spec/index.md)"))
    out.write("\n</spec-index>\n\n")

    # Thinking Guides 索引
    guides_index = aies / "spec" / "guides" / "index.md"
    if guides_index.is_file():
        out.write("<thinking-guides>\n")
        out.write(read_file(guides_index))
        out.write("\n</thinking-guides>\n\n")

    # 项目地图
    out.write("<project-index>\n")
    out.write(read_file(ai / "index.md", "(未找到 .ai/index.md — 项目地图缺失，建议运行 /aies:bootstrap 补充)"))
    out.write("\n</project-index>\n\n")

    # Review Checklist
    out.write("<review-checklist>\n")
    out.write(read_file(ai / "review-checklist.md", "(未找到)"))
    out.write("\n</review-checklist>\n\n")

    out.write("""<ready>
上下文已加载。

工作模式：
- 用户描述意图 → 你判断路由（新任务/继续/收尾/查状态）
- 新任务 → /aies:task 流程（解析意图 → 填 prd+acceptance → 提议 → 确认 → 实现）
- 继续 → 读 journal 接续，直接实现
- 收尾 → /aies:finish（Phase3 + spec回流 + 日志）
- 禁止编造项目中不存在的函数/类型
- 禁止未经确认执行 git commit
</ready>""")

    result = {
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": out.getvalue(),
        }
    }
    print(json.dumps(result, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
