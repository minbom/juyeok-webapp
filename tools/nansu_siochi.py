#!/usr/bin/env python3
"""난수표 시초법 — 시초점(蓍草占)의 확률분포를 난수표로 재현한다.

왜 되는가
---------
시초법의 효값 분포는 균등하지 않다 (reference/casting-and-line-values.html):

    노음 6 = 1/16,  노양 9 = 3/16,  소양 7 = 5/16,  소음 8 = 7/16

분모가 16 이고 분자가 1·3·5·7 이라는 것이 전부다. 균등난수를 1:3:5:7 로
쪼개기만 하면 시초법이 그대로 재현된다. 동전 3개(척전법)는 2:6:6:2 라서
시초법을 대신하지 못한다 — 변효 총량 25%는 같지만 변효의 '방향'이 다르다.

두 가지 읽는 법을 넣었다. 대응 방식은 다르지만 분포는 완전히 같다.

  방법 A  두 자리(01~96)를 구간에 넣는다. 손으로 제일 빠르다.
  방법 B  네 자리의 홀짝으로 1변·2변·3변을 재현한다. 5/9/4/8 이라는
          원래 숫자가 나오므로 강의에서 배운 판정법을 문자 그대로 쓴다.

두 방법 모두 전수 검산(verify)으로 정확히 1:3:5:7 임을 확인한다.
"""

from __future__ import annotations

import argparse
import re
import secrets
from collections import Counter
from fractions import Fraction
from pathlib import Path

# ─────────────────────────── 효값 ───────────────────────────
LINE = {                       # 효값: (이름, 음양, 변효 여부, 표시)
    6: ("노음 老陰", "음", True, "✕"),
    7: ("소양 少陽", "양", False, "—"),
    8: ("소음 少陰", "음", False, "－"),
    9: ("노양 老陽", "양", True, "○"),
}
THEORY = {6: 1, 9: 3, 7: 5, 8: 7}          # 시초법 이론 분포, 분모 16

# ───────────────────── 방법 A: 두 자리 구간 ─────────────────────
# 01~96 을 6 : 18 : 30 : 42 로 자른다 (= 1 : 3 : 5 : 7, 96 = 16 × 6).
# 97·98·99·00 은 버린다(기각률 4%). 손으로는 경계 세 개만 외우면 된다.
BANDS = [(1, 6, 6), (7, 24, 9), (25, 54, 7), (55, 96, 8)]
REJECT = "97·98·99·00"


def method_a(pair: int) -> int | None:
    """두 자리 수(00 은 100 으로 읽음) → 효값. 기각이면 None."""
    if not 1 <= pair <= 96:
        return None
    for lo, hi, value in BANDS:
        if lo <= pair <= hi:
            return value
    raise AssertionError("unreachable")


# ───────────────────── 방법 B: 삼변 재현 ─────────────────────
def method_b(nibble: int) -> tuple[int, tuple[int, int, int]]:
    """4비트 → (효값, (1변, 2변, 3변)).

    1변은 상위 2비트: 11 이면 9(대), 나머지는 5(소)  → P(9) = 1/4
    2변·3변은 각 1비트: 1 이면 8(대), 0 이면 4(소)   → P(8) = 1/2
    효값 = 9 - (대의 개수)   ← 남은 산가지 수 ÷ 4 와 같다.
    """
    v1 = 9 if (nibble >> 2) == 0b11 else 5
    v2 = 8 if (nibble >> 1) & 1 else 4
    v3 = 8 if nibble & 1 else 4
    big = (v1 == 9) + (v2 == 8) + (v3 == 8)
    return 9 - big, (v1, v2, v3)


def digits_to_nibble(digits: str) -> int:
    """십진 숫자 4개의 홀짝 → 4비트. 짝수=0, 홀수=1.

    0~9 에는 짝수 5개·홀수 5개가 있으므로 각 비트는 정확히 1/2 이고 기각이 없다.
    """
    if len(digits) != 4 or not digits.isdigit():
        raise ValueError(f"숫자 4자리가 필요하다: {digits!r}")
    n = 0
    for d in digits:
        n = (n << 1) | (int(d) & 1)
    return n


# ─────────────────────────── 난수표 ───────────────────────────
def make_table(rows: int = 40, cols: int = 50) -> list[str]:
    """암호학적 난수원(secrets)으로 십진 난수표를 만든다."""
    return ["".join(str(secrets.randbelow(10)) for _ in range(cols)) for _ in range(rows)]


