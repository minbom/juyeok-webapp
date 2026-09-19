#!/usr/bin/env python3
"""점 기록 · 사후 검정 — readings/NNNN.json

왜 이 모양인가
──────────────
점을 쳐 두고 나중에 "맞았나?" 보는 방식은 반드시 "맞았다"가 나온다. 세 가지가 겹쳐서다.
  ① 텍스트가 풍부해서 어떤 결과도 들어맞게 읽힌다(반증 불가)
  ② 결과를 판정할 때 이미 괘를 안다(결과 판정 편향)
  ③ 본괘·지괘·괘사·효사·大象·小象·注·疏 중 사후에 고를 수 있는 문장이 수십 개다(다중비교)

그래서 두 갈래를 분리해 담는다.

  갈래 A · 해석 검정  — "내가 텍스트를 제대로 읽었나". 통계가 필요 없고 n=1부터 값이 난다.
                        MISSION 이 "예언이 아니라 상황을 다시 세우는 도구"라 했으니 이쪽이 본령.
  갈래 B · 적중 검정  — "주역이 맞았나". 사전등록(반증 조건)과 맹검이 있어야만 성립한다.
                        맹검 4지선다는 우연이 25%, n=30 이면 참적중률 50% 를 82% 검정력으로 잡는다.

사전등록이 없는 기록은 `testable: false` 로 남고 갈래 B 집계에서 빠진다. 나중에 소급해서
사전등록을 채워 넣는 것을 막기 위해, 반증 조건은 결과가 붙은 뒤에는 수정되지 않는다.
"""

from __future__ import annotations

import argparse, json, random, secrets, sys
from datetime import datetime, timezone, timedelta
from math import comb
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "readings"
KST = timezone(timedelta(hours=9))

RATING = {"fit": "들어맞음", "miss": "어긋남", "undecidable": "판정 불가"}
REVIEW = {                      # 갈래 A — 해석을 사후에 점검하는 네 항목
    "suo_conflict":    "내가 세운 이미지가 疏와 어긋났다",
    "condition_dropped": "조건절을 떨어뜨렸다 (「~라야 吉」의 '라야')",
    "out_of_rule":     "규칙상 읽을 문장이 아닌 것을 끌어왔다",
    "name_impression": "괘 이름의 인상에서 출발했다 (大象이 아니라)",
}


def now() -> str:
    return datetime.now(KST).isoformat(timespec="seconds")


def load_all() -> list[dict]:
    DIR.mkdir(exist_ok=True)
    return [json.loads(p.read_text()) for p in sorted(DIR.glob("[0-9]*.json"))]


def save(rec: dict) -> Path:
    DIR.mkdir(exist_ok=True)
    p = DIR / f"{rec['id']}.json"
    p.write_text(json.dumps(rec, ensure_ascii=False, indent=1) + "\n")
    return p


def get(rid: str) -> dict:
    p = DIR / f"{str(rid).zfill(4)}.json"
    if not p.exists():
        sys.exit(f"기록 {rid} 이 없습니다. `list` 로 확인하세요.")
    return json.loads(p.read_text())


def main_sentence(r: dict) -> dict:
    """그 괘에서 ★主 로 읽는 문장 하나를 원문·번역으로 뽑는다.

    맹검 판정을 괘 이름으로 하게 두면 안 된다 — 「이름의 인상으로 읽기」는 이 워크스페이스가
    내내 싸우는 실패이고, 그걸 검정 설계가 강요하면 재는 것이 달라진다. 판정은 문장으로 한다.
    """
    reads = r.get("read") or []
    x = next((y for y in reads if y.get("main")), reads[0] if reads else None)
    if not x:
        return {"org": "", "trans": ""}
    src = x.get("line") or (x.get("hex") or {}).get("gua") or {}
    return {"org": src.get("org", ""), "trans": src.get("trans", ""),
            "kind": x.get("kind", "")}


