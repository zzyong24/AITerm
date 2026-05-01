#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
初始化开发者身份。

用法：
    python3 .aies/scripts/init-developer.py <your-name>
    python3 .aies/scripts/init-developer.py cursor-agent
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from lib.common import get_aies_dir, write_text  # noqa: E402


def main() -> int:
    if len(sys.argv) < 2:
        print("用法：python3 .aies/scripts/init-developer.py <name>", file=sys.stderr)
        return 2

    name = sys.argv[1].strip()
    if not name:
        print("❌ 开发者名称不能为空", file=sys.stderr)
        return 2

    aies_dir = get_aies_dir()
    dev_file = aies_dir / ".developer"

    if dev_file.exists():
        existing = dev_file.read_text(encoding="utf-8").strip()
        print(f"⚠️  已有开发者身份: {existing}")
        confirm = input(f"是否覆盖为 {name}? [y/N]: ").strip().lower()
        if confirm != "y":
            print("已取消。")
            return 0

    write_text(dev_file, name + "\n")

    # 创建个人 workspace 目录
    workspace_dir = aies_dir / "workspace" / name
    workspace_dir.mkdir(parents=True, exist_ok=True)

    index_path = workspace_dir / "index.md"
    if not index_path.exists():
        write_text(
            index_path,
            f"""# {name} — 个人工作区

> 本目录存放 {name} 的会话日志。
> 每个 journal 文件最多 2000 行，超过自动切换到下一个。

## 会话统计

- 会话总数：0
- 最后更新：—

## Journal 列表

| 文件 | 创建时间 | 行数 |
|------|---------|------|
| — | — | — |
""",
        )

    print(f"✅ 开发者身份已初始化: {name}")
    print(f"   身份文件: {dev_file}")
    print(f"   工作区: {workspace_dir}")
    print()
    print("下一步：")
    print("  1. 确保 .gitignore 中包含 .aies/.developer（身份文件不提交）")
    print("  2. 运行 python3 .aies/scripts/session.py get-context 查看当前上下文")
    return 0


if __name__ == "__main__":
    sys.exit(main())