def render_table(table: list[str], group: int = 5) -> str:
    cols = len(table[0])
    head = "      " + "".join(f"{c + 1:<{group + 1}}" for c in range(0, cols, group))
    out = [head, "     +" + "-" * (cols + cols // group)]
    for i, row in enumerate(table, 1):
        out.append(f"  {i:>3} | " + " ".join(row[j:j + group] for j in range(0, cols, group)))
    return "\n".join(out)


# ─────────────────────────── 괘 ───────────────────────────
# 64괘 데이터는 여기서 다시 쓰지 않는다. 이 워크스페이스에는 이미 1차 자료
# 두 곳을 대조해 검증한 assets/hex64.js 가 있고, NOTES.md 가 "기억으로 표를
# 다시 쓰지 말 것"을 명시한다. 그래서 그 파일을 파싱해 그대로 쓴다.
HEX64_JS = Path(__file__).resolve().parent.parent / "assets" / "hex64.js"

_TRI_RE = re.compile(r'"(.)":\s*\{\s*ko:\s*"([^"]+)",[^}]*?bits:\s*"([01]{3})"')
_HEX_RE = re.compile(r'(\d+):\s*\["([^"]+)",\s*"(.)",\s*"(.)",\s*"([01]{6})"\]')


def load_hex64(path: Path = HEX64_JS):
    """assets/hex64.js → (소성괘 정보, 괘 정보). 형식이 어긋나면 곧바로 실패한다."""
    src = path.read_text(encoding="utf-8")

    tri = {}                       # 한자 → (한글, 아래→위 3비트)
    for hanja, ko, bits in _TRI_RE.findall(src):
        tri[hanja] = (ko, tuple(int(c) for c in bits))
    if len(tri) != 8:
        raise RuntimeError(f"{path}: 소성괘 8개를 못 읽었다 ({len(tri)}개)")

    hexes = {}                     # (하괘 한자, 상괘 한자) → (번호, 이름)
    names = {}
    for num, name, up, low, bits in _HEX_RE.findall(src):
        num = int(num)
        if tri[low][1] + tri[up][1] != tuple(int(c) for c in bits):
            raise RuntimeError(f"{path}: #{num} {name} 의 비트가 소성괘와 어긋난다")
        hexes[(low, up)] = (num, name)
        names[num] = name
    if len(hexes) != 64 or sorted(names) != list(range(1, 65)):
        raise RuntimeError(f"{path}: 64괘가 온전하지 않다 ({len(hexes)}개)")
    return tri, hexes


TRI, HEXES = load_hex64()
BITS_TO_TRI = {bits: hanja for hanja, (_, bits) in TRI.items()}


def hexagram(lines: list[int]) -> tuple[int, str, str, str]:
    """효값 6개(초효→상효) → (괘 번호, 이름, 하괘 한글, 상괘 한글)."""
    yang = tuple(1 if v in (7, 9) else 0 for v in lines)
    low, up = BITS_TO_TRI[yang[0:3]], BITS_TO_TRI[yang[3:6]]
    num, name = HEXES[(low, up)]
    return num, name, TRI[low][0], TRI[up][0]


def moved(lines: list[int]) -> list[int]:
    """본괘 → 지괘. 변효(6·9)만 뒤집는다."""
    return [{6: 7, 9: 8}.get(v, v) for v in lines]


# ─────────────────────────── 점 뽑기 ───────────────────────────
POSITIONS = ["초효", "2효", "3효", "4효", "5효", "상효"]


def cast(stream: str, method: str = "b") -> list[dict]:
    """난수표에서 읽은 숫자열 → 여섯 효. 초효부터 차례로."""
    ds = "".join(c for c in stream if c.isdigit())
    i, out = 0, []

    while len(out) < 6:
        if method == "b":
            if i + 4 > len(ds):
                raise ValueError(f"숫자가 모자란다 — 방법 B는 효당 4자리, 괘당 24자리")
            chunk = ds[i:i + 4]
            i += 4
            value, bian = method_b(digits_to_nibble(chunk))
            detail = "·".join(str(x) for x in bian)
        else:
            if i + 2 > len(ds):
                raise ValueError("숫자가 모자란다 — 방법 A는 효당 2자리 + 기각분")
            chunk = ds[i:i + 2]
            i += 2
            pair = int(chunk) or 100
            value = method_a(pair)
            if value is None:                    # 97·98·99·00 → 버리고 다시
                continue
            lo, hi, _ = next(b for b in BANDS if b[0] <= pair <= b[1])
            detail = f"{lo:02d}~{hi:02d}"

        name, yy, is_moving, mark = LINE[value]
        out.append({"자리": POSITIONS[len(out)], "숫자": chunk, "풀이": detail,
                    "효값": value, "이름": name, "음양": yy,
                    "변효": is_moving, "표시": mark})
    return out


def render_cast(lines: list[dict], method: str) -> str:
    vals = [ln["효값"] for ln in lines]
    num, name, low, up = hexagram(vals)
    head = "삼변 (1·2·3)" if method == "b" else "해당 구간"
    out = ["", f"  자리   숫자   {head:<12} 효값  이름        표시", "  " + "─" * 52]
    for ln in reversed(lines):                   # 상효가 위로 오도록
        out.append(f"  {ln['자리']:<5} {ln['숫자']:<6} {ln['풀이']:<12} "
                   f"{ln['효값']}    {ln['이름']:<8} {ln['표시']}")
    out += ["", f"  본괘  {num}. {name}  (하괘 {low} · 상괘 {up})"]

    movers = [ln["자리"] for ln in lines if ln["변효"]]
    if movers:
        m_num, m_name, m_low, m_up = hexagram(moved(vals))
        out.append(f"  변효  {', '.join(movers)}  ({len(movers)}개)")
        out.append(f"  지괘  {m_num}. {m_name}  (하괘 {m_low} · 상괘 {m_up})")
    else:
        out.append("  변효  없음 — 본괘의 괘사만 읽는다")
    return "\n".join(out)


# ─────────────────────────── 검증 ───────────────────────────
def verify(n: int = 200_000) -> str:
    """전수 검산이 본체. 몬테카를로는 구현이 설계를 따라가는지 보는 보조 확인."""
    rows: list[str] = []

    # (1) 전수 검산 — 방법 A: 01~96 의 96가지를 모두 센다.
    exact_a = Counter(method_a(p) for p in range(1, 97))
    # (2) 전수 검산 — 방법 B: 4비트 16가지를 모두 센다.
    exact_b = Counter(method_b(nib)[0] for nib in range(16))

    rows += ["", "  전수 검산 (모든 경우를 빠짐없이 셈)", "",
             "  효값        이론      방법 A (96가지)   방법 B (16가지)",
             "  " + "─" * 58]
    ok = True
    for v in (6, 9, 7, 8):
        th = Fraction(THEORY[v], 16)
        fa = Fraction(exact_a[v], 96)
        fb = Fraction(exact_b[v], 16)
        ok &= (fa == th == fb)
        rows.append(f"  {v} {LINE[v][0]:<8} {THEORY[v]}/16      "
                    f"{exact_a[v]:>2}/96 = {fa}      {exact_b[v]}/16 = {fb}")
    rows += ["", f"  → 두 방법 모두 이론과 정확히 일치: {'통과' if ok else '실패'}",
             f"  → 기각 구간 {REJECT} 는 방법 A 에서만, 4/100 = 4%"]

    # (3) 척전법 대조
    rows += ["", "  참고 — 척전법(동전 3개)은 같은 분포가 아니다", "",
             "  효값        시초법/난수표   척전법", "  " + "─" * 40]
    coin = {6: Fraction(1, 8), 7: Fraction(3, 8), 8: Fraction(3, 8), 9: Fraction(1, 8)}
    for v in (6, 9, 7, 8):
        rows.append(f"  {v} {LINE[v][0]:<8} {Fraction(THEORY[v], 16)!s:>6}"
                    f"          {coin[v]!s:>4}")
    rows.append("  변효 총계               1/4             1/4")

    # (4) 몬테카를로 — 난수표 생성부터 읽기까지 실제 경로를 태워 본다.
    mc = Counter()
    table = "".join(make_table(rows=n // 50 + 2, cols=50))
    for k in range(0, len(table) - 4, 4):
        mc[method_b(digits_to_nibble(table[k:k + 4]))[0]] += 1
    total = sum(mc.values())
    rows += ["", f"  몬테카를로 — 실제 난수표를 만들어 방법 B로 {total:,}효를 뽑음", "",
             "  효값        이론      실측       차이", "  " + "─" * 44]
    for v in (6, 9, 7, 8):
        th, obs = THEORY[v] / 16, mc[v] / total
        rows.append(f"  {v} {LINE[v][0]:<8} {th:6.2%}   {obs:7.3%}   {obs - th:+.3%}")
    return "\n".join(rows)


# ─────────────────────────── CLI ───────────────────────────
def main() -> None:
    ap = argparse.ArgumentParser(description="난수표 시초법")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("table", help="난수표를 새로 만든다")
    p.add_argument("--rows", type=int, default=40)
    p.add_argument("--cols", type=int, default=50)

    p = sub.add_parser("cast", help="숫자열로 괘를 뽑는다")
    p.add_argument("digits", nargs="?", help="생략하면 그 자리에서 난수로 뽑는다")
    p.add_argument("-m", "--method", choices=["a", "b"], default="b")

    p = sub.add_parser("verify", help="분포를 검산한다")
    p.add_argument("-n", type=int, default=200_000)

    sub.add_parser("bands", help="방법 A 구간표를 출력한다")

    args = ap.parse_args()

    if args.cmd == "table":
        print(render_table(make_table(args.rows, args.cols)))
    elif args.cmd == "cast":
        need = 24 if args.method == "b" else 40
        digits = args.digits or "".join(str(secrets.randbelow(10)) for _ in range(need))
        print(f"\n  방법 {args.method.upper()} · 사용한 숫자: {digits}")
        print(render_cast(cast(digits, args.method), args.method))
    elif args.cmd == "verify":
        print(verify(args.n))
    elif args.cmd == "bands":
        print("\n  두 자리 수   효값  이름        몇 개    확률")
        print("  " + "─" * 46)
        for lo, hi, v in BANDS:
            cnt = hi - lo + 1
            print(f"  {lo:02d} ~ {hi:02d}      {v}    {LINE[v][0]:<8}  {cnt:>2}/96   "
                  f"{Fraction(THEORY[v], 16)}")
        print(f"  {REJECT}   —    기각          4/100")


if __name__ == "__main__":
    main()
