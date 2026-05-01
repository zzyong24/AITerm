#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
会话管理脚本。

子命令：
    get-context               打印当前会话上下文（开发者、活跃任务、git 状态、近期日志）
    add --title <T> [--commit <C>] [--summary <S>]
                              在当前开发者的 journal 文件中追加一条会话记录

示例：
    python3 .aies/scripts/session.py get-context
    python3 .aies/scripts/session.py add --title "实现 JWT 鉴权" --commit abc1234 --summary "完成 ..."
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from lib.common import (  # noqa: E402
    ensure_developer,
    get_aies_dir,
    get_developer_name,
    now_iso,
    read_text,
    today,
    write_text,
)

MAX_JOURNAL_LINES = 2000


def _run(cmd: list[str]) -> str:
    try:
        out = subprocess.run(
            cmd, capture_output=True, text=True, timeout=5, check=False
        )
        return (out.stdout or "").strip()
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return ""


def cmd_get_context(_args: argparse.Namespace) -> int:
    aies = get_aies_dir()
    name = get_developer_name() or "<未初始化>"

    print("=" * 60)
    print("AIES Session Context")
    print("=" * 60)
    print(f"开发者: {name}")
    print()

    # 活跃任务
    tasks_dir = aies / "tasks"
    if tasks_dir.is_dir():
        active = [
            p for p in tasks_dir.iterdir()
            if p.is_dir() and p.name != "archive"
        ]
        print(f"活跃任务 ({len(active)}):")
        for t in sorted(active)[:10]:
            task_json = t / "task.json"
            if task_json.is_file():
                try:
                    data = json.loads(task_json.read_text(encoding="utf-8"))
                    title = data.get("title", t.name)
                    status = data.get("status", "unknown")
                    print(f"  - [{status}] {t.name}: {title}")
                except (json.JSONDecodeError, PermissionError):
                    print(f"  - {t.name}")
            else:
                print(f"  - {t.name}")
        print()

    # Git 状态
    branch = _run(["git", "branch", "--show-current"])
    if branch:
        print(f"Git 分支: {branch}")
    status = _run(["git", "status", "--short"])
    if status:
        lines = status.splitlines()[:10]
        print("Git 状态:")
        for l in lines:
            print(f"  {l}")
        if len(status.splitlines()) > 10:
            print(f"  ... 还有 {len(status.splitlines()) - 10} 个文件")
    recent = _run(["git", "log", "--oneline", "-5"])
    if recent:
        print("最近提交:")
        for l in recent.splitlines():
            print(f"  {l}")
    print()

    # 最近会话日志
    if name and name != "<未初始化>":
        workspace = aies / "workspace" / name
        journals = sorted(workspace.glob("journal-*.md")) if workspace.is_dir() else []
        if journals:
            latest = journals[-1]
            print(f"最新 Journal: {latest.name}")
            content = read_text(latest)
            # 提取最后一条会话（以 ## 开头）
            parts = content.split("\n## ")
            if len(parts) > 1:
                last = "## " + parts[-1]
                lines = last.splitlines()[:20]
                print("最近会话预览:")
                for l in lines:
                    print(f"  {l}")
                if len(last.splitlines()) > 20:
                    print(f"  ...")
        else:
            print("暂无会话日志")
    print()
    print("=" * 60)
    return 0


def _find_or_create_journal(workspace: Path) -> Path:
    journals = sorted(workspace.glob("journal-*.md"))
    if journals:
        latest = journals[-1]
        line_count = len(latest.read_text(encoding="utf-8").splitlines())
        if line_count < MAX_JOURNAL_LINES:
            return latest
        # 超限，切换到下一个
        n = int(latest.stem.split("-")[1]) + 1
        return workspace / f"journal-{n}.md"
    else:
        return workspace / "journal-1.md"


def cmd_add(args: argparse.Namespace) -> int:
    name = ensure_developer()
    aies = get_aies_dir()
    workspace = aies / "workspace" / name
    workspace.mkdir(parents=True, exist_ok=True)

    journal = _find_or_create_journal(workspace)

    entry = f"""
## {now_iso()} — {args.title}

"""
    if args.commit:
        entry += f"**Commit**: `{args.commit}`\n\n"
    if args.summary:
        entry += f"**摘要**: {args.summary}\n\n"

    if not journal.exists():
        header = f"# {name} — Journal {journal.stem.split('-')[1]}\n"
        entry = header + entry

    with journal.open("a", encoding="utf-8") as f:
        f.write(entry)

    # 更新个人 index.md
    _update_personal_index(workspace, name, journal)

    print(f"✅ 会话已追加到 {journal}")
    print(f"   标题: {args.title}")
    if args.commit:
        print(f"   Commit: {args.commit}")
    return 0


def _update_personal_index(workspace: Path, name: str, journal: Path) -> None:
    journals = sorted(workspace.glob("journal-*.md"))
    total_sessions = 0
    rows = []
    for j in journals:
        content = read_text(j)
        session_count = content.count("\n## ")
        total_sessions += session_count
        lines = len(content.splitlines())
        rows.append((j.name, session_count, lines))

    index_md = workspace / "index.md"
    header = f"""# {name} — 个人工作区

> 本目录存放 {name} 的会话日志。
> 每个 journal 文件最多 {MAX_JOURNAL_LINES} 行，超过自动切换到下一个。

## 会话统计

- 会话总数：{total_sessions}
- 最后更新：{today()}

## Journal 列表

| 文件 | 会话数 | 行数 |
|------|-------|------|
"""
    for name_, count, lines in rows:
        header += f"| {name_} | {count} | {lines} |\n"

    write_text(index_md, header)


def main() -> int:
    parser = argparse.ArgumentParser(prog="session.py")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("get-context", help="打印会话上下文")

    add_p = sub.add_parser("add", help="追加会话记录")
    add_p.add_argument("--title", required=True, help="会话标题")
    add_p.add_argument("--commit", default="", help="关联的 commit hash（可选）")
    add_p.add_argument("--summary", default="", help="摘要（可选）")

    args = parser.parse_args()
    if args.cmd == "get-context":
        return cmd_get_context(args)
    elif args.cmd == "add":
        return cmd_add(args)
    return 1


if __name__ == "__main__":
    sys.exit(main())