def read_label(x: dict) -> str:
    """cast.py 의 read 항목 하나를 한 줄로. 어느 문장을 읽었는지가 나중에 제일 궁금해진다."""
    if x.get("hex"):                       # 괘사
        s = f"{x['hex']['name']} 괘사"
    else:                                  # 효사 — 이름표(初九·六二…)를 원문 앞에서 딴다
        org = (x.get("line") or {}).get("org", "")
        seat = org[:2] if org else "?"
        s = f"{seat} 효사"
    if x.get("role"):
        s += f" [{x['role']}]"
    return ("★ " if x.get("main") else "") + s


def next_id() -> str:
    return str(len(list(DIR.glob("[0-9]*.json"))) + 1).zfill(4) if DIR.exists() else "0001"


# ── 새 기록 ──────────────────────────────────────────────────────────
def cmd_new(a):
    """cast.py --json 출력을 받아 기록을 연다.

    사전등록 세 칸은 비워 둔 채로 만들고 `prereg` 로 채운다 — 괘를 본 뒤에
    관측 계획을 정하면 그건 사전등록이 아니기 때문이다. 순서가 곧 설계다.
    """
    blob = json.loads(Path(a.cast_json).read_text() if a.cast_json != "-" else sys.stdin.read())
    r = blob["result"]
    rec = {
        "id": next_id(),
        "cast_at": now(),
        "question": a.question,
        "source": {"method": a.method, "row": a.row, "col": a.col, "digits": a.digits},
        "lines": blob["values"],
        "ben": {"no": r["ben"]["num"], "name": r["ben"]["name"]},
        "moving": r["moving"],
        "zhi": ({"no": r["zhi"]["num"], "name": r["zhi"]["name"]} if r.get("zhi") else None),
        "rule": r["rule"],
        "say": r["say"],
        "zhenhui": r.get("zhenhui"),
        "read": [read_label(x) for x in r.get("read", [])],
        "prereg": None,          # {observation_plan, prediction, falsifier, at}
        "interpretation": None,
        "outcome": None,
        "blind": None,
    }
    p = save(rec)
    print(f"기록 {rec['id']} 을 열었습니다 → {p.relative_to(ROOT)}")
    print(f"  {rec['ben']['name']}"
          + (f" → {rec['zhi']['name']}" if rec["zhi"] else "")
          + f" · 변효 {rec['moving'] or '없음'}")
    print("\n다음 — 반증 조건을 넣어야 갈래 B(적중 검정)의 대상이 됩니다:")
    print(f"  python3 tools/reading_log.py prereg {rec['id']} \\")
    print('     --plan "무엇을 관측할 것인가" --predict "괘를 읽고 나서의 예상" \\')
    print('     --falsifier "무엇이 관찰되면 이 읽기가 틀린 것인가"')


def cmd_prereg(a):
    rec = get(a.id)
    if rec.get("outcome"):
        sys.exit("결과가 이미 붙었습니다. 사후에 사전등록을 채우는 것은 사전등록이 아닙니다.")
    if rec.get("prereg") and not a.force:
        sys.exit("이미 사전등록돼 있습니다. 바꾸려면 --force (기록에 남습니다).")
    prev = rec.get("prereg")
    rec["prereg"] = {"observation_plan": a.plan, "prediction": a.predict,
                     "falsifier": a.falsifier, "at": now(),
                     "deviation": a.deviation or None}
    if prev:
        rec.setdefault("prereg_revisions", []).append(prev)
    save(rec)
    print(f"{rec['id']} 사전등록 완료. 이제 갈래 B 대상입니다.")
    print(f"  반증 조건 — {a.falsifier}")
    if a.deviation:
        print(f"  ※ 설계 이탈 기록됨 — {a.deviation}")


def cmd_interp(a):
    rec = get(a.id)
    rec["interpretation"] = Path(a.file).read_text() if a.file else a.text
    save(rec)
    print(f"{rec['id']} 해석문 저장 ({len(rec['interpretation'])}자)")


