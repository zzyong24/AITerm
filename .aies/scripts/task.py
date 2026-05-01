#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
任务管理脚本。

子命令：
    create <title> [--slug <slug>] [--priority P0|P1|P2|P3] [--confirmed]
        创建任务。--confirmed 表示 prd/acceptance 已由人确认，可直接进入自驱模式。
    list
        列出活跃任务（含 checkpoint 状态）
    list-archive
        列出已归档任务
    start <slug>
        将任务从 planning 推进到 in_progress，初始化 checkpoint.md
    checkpoint <slug> --step <step> --summary <text> [--next <next_step>]
        更新任务的执行检查点（每完成一个步骤调用一次）
    block <slug> --reason <text>
        标记任务为 blocked，写入阻塞原因
    unblock <slug>
        解除 blocked 状态，恢复为 in_progress
    status <slug>
        输出任务的完整状态（含 checkpoint 内容），供 Agent 恢复上下文
    finish <slug>
        标记任务为 completed
    archive <slug>
        归档任务到 .aies/tasks/archive/{year-month}/
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from lib.common import (  # noqa: E402
    ensure_developer,
    get_aies_dir,
    month_day,
    now_iso,
    today,
    write_text,
)


def _slugify(text: str) -> str:
    s = re.sub(r"[^\w\-]+", "-", text.strip().lower())
    s = re.sub(r"-+", "-", s).strip("-")
    return s or "task"


# ── 任务状态常量 ────────────────────────────────────────────────
STATUS_PLANNING    = "planning"      # prd/acceptance 待确认
STATUS_CONFIRMED   = "confirmed"     # 已确认，等待进入队列
STATUS_IN_PROGRESS = "in_progress"   # 执行中
STATUS_BLOCKED     = "blocked"       # 有阻塞，等人介入
STATUS_COMPLETED   = "completed"     # 完成

# 自驱可运行的状态
RUNNABLE_STATUSES = {STATUS_CONFIRMED, STATUS_IN_PROGRESS}


def _task_dir_name(slug: str) -> str:
    return f"{month_day()}-{slug}"


