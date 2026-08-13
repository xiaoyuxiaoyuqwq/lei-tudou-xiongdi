# -*- coding: utf-8 -*-
"""
sync_doc.py — 把整合文档《类土豆兄弟_源码与策划书.md》的
【第二部分·完整源码】与【第三部分·工具链】的代码块，
从 build/ 分片与 tools/ 脚本的真实内容重新同步。

- 只替换 Part2 / Part3 的代码，其余手写文字（Part1 策划书 / Part4 报告 / Part5 核查）原样保留。
- 幂等：可反复运行；每次都以磁盘真实源码为准。

用法：python tools/sync_doc.py
"""
import re
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
DOC = ROOT / "类土豆兄弟_源码与策划书.md"

PART2_SECTIONS = [
    ("build/p1_shell.html", "p1_shell.html — DOM 结构 + 全部 CSS（菜单/遮罩/HUD/横幅）"),
    ("build/p2_core.js", "p2_core.js — CFG / Util / SHIPS / STAGES / Mesh / Gfx / Pool / Grid"),
    ("build/p3_world.js", "p3_world.js — World / Input / Audio2 / FX / Asteroids / Minimap"),
    ("build/p4_player.js", "p4_player.js — Player / Bullets"),
    ("build/p5_weapons.js", "p5_weapons.js — Weapons / Wingmen"),
    ("build/p6_enemies.js", "p6_enemies.js — Enemies / Loot"),
    ("build/p7_boss.js", "p7_boss.js — Boss / Progress"),
    ("build/p8_game.js", "p8_game.js — HUD / Game（主循环与状态机）"),
]
PART3_TOOLS = [
    ("tools/build.mjs", "tools/build.mjs — 分片拼接为单文件 index.html（自动备份）"),
    ("tools/bake_models.mjs", "tools/bake_models.mjs — GLB 离线烘焙为 meshes.js"),
]


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8").replace("\r\n", "\n")


def fence(code):
    return "```javascript\n\n" + code.rstrip("\n") + "\n\n```"


def h1pos(doc, prefix):
    m = re.search(r"(?m)^# " + re.escape(prefix), doc)
    if not m:
        sys.exit("找不到章节：# " + prefix)
    return m.start()


def main():
    doc = DOC.read_text(encoding="utf-8").replace("\r\n", "\n")
    p2 = h1pos(doc, "第二部分")
    p3 = h1pos(doc, "第三部分")
    p4 = h1pos(doc, "第四部分")

    head = doc[:p2]              # 文档标题 + 第一部分（策划书）
    part3_old = doc[p3:p4]       # 旧第三部分（H1 + meshes 说明 + 工具）
    tail = doc[p4:]              # 第四部分 + 第五部分

    # 保留第三部分开头（H1 + meshes.js 说明），仅重建工具代码块
    mtool = re.search(r"(?m)^## tools/", part3_old)
    part3_head = part3_old[:mtool.start()]

    # 重建第二部分
    part2 = ("# 第二部分 · 完整源码（按模块）\n\n"
             "> 以下源码与 `build/` 分片、`tools/` 工具链逐字一致。评审时可直接对照 §4 架构表定位。\n\n\n")
    for rel, title in PART2_SECTIONS:
        part2 += f"## {title}\n\n{fence(read(rel))}\n\n\n"

    # 重建第三部分
    part3 = part3_head
    for rel, title in PART3_TOOLS:
        part3 += f"## {title}\n\n{fence(read(rel))}\n\n\n"

    newdoc = head + part2 + part3 + tail
    DOC.write_text(newdoc, encoding="utf-8")
    kb = len(newdoc.encode("utf-8")) / 1024
    print(f"OK 同步完成 {kb:.1f} KB  (Part2 {len(PART2_SECTIONS)} 分片 / Part3 {len(PART3_TOOLS)} 工具)")


if __name__ == "__main__":
    main()
