#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""AIES 脚本公共工具"""

from __future__ import annotations

import os
import sys
from pathlib import Path


def find_project_root(start: Path | None = None) -> Path:
    """向上查找 .aies/ 目录所在的项目根目录"""
    current = (start or Path.cwd()).resolve()
    while current != current.parent:
        if (current / ".aies").is_dir():
            return current
        current = current.parent
    # 兜底：使用当前目录
    return Path.cwd().resolve()


def get_aies_dir() -> Path:
    return find_project_root() / ".aies"


def get_developer_name() -> str | None:
    """读取当前开发者身份"""
    dev_file = get_aies_dir() / ".developer"
    if not dev_file.is_file():
        return None
    name = dev_file.read_text(encoding="utf-8").strip()
    return name or None


def ensure_developer() -> str:
    """确保开发者身份已初始化，否则退出"""
    name = get_developer_name()
    if not name:
        print(
            "❌ 开发者身份未初始化。请先运行：\n"
            "   python3 .aies/scripts/init-developer.py <your-name>",
            file=sys.stderr,
        )
        sys.exit(1)
    return name


def read_text(path: Path, fallback: str = "") -> str:
    try:
        return path.read_text(encoding="utf-8")
    except (FileNotFoundError, PermissionError):
        return fallback


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def now_iso() -> str:
    from datetime import datetime
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def today() -> str:
    from datetime import datetime
    return datetime.now().strftime("%Y-%m-%d")


def month_day() -> str:
    from datetime import datetime
    return datetime.now().strftime("%m-%d")
