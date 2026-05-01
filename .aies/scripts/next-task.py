#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
next-task.py — 为 autopilot 找到下一个可运行的任务。

输出 JSON（供 Agent 读取）：
  {
    "found": true,
    "slug": "feature-x",
    "dir": ".aies/tasks/04-30-feature-x",
    "title": "实现功能 X",
    "priority": "P1",
    "status": "in_progress",
    "checkpoint_summary": "已完成: implement；下一步: 写单元测试",
    "context_specs": ["architecture.md", "code-style.md"]
  }

  或 {"found": false, "reason": "no_runnable_tasks"}

优先级排序：P0 > P1 > P2 > P3
状态优先：in_progress（有进度需要继续）> confirmed（等待首次启动）
阻塞任务（blocked）跳过，需要人工介入。

用法：
  python3 .aies/scripts/next-task.py
  python3 .aies/scripts/next-task.py --priority P0 P1   # 只看高优先级
  python3 .aies/scripts/next-task.py --json             # 输出 JSON（默认）
  python3 .aies/scripts/next-task.py --human            # 输出可读格式
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from lib.common import get_aies_dir  # noqa: E402

PRIORITY_ORDER = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}
STATUS_ORDER = {"in_progress": 0, "confirmed": 1}
RUNNABLE = {"in_progress", "confirmed"}


def _load_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _extract_checkpoint_summary(checkpoint: Path) -> str:
    """从 checkpoint.md 提取当前状态摘要"""
    if not checkpoint.exists():
        return "未启动"
    import re
    text = checkpoint.read_text(encoding="utf-8")
    # 提取"已完成步骤"和"下一步"
    completed = re.search(r"\*\*已完成步骤\*\*[：:]\s*(.+)", text)
    next_step = re.search(r"\*\*下一步\*\*[：:]\s*(.+)", text)
    phase = re.search(r"\*\*阶段\*\*[：:]\s*(.+)", text)

    parts = []
    if phase:
        parts.append(f"阶段: {phase.group(1).strip()}")
    if completed:
        parts.append(f"已完成: {completed.group(1).strip()}")
    if next_step:
        parts.append(f"下一步: {next_step.group(1).strip()}")
    return "  |  ".join(parts) if parts else "有 checkpoint，详情读文件"


def _extract_context_specs(context_jsonl: Path, phase: str = "implement") -> list[str]:
    """从 context.jsonl 提取指定阶段的 spec 列表"""
    if not context_jsonl.exists():
        return []
    specs = []
    for line in context_jsonl.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            entry = json.loads(line)
            if entry.get("phase") == phase:
                specs.append(entry.get("spec", ""))
        except Exception:
            pass
    return [s for s in specs if s]


def find_next_task(priority_filter: list[str] | None = None) -> dict:
    aies = get_aies_dir()
    tasks_dir = aies / "tasks"
    if not tasks_dir.is_dir():
        return {"found": False, "reason": "no_tasks_dir"}

    candidates = []
    for task_dir in tasks_dir.iterdir():
        if not task_dir.is_dir() or task_dir.name == "archive":
            continue

        task_json = task_dir / "task.json"
        data = _load_json(task_json)
        if not data:
            continue

        status = data.get("status", "")
        priority = data.get("priority", "P3")
        autopilot = data.get("autopilot", False)

        # 只拾取 autopilot=true 的任务（人明确标记可自驱）
        if not autopilot:
            continue

        # 只处理可运行状态
        if status not in RUNNABLE:
            continue

        # 优先级过滤
        if priority_filter and priority not in priority_filter:
            continue

        candidates.append({
            "dir": task_dir,
            "data": data,
            "priority_order": PRIORITY_ORDER.get(priority, 99),
            "status_order": STATUS_ORDER.get(status, 99),
        })

    if not candidates:
        return {"found": False, "reason": "no_runnable_tasks"}

    # 排序：先优先级，再状态（in_progress 优先继续）
    candidates.sort(key=lambda x: (x["priority_order"], x["status_order"]))
    best = candidates[0]
    task_dir = best["dir"]
    data = best["data"]

    checkpoint_summary = _extract_checkpoint_summary(task_dir / "checkpoint.md")
    context_specs = _extract_context_specs(task_dir / "context.jsonl", "implement")

    return {
        "found": True,
        "slug": data.get("slug", ""),
        "dir": str(task_dir.relative_to(aies.parent)),
        "title": data.get("title", ""),
        "priority": data.get("priority", ""),
        "status": data.get("status", ""),
        "autopilot": data.get("autopilot", False),
        "checkpoint_summary": checkpoint_summary,
        "context_specs": context_specs,
        "task_dir_abs": str(task_dir),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="找到下一个可自驱执行的任务")
    parser.add_argument("--priority", nargs="*", choices=["P0", "P1", "P2", "P3"],
                        help="只看指定优先级（默认全部）")
    parser.add_argument("--human", action="store_true", help="输出可读格式（默认 JSON）")
    args = parser.parse_args()

    result = find_next_task(priority_filter=args.priority)

    if args.human:
        if not result["found"]:
            print(f"🎉 没有可运行的自驱任务（{result.get('reason', '')}）")
        else:
            print(f"▶️  下一个任务:")
            print(f"   标题:    {result['title']}")
            print(f"   Slug:    {result['slug']}")
            print(f"   状态:    {result['status']}  优先级: {result['priority']}")
            print(f"   目录:    {result['dir']}")
            print(f"   进度:    {result['checkpoint_summary']}")
            if result['context_specs']:
                print(f"   Spec:    {', '.join(result['context_specs'])}")
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))

    return 0


if __name__ == "__main__":
    sys.exit(main())
