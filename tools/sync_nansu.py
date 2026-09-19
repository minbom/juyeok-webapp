#!/usr/bin/env python3
"""난수표 두 사본이 어긋나지 않게 지킨다.

왜 사본이 둘인가 — 없앨 수 없어서다
────────────────────────────────────
난수표는 두 곳에 있다.

  정본  ~/.claude/skills/juyeok/references/nansu-table.md        (전역 스킬)
  파생  <워크스페이스>/reference/random-number-table.html        (수업 카드)

"한 파일을 둘이 읽게" 하는 것은 불가능하다.
  · 스킬이 워크스페이스를 읽으면 → 전역 스킬이 특정 폴더에 묶인다. 다른 프로젝트에서 깨진다.
  · 카드가 스킬을 읽으면 → 카드가 스킬 설치를 전제하게 되고, file:// 에서는 브라우저가
    다른 파일 fetch 를 막아 기술적으로도 안 된다.

그래서 읽는 시점의 단일화는 포기하고 **정본 하나 + 생성 + 검사**로 간다.
스킬 쪽을 정본으로 둔 이유는 그것이 **혼자서도 살아남아야 하는 사본**이기 때문이다.
파생본은 언제든 다시 만들 수 있지만 정본은 그럴 수 없다.

어긋나면 무슨 일이 생기는가 — 같은 좌표가 다른 괘를 낸다. 점 도구에서 그건 치명적이다.
(2026-09-18 에 「열」 정의가 두 갈래로 읽히던 것과 같은 종류의 사고다.)

    python3 tools/sync_nansu.py check    # 대조만
    python3 tools/sync_nansu.py sync     # 정본으로 카드를 덮어씀
"""

from __future__ import annotations

import argparse, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CANON = Path.home() / ".claude/skills/juyeok/references/nansu-table.md"
CARD = ROOT / "reference/random-number-table.html"

MD_ROW = re.compile(r'^(\d{2})\s+((?:\d{5}\s*){10})$', re.M)
HT_ROW = re.compile(r'<tr><th>(\d{2})</th><td>([\d ]+)</td></tr>')

ROWS, COLS, GROUP = 40, 50, 5


def digits(s: str) -> str:
    return re.sub(r"\D", "", s)


def parse(text: str, pat: re.Pattern) -> dict[int, str]:
    return {int(m[1]): digits(m[2]) for m in pat.finditer(text)}


def load() -> tuple[dict[int, str], dict[int, str]]:
    if not CANON.exists():
        sys.exit(f"정본을 찾지 못했습니다 — {CANON}\n"
                 "juyeok 스킬이 설치돼 있지 않으면 대조할 것이 없습니다.")
    if not CARD.exists():
        sys.exit(f"카드를 찾지 못했습니다 — {CARD}")
    return parse(CANON.read_text(), MD_ROW), parse(CARD.read_text(), HT_ROW)


def shape_errors(t: dict[int, str], name: str) -> list[str]:
    e = []
    if len(t) != ROWS:
        e.append(f"{name}: 행이 {len(t)}개입니다 ({ROWS}이어야 함)")
    if set(t) != set(range(1, ROWS + 1)):
        missing = sorted(set(range(1, ROWS + 1)) - set(t))
        e.append(f"{name}: 빠진 행 {missing}")
    for n, d in sorted(t.items()):
        if len(d) != COLS:
            e.append(f"{name}: {n}행이 {len(d)}자리입니다 ({COLS}이어야 함)")
    return e


def compare() -> tuple[list[str], list[int]]:
    a, b = load()
    errs = shape_errors(a, "정본") + shape_errors(b, "카드")
    diff = [n for n in sorted(set(a) | set(b)) if a.get(n) != b.get(n)]
    return errs, diff


def cmd_check(_):
    a, b = load()
    errs, diff = compare()
    print(f"정본  {CANON}")
    print(f"        {len(a)}행")
    print(f"카드  {CARD.relative_to(ROOT)}")
    print(f"        {len(b)}행\n")
    for e in errs:
        print(f"  ✗ {e}")
    if diff:
        print(f"  ✗ 내용이 다른 행 {len(diff)}개 — {diff}\n")
        for n in diff[:5]:
            print(f"    {n:02d} 정본 {a.get(n, '(없음)')}")
            print(f"       카드 {b.get(n, '(없음)')}")
        if len(diff) > 5:
            print(f"    … 외 {len(diff)-5}행")
        print("\n  같은 좌표가 다른 괘를 냅니다. `sync` 로 카드를 정본에 맞추세요.")
    if errs or diff:
        sys.exit(1)
    print("  ✓ 두 사본이 일치합니다.")


def cmd_sync(a_):
    canon, card = load()
    errs = shape_errors(canon, "정본")
    if errs:
        for e in errs:
            print(f"  ✗ {e}")
        sys.exit("정본 자체가 성하지 않습니다. 카드를 덮어쓰지 않았습니다.")
    diff = [n for n in sorted(canon) if canon[n] != card.get(n)]
    if not diff:
        print("이미 일치합니다. 아무것도 바꾸지 않았습니다.")
        return

    print(f"카드의 {len(diff)}행을 정본으로 덮어씁니다 — {diff}")
    if not a_.yes:
        print("실제로 쓰려면 --yes 를 붙이세요 (지금은 미리보기).")
        for n in diff[:5]:
            print(f"  {n:02d} 카드 {card.get(n,'(없음)')}")
            print(f"     → 정본 {canon[n]}")
        return

    text = CARD.read_text()
    for n in sorted(canon):
        printed = " ".join(canon[n][i:i + GROUP] for i in range(0, COLS, GROUP))
        new = f"<tr><th>{n:02d}</th><td>{printed}</td></tr>"
        text, cnt = re.subn(rf'<tr><th>{n:02d}</th><td>[\d ]+</td></tr>', new, text)
        if cnt != 1:
            sys.exit(f"{n:02d}행을 카드에서 {cnt}번 찾았습니다(1이어야 함). 아무것도 쓰지 않았습니다.")
    CARD.write_text(text)
    print(f"카드를 갱신했습니다 — {CARD.relative_to(ROOT)}")
    cmd_check(None)


def main():
    ap = argparse.ArgumentParser(description="난수표 정본 ↔ 카드 대조")
    sub = ap.add_subparsers(dest="cmd")
    sub.add_parser("check", help="대조만 한다 (어긋나면 exit 1)").set_defaults(fn=cmd_check)
    p = sub.add_parser("sync", help="정본으로 카드를 덮어쓴다")
    p.add_argument("--yes", action="store_true", help="실제로 쓴다 (없으면 미리보기)")
    p.set_defaults(fn=cmd_sync)
    a = ap.parse_args()
    (a.fn if a.cmd else cmd_check)(a)


if __name__ == "__main__":
    main()