def cmd_create(args: argparse.Namespace) -> int:
    developer = ensure_developer()
    aies = get_aies_dir()
    tasks_dir = aies / "tasks"
    tasks_dir.mkdir(parents=True, exist_ok=True)

    slug = args.slug or _slugify(args.title)
    dir_name = f"{month_day()}-{slug}"
    task_dir = tasks_dir / dir_name

    if task_dir.exists():
        print(f"❌ 任务目录已存在: {task_dir}", file=sys.stderr)
        return 1

    task_dir.mkdir(parents=True)

    # confirmed 模式：prd/acceptance 由人预填，可直接进入自驱队列
    initial_status = STATUS_CONFIRMED if args.confirmed else STATUS_PLANNING

    task_data = {
        "slug": slug,
        "title": args.title,
        "status": initial_status,
        "priority": args.priority,
        "owner": developer,
        "confirmed": args.confirmed,
        "autopilot": args.autopilot,
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "commit": "",
        "parent": None,
        "children": [],
        "related_files": [],
        "notes": "",
    }
    (task_dir / "task.json").write_text(
        json.dumps(task_data, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    # prd.md
    prd_content = f"# {args.title}\n\n## 需求背景\n\nTODO\n\n## 验收标准\n\n- [ ] TODO\n\n## 技术方案\n\nTODO\n"
    if args.confirmed:
        prd_content = f"# {args.title}\n\n> ✅ 已确认，可进入自驱执行队列\n\n## 需求背景\n\n{args.description or 'TODO'}\n\n## 验收标准\n\n- [ ] TODO（由 Agent 在 autopilot 中补充）\n\n## 技术方案\n\nAgent 自动生成\n"
    write_text(task_dir / "prd.md", prd_content)

    # context.jsonl
    write_text(
        task_dir / "context.jsonl",
        '{"phase": "implement", "spec": "architecture.md", "reason": "理解分层约束"}\n'
        '{"phase": "implement", "spec": "code-style.md", "reason": "命名和格式规范"}\n'
        '{"phase": "check", "spec": "quality-gates.md", "reason": "质量门自检"}\n'
        '{"phase": "check", "spec": "error-handling.md", "reason": "错误处理规范"}\n',
    )

    # acceptance.md（confirmed 模式下标注由 Agent 填写）
    acceptance_note = "> ✅ 已确认任务，acceptance 由 Agent 在 autopilot 启动时填写\n" if args.confirmed else "> ⚠️ 本文件必须在 implement 阶段开始前填写完毕。\n"
    write_text(
        task_dir / "acceptance.md",
        f"# 验收与测试：{args.title}\n\n{acceptance_note}\n"
        "## P0 验收场景\n\n| # | 场景 | 输入 | 期望结果 |\n|---|------|------|--------|\n| AC-01 | TODO | TODO | TODO |\n\n"
        "## 验收通过标准\n\n- [ ] 所有 P0 场景通过\n- [ ] pytest tests/ -v 全绿\n",
    )

    # checkpoint.md（confirmed 模式下预初始化）
    if args.confirmed:
        _write_initial_checkpoint(task_dir, args.title)

    print(f"✅ 任务已创建: {task_dir}")
    print(f"   Slug: {slug}  Status: {initial_status}  Autopilot: {args.autopilot}")
    if args.confirmed:
        print(f"   📋 已加入自驱队列，Agent 在下次 autopilot 触发时自动执行")
    else:
        print(f"   📋 请填写 prd.md + acceptance.md，然后运行 task.py start {slug}")
    return 0


def _write_initial_checkpoint(task_dir: Path, title: str) -> None:
    write_text(
        task_dir / "checkpoint.md",
        f"""# Checkpoint: {title}

> 这是 Agent 的外化工作记忆。上下文清空后，Agent 靠这个文件恢复进度。
> 每完成一个步骤，Agent 必须更新本文件。

## 当前状态

- **阶段**：waiting（等待 autopilot 触发）
- **已完成步骤**：无
- **下一步**：分析 prd.md，生成 acceptance.md，进入 implement
- **最后更新**：{now_iso()}

## 执行历史

（空）

## 阻塞记录

（无）
""",
    )


def cmd_start(args: argparse.Namespace) -> int:
    """将任务推进到 in_progress，初始化 checkpoint.md"""
    task_dir = _find_task_dir(args.slug)
    if not task_dir:
        print(f"❌ 未找到任务: {args.slug}", file=sys.stderr)
        return 1

    task_json = task_dir / "task.json"
    data = _load_task(task_json)
    old_status = data.get("status")

    if old_status == STATUS_IN_PROGRESS:
        print(f"⚠️  任务已是 in_progress 状态")
        _print_status(task_dir, data)
        return 0

    data["status"] = STATUS_IN_PROGRESS
    data["updated_at"] = now_iso()
    task_json.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    # 初始化或重置 checkpoint
    checkpoint = task_dir / "checkpoint.md"
    if not checkpoint.exists():
        _write_initial_checkpoint(task_dir, data["title"])

    print(f"✅ 任务已启动: {task_dir.name}")
    print(f"   {old_status} → in_progress")
    print(f"   checkpoint.md: {checkpoint}")
    return 0


def cmd_checkpoint(args: argparse.Namespace) -> int:
    """更新任务执行检查点"""
    task_dir = _find_task_dir(args.slug)
    if not task_dir:
        print(f"❌ 未找到任务: {args.slug}", file=sys.stderr)
        return 1

    task_json = task_dir / "task.json"
    data = _load_task(task_json)
    data["updated_at"] = now_iso()
    task_json.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    checkpoint = task_dir / "checkpoint.md"
    existing = checkpoint.read_text(encoding="utf-8") if checkpoint.exists() else ""

    # 追加到执行历史
    history_entry = f"\n### {now_iso()} — {args.step}\n\n{args.summary}\n"

    # 重写"当前状态"块
    next_step = args.next or "待定"
    new_current = f"""## 当前状态

- **阶段**：{args.phase or 'in_progress'}
- **已完成步骤**：{args.step}
- **下一步**：{next_step}
- **最后更新**：{now_iso()}
"""
    # 替换或追加
    if "## 当前状态" in existing:
        existing = re.sub(
            r"## 当前状态\n[\s\S]*?(?=\n## |\Z)",
            new_current,
            existing,
        )
    else:
        existing = new_current + "\n" + existing

    if "## 执行历史" in existing:
        replaced = existing.replace(
            "## 执行历史\n\n（空）",
            f"## 执行历史\n{history_entry}",
        )
        if replaced != existing:
            # 初始"（空）"占位已被替换，使用替换结果
            existing = replaced
        else:
            # 已有历史条目，在 section 头部追加新条目
            existing = existing.replace(
                "## 执行历史\n",
                f"## 执行历史\n{history_entry}",
                1,
            )
    else:
        existing += f"\n## 执行历史\n{history_entry}"

    write_text(checkpoint, existing)

    print(f"✅ Checkpoint 已更新: {args.step}")
    print(f"   下一步: {next_step}")
    return 0


def cmd_block(args: argparse.Namespace) -> int:
    """标记任务为 blocked"""
    task_dir = _find_task_dir(args.slug)
    if not task_dir:
        print(f"❌ 未找到任务: {args.slug}", file=sys.stderr)
        return 1

    task_json = task_dir / "task.json"
    data = _load_task(task_json)
    data["status"] = STATUS_BLOCKED
    data["updated_at"] = now_iso()
    task_json.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    # 更新 checkpoint
    checkpoint = task_dir / "checkpoint.md"
    existing = checkpoint.read_text(encoding="utf-8") if checkpoint.exists() else ""
    block_entry = f"\n### {now_iso()} — 🚫 BLOCKED\n\n**原因**: {args.reason}\n\n**需要人介入**: 是\n"

    new_current = f"""## 当前状态

- **阶段**：BLOCKED
- **阻塞原因**：{args.reason}
- **下一步**：等待人工介入后运行 `task.py unblock {args.slug}`
- **最后更新**：{now_iso()}
"""
    if "## 当前状态" in existing:
        existing = re.sub(r"## 当前状态\n[\s\S]*?(?=\n## |\Z)", new_current, existing)
    else:
        existing = new_current + existing

    if "## 阻塞记录" in existing:
        replaced = existing.replace(
            "## 阻塞记录\n\n（无）",
            f"## 阻塞记录\n{block_entry}",
        )
        if replaced == existing:
            # "（无）" 已被前次替换过，直接追加到阻塞记录 section
            existing = re.sub(
                r"(## 阻塞记录\n)",
                rf"\g<1>{block_entry}",
                existing,
                count=1,
            )
        else:
            existing = replaced
    else:
        existing += f"\n## 阻塞记录\n{block_entry}"

    write_text(checkpoint, existing)

    print(f"🚫 任务已标记为 BLOCKED: {task_dir.name}")
    print(f"   原因: {args.reason}")
    print(f"   解除: python3 .aies/scripts/task.py unblock {args.slug}")
    return 0


def cmd_unblock(args: argparse.Namespace) -> int:
    """解除 blocked 状态"""
    task_dir = _find_task_dir(args.slug)
    if not task_dir:
        print(f"❌ 未找到任务: {args.slug}", file=sys.stderr)
        return 1

    task_json = task_dir / "task.json"
    data = _load_task(task_json)
    data["status"] = STATUS_IN_PROGRESS
    data["updated_at"] = now_iso()
    task_json.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    # 更新 checkpoint 当前状态
    checkpoint = task_dir / "checkpoint.md"
    if checkpoint.exists():
        existing = checkpoint.read_text(encoding="utf-8")
        new_current = f"""## 当前状态

- **阶段**：in_progress（已解除 BLOCKED）
- **下一步**：Agent 在下次 autopilot 触发时继续执行
- **最后更新**：{now_iso()}
"""
        existing = re.sub(r"## 当前状态\n[\s\S]*?(?=\n## |\Z)", new_current, existing)
        write_text(checkpoint, existing)

    print(f"✅ 任务已解除 BLOCKED: {task_dir.name}")
    print(f"   Status: blocked → in_progress")
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    """输出任务完整状态，供 Agent 恢复上下文"""
    task_dir = _find_task_dir(args.slug)
    if not task_dir:
        print(f"❌ 未找到任务: {args.slug}", file=sys.stderr)
        return 1

    data = _load_task(task_dir / "task.json")
    _print_status(task_dir, data)
    return 0


def _print_status(task_dir: Path, data: dict) -> None:
    print(f"\n{'='*60}")
    print(f"任务: {data.get('title', task_dir.name)}")
    print(f"Slug: {data.get('slug', '')}  Status: {data.get('status', '?')}  Priority: {data.get('priority', '?')}")
    print(f"Autopilot: {data.get('autopilot', False)}  Updated: {data.get('updated_at', '?')}")
    print(f"{'='*60}")

    checkpoint = task_dir / "checkpoint.md"
    if checkpoint.exists():
        print("\n📍 Checkpoint（Agent 工作记忆）:")
        print(checkpoint.read_text(encoding="utf-8"))
    else:
        print("\n（无 checkpoint，任务未启动）")


def cmd_list(args: argparse.Namespace) -> int:
    aies = get_aies_dir()
    tasks_dir = aies / "tasks"
    if not tasks_dir.is_dir():
        print("(暂无任务)")
        return 0

    active = [
        p for p in sorted(tasks_dir.iterdir())
        if p.is_dir() and p.name != "archive"
    ]
    if not active:
        print("(暂无活跃任务)")
        return 0

    print(f"活跃任务（{len(active)}）:\n")
    print(f"  {'目录':<32} {'状态':<12} {'优先级':<6} {'自驱':<5} 标题")
    print(f"  {'-'*32} {'-'*12} {'-'*6} {'-'*5} {'-'*40}")
    for p in active:
        data = _load_task(p / "task.json")
        status = data.get("status", "unknown")
        autopilot = "✅" if data.get("autopilot") else "  "
        # 读取 checkpoint 下一步
        checkpoint = p / "checkpoint.md"
        next_step = ""
        if checkpoint.exists():
            m = re.search(r"\*\*下一步\*\*[：:]\s*(.+)", checkpoint.read_text(encoding="utf-8"))
            if m:
                next_step = f" → {m.group(1)[:40]}"
        print(
            f"  {p.name:<32} {status:<12} {data.get('priority','-'):<6} {autopilot:<5} "
            f"{data.get('title','')}{next_step}"
        )
    return 0


def cmd_list_archive(_args: argparse.Namespace) -> int:
    aies = get_aies_dir()
    archive = aies / "tasks" / "archive"
    if not archive.is_dir():
        print("(暂无归档任务)")
        return 0

    months = sorted(archive.iterdir())
    for m in months:
        if not m.is_dir():
            continue
        print(f"\n## {m.name}")
        for t in sorted(m.iterdir()):
            data = _load_task(t / "task.json")
            print(f"  - {t.name}: {data.get('title', '')}")
    return 0


def _load_task(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, FileNotFoundError):
        return {}


def _find_task_dir(slug: str) -> Path | None:
    aies = get_aies_dir()
    tasks_dir = aies / "tasks"
    if not tasks_dir.is_dir():
        return None
    for p in tasks_dir.iterdir():
        if not p.is_dir() or p.name == "archive":
            continue
        if p.name.endswith(f"-{slug}") or p.name == slug:
            return p
    return None


def cmd_finish(args: argparse.Namespace) -> int:
    task_dir = _find_task_dir(args.slug)
    if not task_dir:
        print(f"❌ 未找到任务: {args.slug}", file=sys.stderr)
        return 1

    task_json = task_dir / "task.json"
    data = _load_task(task_json)
    data["status"] = STATUS_COMPLETED
    data["updated_at"] = now_iso()
    task_json.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    # 更新 checkpoint 为已完成
    checkpoint = task_dir / "checkpoint.md"
    if checkpoint.exists():
        existing = checkpoint.read_text(encoding="utf-8")
        new_current = f"## 当前状态\n\n- **阶段**：✅ COMPLETED\n- **最后更新**：{now_iso()}\n"
        existing = re.sub(r"## 当前状态\n[\s\S]*?(?=\n## |\Z)", new_current, existing)
        write_text(checkpoint, existing)

    print(f"✅ 任务已完成: {task_dir.name}")
    print(f"   下一步：python3 .aies/scripts/task.py archive {args.slug}")
    return 0


def cmd_archive(args: argparse.Namespace) -> int:
    task_dir = _find_task_dir(args.slug)
    if not task_dir:
        print(f"❌ 未找到任务: {args.slug}", file=sys.stderr)
        return 1

    from datetime import datetime
    ym = datetime.now().strftime("%Y-%m")
    archive_dir = get_aies_dir() / "tasks" / "archive" / ym
    archive_dir.mkdir(parents=True, exist_ok=True)

    dest = archive_dir / task_dir.name
    if dest.exists():
        print(f"❌ 目标已存在: {dest}", file=sys.stderr)
        return 1

    shutil.move(str(task_dir), str(dest))
    print(f"✅ 任务已归档: {dest}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(prog="task.py")
    sub = parser.add_subparsers(dest="cmd", required=True)

    # create
    create_p = sub.add_parser("create", help="创建任务")
    create_p.add_argument("title", help="任务标题")
    create_p.add_argument("--slug", default="", help="可选的 slug")
    create_p.add_argument("--priority", default="P2", choices=["P0", "P1", "P2", "P3"])
    create_p.add_argument("--confirmed", action="store_true",
                          help="标记为已确认，可进入自驱队列（跳过人工 prd/acceptance 确认）")
    create_p.add_argument("--autopilot", action="store_true",
                          help="标记为自驱任务（autopilot 会自动拾取）")
    create_p.add_argument("--description", default="", help="简短描述（--confirmed 时用于填充 prd）")

    # list
    list_p = sub.add_parser("list", help="列出活跃任务")
    list_p.add_argument("--human", action="store_true", help="输出可读格式（默认已是可读格式，保留此 flag 做兼容）")
    sub.add_parser("list-archive", help="列出已归档任务")

    # start
    start_p = sub.add_parser("start", help="启动任务（planning/confirmed → in_progress）")
    start_p.add_argument("slug", help="任务 slug")

    # checkpoint
    cp_p = sub.add_parser("checkpoint", help="更新执行检查点")
    cp_p.add_argument("slug", help="任务 slug")
    cp_p.add_argument("--step", required=True, help="刚完成的步骤名称")
    cp_p.add_argument("--summary", required=True, help="步骤摘要（做了什么，结果如何）")
    cp_p.add_argument("--next", default="", help="下一步计划")
    cp_p.add_argument("--phase", default="in_progress", help="当前阶段标签")

    # block
    block_p = sub.add_parser("block", help="标记任务为 blocked")
    block_p.add_argument("slug", help="任务 slug")
    block_p.add_argument("--reason", required=True, help="阻塞原因")

    # unblock
    unblock_p = sub.add_parser("unblock", help="解除 blocked 状态")
    unblock_p.add_argument("slug", help="任务 slug")

    # status
    status_p = sub.add_parser("status", help="查看任务完整状态（含 checkpoint）")
    status_p.add_argument("slug", help="任务 slug")

    # finish
    finish_p = sub.add_parser("finish", help="标记任务完成")
    finish_p.add_argument("slug", help="任务 slug")

    # archive
    archive_p = sub.add_parser("archive", help="归档任务")
    archive_p.add_argument("slug", help="任务 slug")

    args = parser.parse_args()
    match args.cmd:
        case "create":      return cmd_create(args)
        case "list":        return cmd_list(args)
        case "list-archive":return cmd_list_archive(args)
        case "start":       return cmd_start(args)
        case "checkpoint":  return cmd_checkpoint(args)
        case "block":       return cmd_block(args)
        case "unblock":     return cmd_unblock(args)
        case "status":      return cmd_status(args)
        case "finish":      return cmd_finish(args)
        case "archive":     return cmd_archive(args)
    return 1


if __name__ == "__main__":
    sys.exit(main())
