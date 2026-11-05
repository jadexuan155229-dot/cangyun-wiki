#!/usr/bin/env python3
"""按字符表重裁汇文正楷、汇文明朝子集 (scripts/subset-fonts.py)

平常用 npm run fonts：先补字符表（font-chars.js），再跑本档。
单跑：python3 scripts/subset-fonts.py [--source 目录]

依赖：pip install fonttools brotli
完整字体：2026-08-08 子集化（548e2c4）时已自库中删除，本档自其前一版
3ea7e16 的 git 历史取出，不另存档；浅克隆缺此版时自动 git fetch 取回。
亦可 --source 指一个放有 HuiwenMingChao.woff2、HuiwenZhengKai.woff2
完整版的目录，不读 git。
裁法即 pyftsubset 默认参数加 --flavor=woff2，与 548e2c4 所出子集同配置
（GSUB 留 frac/vert/vrt2，name 留 0–6）。京华老宋全量出货，不在此列。
"""
import argparse
import subprocess
import sys
import tempfile
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
CHAR_LIST = ROOT / "scripts" / "font-subset-chars.txt"
FONT_DIR = ROOT / "src" / "assets" / "fonts"
FONTS = ["HuiwenMingChao", "HuiwenZhengKai"]
FULL_REV = "3ea7e1664c8a81975ed6e89bbfea0fb7f98baa40"


def git_show(path):
    return subprocess.run(["git", "show", f"{FULL_REV}:{path}"], cwd=ROOT, capture_output=True)


def full_font(name, tmp, source):
    if source:
        p = Path(source) / f"{name}.woff2"
        if not p.exists():
            sys.exit(f"--source 目录里没有 {p.name}")
        return p
    path = f"src/assets/fonts/{name}.woff2"
    r = git_show(path)
    if r.returncode != 0:
        print(f"本地 git 历史里没有 {FULL_REV[:7]}，取回该版……")
        subprocess.run(["git", "fetch", "--depth=1", "origin", FULL_REV], cwd=ROOT, check=True)
        r = git_show(path)
        if r.returncode != 0:
            sys.exit(f"取不到完整字体 {path}：{r.stderr.decode().strip()}")
    p = Path(tmp) / f"{name}.woff2"
    p.write_bytes(r.stdout)
    return p


def main():
    ap = argparse.ArgumentParser(description="按字符表重裁汇文正楷、汇文明朝子集")
    ap.add_argument("--source", help="完整字体所在目录（不读 git 历史）")
    args = ap.parse_args()

    chars = CHAR_LIST.read_text(encoding="utf-8")
    want = {ord(c) for c in chars if c != "\n"}
    with tempfile.TemporaryDirectory() as tmp:
        for name in FONTS:
            src = full_font(name, tmp, args.source)
            out = FONT_DIR / f"{name}.subset.woff2"
            before = set(TTFont(out).getBestCmap()) if out.exists() else set()
            old_size = out.stat().st_size if out.exists() else 0
            subprocess.run(
                [sys.executable, "-m", "fontTools.subset", str(src),
                 f"--text-file={CHAR_LIST}", "--flavor=woff2", f"--output-file={out}"],
                check=True,
            )
            full_cmap = set(TTFont(src).getBestCmap())
            after = set(TTFont(out).getBestCmap())
            lost = want & full_cmap - after
            if lost:
                sys.exit(f"{name}：字体里有却没裁进子集的字 {''.join(map(chr, sorted(lost)))}")
            gained = "".join(chr(c) for c in sorted(after - before) if c > 0x7F)
            absent = "".join(chr(c) for c in sorted(want - full_cmap) if c > 0x7F)
            print(f"{name}：{old_size / 1e6:.2f} → {out.stat().st_size / 1e6:.2f} MB，"
                  f"收字 {len(after)}，新增 {len(gained)}{f'（{gained}）' if gained else ''}")
            if absent:
                print(f"  字体本身没有、无从裁入的 {len(absent)} 个：{absent}")


if __name__ == "__main__":
    main()
