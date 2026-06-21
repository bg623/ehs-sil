#!/usr/bin/env python3
"""
EHS-SIL 本地文件隐私清理工具
============================
在终端运行: python3 cleanup_local_files.py
作用：重命名含有人名、公司名的文件，删除重复文件
"""

import os, re, shutil
from collections import defaultdict

BASE = "/Users/gobyjohn/Create Material/01.创作2025/00 知识星球"

# 需要替换的名称映射
replacements = {
    # 人名 → 匿名化
    'Xu Zhilin': 'Anonymous',
    'Feng Kai': 'Anonymous',
    'Rob Fisher': 'Author',
    # 公司/地点 → 通用化
    'Perstorp': 'MNC',
    'Zibo': 'Site',
    'Toledo': 'Global',
    'Careway': 'EHS_Audit',
    '淄博': 'Site',
}

# 要删除的模式（文件包含这些就不清理了直接记录）
remove_patterns = ['.m3u8', '.gzip', '.data', '.DS_Store']

changes = []
skipped = []

for root, dirs, files in os.walk(BASE):
    for fname in files:
        old_path = os.path.join(root, fname)
        name, ext = os.path.splitext(fname)
        
        # Skip non-tool files
        if ext.lower() in ['.m3u8', '.gzip', '.data']:
            skipped.append((fname, "非工具文件"))
            continue
        
        # Apply replacements
        new_name = fname
        found = False
        for old, new in replacements.items():
            if old in new_name:
                new_name = new_name.replace(old, new)
                found = True
        
        if found:
            new_path = os.path.join(root, new_name)
            try:
                os.rename(old_path, new_path)
                changes.append((fname, new_name))
            except Exception as e:
                print(f"  ! 重命名失败: {fname} -> {e}")

# 检测重复文件（同名不同目录）
file_map = defaultdict(list)
for root, dirs, files in os.walk(BASE):
    for f in files:
        if any(p in f.lower() for p in remove_patterns):
            continue
        file_map[f.lower()].append(os.path.join(root, f))

dupes = {k: v for k, v in file_map.items() if len(v) > 1}

print("\n=== 清理报告 ===")
print(f"\n重命名文件: {len(changes)} 个")
for old, new in changes:
    print(f"  {old} → {new}")

print(f"\n重复文件组: {len(dupes)} 组")
for name, paths in sorted(dupes.items()):
    print(f"  '{name}':")
    for p in paths:
        print(f"    - {p}")

print(f"\n✅ 清理完成！")
print(f"📌 提示：重复文件需要您手动确认删除（保留一份即可）")