# ── 결과 ─────────────────────────────────────────────────────────────
def cmd_outcome(a):
    """결과를 붙인다. 사실과 판정을 분리해 담는 것이 요점."""
    rec = get(a.id)
    if rec.get("outcome") and not a.force:
        sys.exit("결과가 이미 있습니다. 덮어쓰려면 --force.")
    review = {k: (k in (a.review or [])) for k in REVIEW}
    rec["outcome"] = {
        "recorded_at": now(),
        "facts": a.facts,                  # 해석 없이 사실만
        "self_rating": a.rating,           # 갈래 B 의 자기평가 (맹검 아님 — 참고치)
        "review": review,                  # 갈래 A 의 해석 점검
        "note": a.note,
    }
    save(rec)
    days = (datetime.fromisoformat(rec["outcome"]["recorded_at"])
            - datetime.fromisoformat(rec["cast_at"])).days
    print(f"{rec['id']} 결과 기록 ({days}일 뒤) · 자기평가 {RATING[a.rating]}")
    hit = [REVIEW[k] for k, v in review.items() if v]
    print("  해석 점검 — " + ("걸린 것 없음" if not hit else "; ".join(hit)))
    if not rec.get("prereg"):
        print("  ※ 사전등록이 없어 갈래 B(적중) 집계에서는 빠집니다. 갈래 A 로만 셉니다.")


# ── 맹검 ─────────────────────────────────────────────────────────────
def cmd_blind(a):
    """진짜 1 + 가짜 k-1 을 섞은 판정 꾸러미를 만든다.

    가짜는 실제 난수표 좌표에서 같은 방식으로 뽑는다 — 손으로 고른 '그럴듯한 오답'을
    쓰면 난이도를 내가 정하게 되어 검정이 무너진다.
    정답은 꾸러미에 넣지 않고 기록에만 남긴다.
    """
    rec = get(a.id)
    if not rec.get("outcome"):
        sys.exit("결과가 먼저 있어야 맹검 판정을 만들 수 있습니다.")
    if rec.get("blind") and not a.force:
        sys.exit("이미 맹검 꾸러미가 있습니다. 다시 만들려면 --force.")

    sys.path.insert(0, str(Path.home() / ".claude/skills/juyeok/scripts"))
    try:
        import cast as C
    except ImportError:
        sys.exit("juyeok 스킬의 cast.py 를 찾지 못했습니다.")

    def pack(vals, real=False):
        r = C.apply_rules(vals)
        return {"ben": r["ben"]["name"], "ben_no": r["ben"]["num"],
                "moving": r["moving"],
                "zhi": r["zhi"]["name"] if r.get("zhi") else None,
                "rule": r["say"], "main": main_sentence(r), "_real": real}

    truth = pack(rec["lines"], real=True)
    # 미끼가 진짜의 본괘·지괘를 건드리면 단서가 샌다 — 겹치는 이름은 전부 뺀다
    taken = {truth["ben"], truth["zhi"]}
    cands = []
    tries = 0
    while len(cands) < a.k - 1:
        tries += 1
        if tries > 500:
            sys.exit("미끼를 뽑지 못했습니다.")
        digits = "".join(str(secrets.randbelow(10)) for _ in range(40))
        rolls, _ = C.draw(digits, "b")
        c = pack([x["효값"] for x in rolls])
        if c["ben"] in taken or (c["zhi"] and c["zhi"] in taken):
            continue
        if not c["main"]["org"]:
            continue
        taken |= {c["ben"], c["zhi"]}
        cands.append(c)
    cands.append(truth)
    random.shuffle(cands)
    answer = next(i for i, c in enumerate(cands) if c["_real"]) + 1

    rec["blind"] = {"made_at": now(), "k": a.k, "answer": answer,
                    "candidates": [{kk: v for kk, v in c.items() if kk != "_real"} for c in cands],
                    "judgments": (rec.get("blind") or {}).get("judgments", [])}
    save(rec)

    print(f"=== 맹검 판정 꾸러미 · 기록 {rec['id']} ===\n")
    print("아래는 실제로 일어난 일이다. 해석은 붙어 있지 않다.\n")
    print(f"  물은 것 : {rec['question']}")
    print(f"  일어난 일 : {rec['outcome']['facts']}\n")
    print(f"이 결과에 가장 들어맞는 읽기는 {a.k} 개 중 어느 것인가?")
    print("괘 이름이 아니라 적힌 문장으로 고를 것.\n")
    for i, c in enumerate(rec["blind"]["candidates"], 1):
        mv = ", ".join(map(str, c["moving"])) if c["moving"] else "없음"
        print(f"  [{i}] {c['ben']} · 변효 {mv}" + (f" → {c['zhi']}" if c["zhi"] else ""))
        print(f"      {c['rule']}")
        print(f"      {c['main']['org']}")
        print(f"      {c['main']['trans']}\n")
    print("정답은 기록 파일에 들어 있습니다(보지 마십시오). 판정은 —")
    print(f"  python3 tools/reading_log.py judge {rec['id']} --pick N --by 누구")


