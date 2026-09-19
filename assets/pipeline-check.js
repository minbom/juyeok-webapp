/* 전 과정 자가 채점기. hex64.js · hexagram.js · rule-drill.js(READ_RULES) 뒤에 불러올 것.
   효값 6개를 넣으면 여섯 단계를 스스로 답하게 하고, 계산된 정답과 대조해 채점한다. */
document.querySelectorAll('[data-pipeline]').forEach((box) => {
  const input   = box.querySelector('[data-values]');
  const rollBtn = box.querySelector('[data-roll]');
  const hexBox  = box.querySelector('[data-hex]');
  const form    = box.querySelector('[data-form]');
  const gradeBtn= box.querySelector('[data-grade]');
  const out     = box.querySelector('[data-out]');
  let truth = null;

  const fill = (sel, opts, blank) => {
    const el = box.querySelector(sel);
    el.innerHTML = `<option value="">${blank}</option>` + opts;
  };
  fill('[data-q-lo]', TRI_ORDER.map((t) => `<option value="${t}">${TRIGRAMS[t].ko} ${t} (${TRIGRAMS[t].nature})</option>`).join(''), '— 하괘 —');
  fill('[data-q-up]', TRI_ORDER.map((t) => `<option value="${t}">${TRIGRAMS[t].ko} ${t} (${TRIGRAMS[t].nature})</option>`).join(''), '— 상괘 —');
  fill('[data-q-rule]', Object.keys(READ_RULES).map((n) => `<option value="${n}">${READ_RULES[n].label}</option>`).join(''), '— 무엇을 읽는가 —');

  const load = (vals) => {
    truth = null;
    out.innerHTML = '';
    if (vals.length !== 6 || vals.some((v) => ![6, 7, 8, 9].includes(v))) {
      hexBox.innerHTML = '<p style="color:#a3473b;margin:0">6·7·8·9 여섯 개를 초효부터 넣어 주세요 (예: 6 6 8 8 8 7).</p>';
      form.hidden = true;
      return;
    }
    drawHex(hexBox, vals);
    const r = readCast(vals);
    truth = { ...r, n: r.movingAt.length, vals };
    form.hidden = false;
  };

  input.addEventListener('input', () => load((input.value.match(/[6789]/g) || []).map(Number)));
  rollBtn.addEventListener('click', () => {
    const coin = () => (Math.random() < 0.5 ? 3 : 2);          // 앞면 3 · 뒷면 2
    const vals = Array.from({ length: 6 }, () => coin() + coin() + coin());
    input.value = vals.join(' ');
    load(vals);
  });

  gradeBtn.addEventListener('click', () => {
    if (!truth) return;
    const v = (s) => box.querySelector(s).value.trim();
    const items = [
      ['하괘',        v('[data-q-lo]'),   truth.ben && TRI_ORDER.find((t) => TRIGRAMS[t].bits === truth.vals.slice(0,3).map((x)=> (x===7||x===9)?'1':'0').join('')),
                      '초효·2효·3효를 아래에서 위로 읽으세요. 7과 9가 양, 6과 8이 음입니다.'],
      ['상괘',        v('[data-q-up]'),   TRI_ORDER.find((t) => TRIGRAMS[t].bits === truth.vals.slice(3,6).map((x)=> (x===7||x===9)?'1':'0').join('')),
                      '4효·5효·상효입니다. 나중에 뽑은 셋이 위로 갑니다.'],
      ['본괘 번호',   v('[data-q-ben]'),  String(truth.ben.num),
                      '괘 이름의 한자는 상괘를 먼저 씁니다 — 표에서 칸을 짚을 때 방향을 확인하세요.'],
      ['변효 개수',   v('[data-q-cnt]'),  String(truth.n),
                      '변효는 6(노음)과 9(노양)뿐입니다. 7과 8은 변하지 않습니다.'],
      ['무엇을 읽는가', v('[data-q-rule]'), String(truth.n),
                      '변효가 적으면 본괘, 많으면 지괘. 하나로 좁힐 수 없으면(0·3·6개) 효사 대신 괘사.'],
      ['지괘 번호',   v('[data-q-zhi]'),  String(truth.zhi.num),
                      '변효만 뒤집습니다 — 9는 음으로, 6은 양으로. 나머지 넷은 그대로입니다.'],
    ];
    let hit = 0;
    out.innerHTML = items.map(([label, got, want, hint]) => {
      const ok = got !== '' && got === want;
      if (ok) hit++;
      const shown = label === '무엇을 읽는가' ? READ_RULES[want].label
                  : /괘$/.test(label) && TRIGRAMS[want] ? `${TRIGRAMS[want].ko} ${want}` : want;
      return `<div class="grade ${ok ? 'ok' : 'no'}"><strong>${label}</strong> — ${ok ? '정답' : `정답은 <b>${shown}</b>`}` +
             (ok ? '' : `<br><small>${hint}</small>`) + '</div>';
    }).join('') +
      `<p class="caster-status">6문항 중 ${hit}개 정답 — 본괘 <b>제${truth.ben.num}괘 ${truth.ben.name}</b>` +
      (truth.n ? ` · 지괘 <b>제${truth.zhi.num}괘 ${truth.zhi.name}</b>` : '') + `</p>` +
      `<p style="margin:.6rem 0 0"><b>번역</b>(주역정의): <a href="${TRANS_LINK[truth.ben.num]}" target="_blank">본괘 ${truth.ben.num}번</a>` +
      (truth.n ? ` · <a href="${TRANS_LINK[truth.zhi.num]}" target="_blank">지괘 ${truth.zhi.num}번</a>` : '') + `<br>` +
      `<b>원문</b>(주역전의): <a href="${DB_LINK[truth.ben.num]}" target="_blank">본괘 ${truth.ben.num}번</a>` +
      (truth.n ? ` · <a href="${DB_LINK[truth.zhi.num]}" target="_blank">지괘 ${truth.zhi.num}번</a>` : '') + `</p>`;
  });
});
