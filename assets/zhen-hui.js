/* 변효 3개일 때 貞(본괘) / 悔(지괘) 중 어느 쪽이 主인가.
   assets/hex64.js 뒤에 불러올 것 (HEX64 · readCast 사용).

   근거 — 주희 《역학계몽》 「고변점」, 《성리대전서》 권17:
     三爻變 則占本卦及之卦之彖辭 而以本卦爲貞 之卦爲悔 前十卦主貞 後十卦主悔
   그리고 같은 권의 총괄 원칙:
     今以六十四卦之變列爲三十二圖 … 變在第三十二卦以前者占本卦爻之辭
                                   變在第三十二卦以後者占變卦爻之辭

   즉 본괘마다 之卦 64개를 변효 개수 순으로 늘어놓고, 32번째를 경계로 본괘/지괘가 갈린다.
   3효변 20괘는 23~42번째에 놓여 경계를 정확히 걸치므로 앞 열은 貞, 뒤 열은 悔가 된다. */

/* 변효 세 자리의 조합 20개, 사전식 순서 */
const THREE_COMBOS = (() => {
  const out = [];
  for (let a = 1; a <= 6; a++) for (let b = a + 1; b <= 6; b++) for (let c = b + 1; c <= 6; c++) out.push([a, b, c]);
  return out;
})();

/* 변효 개수 n이 32칸 그림에서 차지하는 구간 (1부터 셈) */
const BLOCK_SPAN = (() => {
  const counts = [1, 6, 15, 20, 15, 6, 1];       // 0~6효변
  const span = []; let at = 1;
  counts.forEach((c) => { span.push([at, at + c - 1]); at += c; });
  return span;                                    // span[3] === [23, 42]
})();

/* movingAt(1~6 자리 배열) → 貞/悔 판정. 3효변이 아니면 null */
function zhenHui(movingAt) {
  if (!movingAt || movingAt.length !== 3) return null;
  const key = movingAt.slice().sort((x, y) => x - y).join(',');
  const rank = THREE_COMBOS.findIndex((c) => c.join(',') === key) + 1;
  if (!rank) return null;
  const [start] = BLOCK_SPAN[3];
  const seat = start + rank - 1;                  // 32칸 그림에서 몇 번째인가
  const front = rank <= 10;
  return {
    rank, seat, front,
    half: front ? '前十卦' : '後十卦',
    main: front ? '貞' : '悔',
    mainHex: front ? '본괘' : '지괘',
  };
}

/* 효값 6개 → 본괘·지괘·貞悔 판정 + 20줄 표를 그려 주는 위젯 */
document.querySelectorAll('[data-zhenhui]').forEach((box) => {
  const input = box.querySelector('[data-zh-values]');
  const out   = box.querySelector('[data-zh-out]');
  const bits  = {};
  Object.keys(HEX64).forEach((k) => { bits[HEX64[k][3]] = { num: +k, name: HEX64[k][0].replace(/^.*\|/, '').replace(/\]\]$/, '') }; });
  const flip = (s, set) => s.split('').map((b, i) => (set.includes(i + 1) ? (b === '1' ? '0' : '1') : b)).join('');
  const SEAT = ['초효', '2효', '3효', '4효', '5효', '상효'];

  const render = () => {
    const vals = (input.value.match(/[6789]/g) || []).map(Number);
    if (vals.length !== 6) {
      out.innerHTML = '<p style="color:#a3473b;margin:0">6·7·8·9 여섯 개를 초효부터 넣어 주세요.</p>';
      return;
    }
    const r = readCast(vals);
    const v = zhenHui(r.movingAt);
    if (!v) {
      out.innerHTML = `<p class="caster-status">변효가 ${r.movingAt.length}개입니다 — 貞·悔를 가리는 것은 <b>변효 3개일 때만</b>입니다. 다른 개수는 규칙표대로 읽으세요.</p>`;
      return;
    }
    const benBits = HEX64[r.ben.num][3];
    const rows = THREE_COMBOS.map((c, i) => {
      const z = bits[flip(benBits, c)];
      const hit = i + 1 === v.rank;
      return `<tr${hit ? ' class="hit"' : ''}><td>${i + 1}</td><td>${c.map((n) => SEAT[n - 1]).join('·')}</td>` +
             `<td>${z.num} ${z.name}</td><td>${i < 10 ? '前十 — 貞(본괘)' : '後十 — 悔(지괘)'}</td></tr>`;
    }).join('');
    out.innerHTML =
      `<p class="caster-status">본괘 <b>제${r.ben.num}괘 ${r.ben.name}</b> · 지괘 <b>제${r.zhi.num}괘 ${r.zhi.name}</b> · ` +
      `변효 ${r.movingAt.map((n) => SEAT[n - 1]).join('·')}</p>` +
      `<div class="grade ${v.front ? 'ok' : 'no'}"><strong>${v.rank}번째 → ${v.half} → 主는 ${v.main}</strong><br>` +
      `<small>32칸 그림에서 ${v.seat}번째 자리입니다. 32 ${v.front ? '이전' : '이후'}이므로 ` +
      `<b>${v.mainHex}(제${v.front ? r.ben.num : r.zhi.num}괘 ${v.front ? r.ben.name : r.zhi.name})의 괘사</b>를 중심으로 읽고, ` +
      `나머지 한 괘의 괘사는 곁에 둡니다.</small></div>` +
      `<div style="overflow-x:auto"><table class="mini-table"><thead><tr><th>순번</th><th>변효 자리</th><th>지괘</th><th>主</th></tr></thead><tbody>${rows}</tbody></table></div>` +
      `<p style="margin:.6rem 0 0"><b>번역</b>(주역정의): <a href="${TRANS_LINK[r.ben.num]}" target="_blank">본괘 ${r.ben.num}번</a> · ` +
      `<a href="${TRANS_LINK[r.zhi.num]}" target="_blank">지괘 ${r.zhi.num}번</a><br>` +
      `<b>원문</b>(주역전의): <a href="${DB_LINK[r.ben.num]}" target="_blank">본괘 ${r.ben.num}번</a> · ` +
      `<a href="${DB_LINK[r.zhi.num]}" target="_blank">지괘 ${r.zhi.num}번</a></p>`;
  };

  input.addEventListener('input', render);
  if (input.value.trim()) render();
});