def cmd_judge(a):
    rec = get(a.id)
    b = rec.get("blind") or sys.exit("맹검 꾸러미가 없습니다. 먼저 `blind`.")
    if any(j["by"] == a.by for j in b["judgments"]) and not a.force:
        sys.exit(f"{a.by} 의 판정이 이미 있습니다. 덮어쓰려면 --force.")
    b["judgments"] = [j for j in b["judgments"] if j["by"] != a.by]
    ok = a.pick == b["answer"]
    b["judgments"].append({"by": a.by, "pick": a.pick, "correct": ok, "at": now()})
    save(rec)
    print(f"{rec['id']} · {a.by} → {a.pick}번 : {'적중' if ok else '빗나감'} (정답 {b['answer']}번)")


# ── 집계 ─────────────────────────────────────────────────────────────
def binom_p(x, n, p0):
    """단측 정확이항검정 P(X >= x | p0)"""
    return sum(comb(n, i) * p0**i * (1 - p0)**(n - i) for i in range(x, n + 1))


def cmd_stats(a):
    recs = load_all()
    if not recs:
        sys.exit("기록이 없습니다.")
    done = [r for r in recs if r.get("outcome")]
    print(f"기록 {len(recs)}건 · 결과 있음 {len(done)}건 · 사전등록 {sum(1 for r in recs if r.get('prereg'))}건\n")

    print("── 갈래 A · 해석 점검 (사전등록 무관, 결과 있는 전부) ──")
    if done:
        for k, label in REVIEW.items():
            n = sum(1 for r in done if r["outcome"]["review"].get(k))
            bar = "█" * n
            print(f"  {label:<34} {n:>2}/{len(done)} {bar}")
        print("\n  자기평가 — " + " · ".join(
            f"{RATING[k]} {sum(1 for r in done if r['outcome']['self_rating']==k)}" for k in RATING))
        print("  (자기평가는 맹검이 아니므로 적중의 증거가 아닙니다 — 참고치입니다)")
    else:
        print("  아직 결과가 붙은 기록이 없습니다.")

    print("\n── 갈래 B · 적중 검정 (사전등록 + 맹검만) ──")
    judged = [r for r in done if r.get("prereg") and r.get("blind") and r["blind"]["judgments"]]
    if not judged:
        print("  아직 맹검 판정이 없습니다.")
        print("  사전등록 없이 기록된 건은 여기 들어오지 않습니다 — 설계상 그렇습니다.")
        return
    clean = [r for r in judged if not r["prereg"].get("deviation")]
    dev   = [r for r in judged if r["prereg"].get("deviation")]

    def block(rs, title):
        if not rs:
            return
        print(f"  [{title}] {len(rs)}건")
        for k in sorted({r["blind"]["k"] for r in rs}):
            sub = [r for r in rs if r["blind"]["k"] == k]
            n = len(sub)
            x = sum(1 for r in sub if any(j["correct"] for j in r["blind"]["judgments"]))
            print(f"    {k}지선다 — {x}/{n} 적중 ({x/n:.0%}) · 우연 {1/k:.0%} "
                  f"· 단측 p = {binom_p(x, n, 1/k):.3f}")
            if n < 20:
                print(f"      n={n} 은 결론을 낼 크기가 아닙니다. "
                      f"참적중률 50% 를 82% 검정력으로 잡으려면 n≈30.")

    block(clean, "설계대로")
    block(dev, "설계 이탈 — 주 분석에서 뺄 것")
    if dev and clean:
        print("  두 묶음을 합치지 않습니다. 이탈 건은 민감도 분석으로만 봅니다.")
    elif dev and not clean:
        print("  아직 설계대로 진행된 건이 없습니다 — 위 숫자는 주 분석이 아닙니다.")


def cmd_list(a):
    recs = load_all()
    if not recs:
        print("기록이 없습니다.")
        return
    print(f"{'ID':<5} {'친 날':<11} {'괘':<22} {'등록':<5} {'결과':<9} {'맹검'}")
    print("─" * 74)
    for r in recs:
        hexs = r["ben"]["name"] + (f"→{r['zhi']['name']}" if r.get("zhi") else "")
        o = r.get("outcome")
        b = r.get("blind")
        print(f"{r['id']:<5} {r['cast_at'][:10]:<11} {hexs:<22} "
              f"{'O' if r.get('prereg') else '·':<5} "
              f"{(RATING[o['self_rating']] if o else '대기'):<9} "
              f"{(str(len(b['judgments']))+'명' if b else '·')}")


def cmd_show(a):
    rec = get(a.id)
    hide = a.id and not a.answer
    if hide and rec.get("blind"):
        rec = json.loads(json.dumps(rec))
        rec["blind"]["answer"] = "(숨김 — --answer 로 봅니다)"
    print(json.dumps(rec, ensure_ascii=False, indent=1))


def main():
    ap = argparse.ArgumentParser(description="점 기록 · 사후 검정")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("new", help="cast.py --json 출력으로 기록을 연다")
    p.add_argument("cast_json", help="cast.py --json 을 담은 파일, 또는 - (표준입력)")
    p.add_argument("-q", "--question", required=True)
    p.add_argument("--row", type=int); p.add_argument("--col", type=int)
    p.add_argument("--digits", default=""); p.add_argument("--method", default="b")
    p.set_defaults(fn=cmd_new)

    p = sub.add_parser("prereg", help="사전등록 — 관측 계획·예상·반증 조건")
    p.add_argument("id"); p.add_argument("--plan", required=True)
    p.add_argument("--predict", required=True); p.add_argument("--falsifier", required=True)
    p.add_argument("--deviation", default="", help="설계 이탈이 있었다면 그 사실 (예: 관측 계획을 괘를 본 뒤에 정함)")
    p.add_argument("--force", action="store_true"); p.set_defaults(fn=cmd_prereg)

    p = sub.add_parser("interp", help="해석문을 붙인다")
    p.add_argument("id"); p.add_argument("--text"); p.add_argument("--file")
    p.set_defaults(fn=cmd_interp)

    p = sub.add_parser("outcome", help="실제로 일어난 일을 붙인다")
    p.add_argument("id"); p.add_argument("--facts", required=True, help="해석 없이 사실만")
    p.add_argument("--rating", choices=list(RATING), required=True)
    p.add_argument("--review", nargs="*", choices=list(REVIEW), help="갈래 A 에서 걸린 항목")
    p.add_argument("--note", default=""); p.add_argument("--force", action="store_true")
    p.set_defaults(fn=cmd_outcome)

    p = sub.add_parser("blind", help="맹검 판정 꾸러미를 만든다")
    p.add_argument("id"); p.add_argument("-k", type=int, default=4, help="선택지 수 (기본 4)")
    p.add_argument("--force", action="store_true"); p.set_defaults(fn=cmd_blind)

    p = sub.add_parser("judge", help="맹검 판정을 기록한다")
    p.add_argument("id"); p.add_argument("--pick", type=int, required=True)
    p.add_argument("--by", required=True); p.add_argument("--force", action="store_true")
    p.set_defaults(fn=cmd_judge)

    p = sub.add_parser("list"); p.set_defaults(fn=cmd_list)
    p = sub.add_parser("stats"); p.set_defaults(fn=cmd_stats)
    p = sub.add_parser("show"); p.add_argument("id")
    p.add_argument("--answer", action="store_true", help="맹검 정답까지 본다")
    p.set_defaults(fn=cmd_show)

    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
