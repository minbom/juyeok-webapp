/* 난수표 시작점 고르기 — 행(1~40)·열(1~50)을 돌려서 멈춘다.
   reference/random-number-table.html 에서 쓴다.

   왜 만들었나 —
   날짜로 좌표를 정하면 범위가 안 맞는다. 날짜는 31까지라 32~40행이 영원히 안 나오고,
   분·초는 59까지라 51~59가 남아돈다. 특정 자리가 구조적으로 안 뽑히면 뽑기가 아니다.

   엔트로피를 어디에 두었나 —
   버튼을 누르는 순간 Math.random() 을 부르면 그건 컴퓨터가 뽑아 준 것이고,
   cast.py --auto 와 다를 바가 없다. 그래서 숫자를 빠르게 돌리고 **멈춘 시각**이
   값을 정하게 했다. 고르는 행위가 사람 쪽에 남는다는 이 카드의 원칙 그대로다.

   다만 1→2→3… 순서로 돌면 겨냥할 수 있다(40개면 한 바퀴 2초). 그래서 매 회차마다
   1~N 을 섞은 고리를 만들어 그 위를 돈다. 고리는 범위 전체를 한 번씩 지나가므로
   치우침이 없고, 다음에 뭐가 올지 모르므로 겨냥이 안 된다.
   즉 섞기는 겨냥을 막을 뿐이고, 어느 칸에서 멈출지는 사람의 타이밍이 정한다.

   표는 DOM 의 table.nansu 에서 읽는다 — 여기에 표를 다시 적지 않는다.
   (워크스페이스 규칙: 기억으로, 또는 복사본으로 표를 다시 쓰지 말 것) */

(() => {
  const TICK = 45;                    // ms. 한 바퀴가 사람의 반응시간보다 짧아야 한다
  const NEED_B = 24;                  // 방법 B — 효당 4자리
  const NEED_A = 30;                  // 방법 A — 효당 2자리 + 기각 여유
  const STORE = 'juyeok-used-coords';

  /* ── 표 읽기 ─────────────────────────────────────────────── */
  function readTable() {
    const rows = [...document.querySelectorAll('table.nansu tbody tr')].map((tr) => {
      const n = Number(tr.querySelector('th').textContent.trim());
      const d = tr.querySelector('td').textContent.replace(/\D/g, '');
      return { n, d };
    });
    if (!rows.length) return null;
    const bad = rows.find((r) => r.d.length !== 50);
    if (bad) { console.error('난수표 행 길이가 50이 아님:', bad); return null; }
    rows.sort((a, b) => a.n - b.n);
    return rows.map((r) => r.d);
  }

  /* 행 r(1~), 열 c(1~) 에서 오른쪽으로 n자리. 표 끝에 닿으면 첫 행으로 돌아간다 */
  function readFrom(table, r, c, n) {
    const flat = table.join('');
    const width = table[0].length;
    const start = (r - 1) * width + (c - 1);
    let out = '';
    for (let i = 0; i < n; i++) out += flat[(start + i) % flat.length];
    return out;
  }

  /* ── 섞은 고리 ───────────────────────────────────────────── */
  function shuffledRing(n) {
    const a = Array.from({ length: n }, (_, i) => i + 1);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ── 써 버린 자리 기록 ───────────────────────────────────── */
  const used = {
    all() {
      try { return JSON.parse(localStorage.getItem(STORE) || '[]'); }
      catch { return []; }
    },
    add(rec) {
      try {
        const a = used.all();
        a.unshift(rec);
        localStorage.setItem(STORE, JSON.stringify(a.slice(0, 40)));
      } catch { /* 저장이 막혀 있어도 뽑기는 된다 */ }
    },
    seen(r, c) { return used.all().find((x) => x.r === r && x.c === c); },
  };

  /* ── 위젯 ────────────────────────────────────────────────── */
  function build(host) {
    const table = readTable();
    if (!table) { host.innerHTML = '<p class="grade no">난수표를 읽지 못했습니다.</p>'; return; }
    const ROWS = table.length, COLS = table[0].length;

    host.innerHTML = `
      <div class="picker">
        <div class="picker-dials">
          <div class="dial" data-dial="row"><span class="dial-label">행</span><b class="dial-num">--</b><span class="dial-range">1~${ROWS}</span></div>
          <div class="dial" data-dial="col"><span class="dial-label">열</span><b class="dial-num">--</b><span class="dial-range">1~${COLS}</span></div>
        </div>
        <button class="picker-go" type="button">시작</button>
        <p class="picker-hint">스페이스바 또는 버튼으로 <b>행</b>을 멈추고, 한 번 더 눌러 <b>열</b>을 멈춥니다.</p>
        <div class="picker-out" hidden></div>
      </div>`;

    const dials = { row: host.querySelector('[data-dial="row"]'), col: host.querySelector('[data-dial="col"]') };
    const num = { row: dials.row.querySelector('.dial-num'), col: dials.col.querySelector('.dial-num') };
    const go = host.querySelector('.picker-go');
    const hint = host.querySelector('.picker-hint');
    const out = host.querySelector('.picker-out');

    let stage = 0;                    // 0 대기 · 1 행 도는 중 · 2 열 도는 중 · 3 끝
    let timer = null, ring = [], at = 0;
    const picked = { row: 0, col: 0 };

    const pad = (v) => String(v).padStart(2, '0');

    function spin(which, max) {
      ring = shuffledRing(max); at = 0;
      dials[which].classList.add('spinning');
      timer = setInterval(() => {
        at = (at + 1) % ring.length;
        num[which].textContent = pad(ring[at]);
      }, TICK);
    }

    function stop(which) {
      clearInterval(timer); timer = null;
      dials[which].classList.remove('spinning');
      dials[which].classList.add('locked');
      picked[which] = ring[at];
      num[which].textContent = pad(picked[which]);
    }

    function reset() {
      clearInterval(timer); timer = null;
      stage = 0; picked.row = picked.col = 0;
      for (const k of ['row', 'col']) {
        dials[k].classList.remove('spinning', 'locked');
        num[k].textContent = '--';
      }
      out.hidden = true; out.innerHTML = '';
      go.textContent = '시작';
      hint.innerHTML = '스페이스바 또는 버튼으로 <b>행</b>을 멈추고, 한 번 더 눌러 <b>열</b>을 멈춥니다.';
    }

    function step() {
      if (stage === 0) {
        stage = 1; spin('row', ROWS);
        go.textContent = '행 멈추기';
        hint.innerHTML = '<b>행</b>이 돌고 있습니다. 멈추고 싶을 때 누르세요 — 이 타이밍이 값을 정합니다.';
      } else if (stage === 1) {
        stop('row'); stage = 2; spin('col', COLS);
        go.textContent = '열 멈추기';
        hint.innerHTML = `행 <b>${pad(picked.row)}</b> 확정. 이제 <b>열</b>을 멈추세요.`;
      } else if (stage === 2) {
        stop('col'); stage = 3;
        go.textContent = '다시 뽑기';
        hint.textContent = '';
        finish();
      } else {
        reset(); step();
      }
    }

    function finish() {
      const { row: r, col: c } = picked;
      const b = readFrom(table, r, c, NEED_B);
      const a = readFrom(table, r, c, NEED_A);
      const before = used.seen(r, c);
      const wrapped = (r - 1) * COLS + (c - 1) + NEED_B > ROWS * COLS;

      out.hidden = false;
      out.innerHTML = `
        <p class="picker-coord"><b>${r}행 ${c}열</b> <span>— ${r}행의 ${c}번째 숫자부터 오른쪽으로</span></p>
        <div class="picker-digits">
          <label>방법 B <small>(기본 · 24자리)</small></label>
          <code>${b}</code>
        </div>
        <div class="picker-digits sub">
          <label>방법 A <small>(2자리 구간 · 기각 여유 포함)</small></label>
          <code>${a}</code>
        </div>
        <p class="picker-say">에이전트에게 이렇게 말하면 됩니다 —
          <q>${r}행 ${c}열에서 시작할게요</q> 또는 숫자를 그대로 붙여 넣기.</p>
        ${wrapped ? '<p class="picker-note">표 끝에 닿아 1행 처음으로 돌아가 이어 읽었습니다.</p>' : ''}
        ${before ? `<p class="picker-note warn">이 자리는 ${before.at} 에 이미 썼습니다.
          한 점에 쓴 자리는 다시 쓰지 않는 것이 이 표의 규칙입니다 — 다시 뽑으세요.</p>` : ''}`;

      markTable(r, c);
      if (!before) used.add({ r, c, at: new Date().toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) });
    }

    /* 뽑힌 행을 표에서 짚어 준다 */
    function markTable(r, c) {
      document.querySelectorAll('table.nansu tr.hit').forEach((tr) => {
        tr.classList.remove('hit');
        const td = tr.querySelector('td');
        if (td && td.dataset.raw) { td.textContent = td.dataset.raw; delete td.dataset.raw; }
      });
      const tr = [...document.querySelectorAll('table.nansu tbody tr')]
        .find((x) => Number(x.querySelector('th').textContent.trim()) === r);
      if (!tr) return;
      tr.classList.add('hit');
      const td = tr.querySelector('td');
      td.dataset.raw = td.textContent;
      const d = td.textContent.replace(/\D/g, '');
      const printed = d.slice(0, c - 1).replace(/(.{5})/g, '$1 ');
      td.innerHTML = `${printed.trimEnd()}${c > 1 ? ' ' : ''}<mark>${d.slice(c - 1).replace(/(.{5})/g, '$1 ').trimEnd()}</mark>`
        .replace(/  +/g, ' ');
      tr.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    go.addEventListener('click', step);
    document.addEventListener('keydown', (e) => {
      if (e.code !== 'Space' && e.code !== 'Enter') return;
      if (e.target.closest('input, textarea, select')) return;
      e.preventDefault();
      step();
    });
  }

  document.querySelectorAll('[data-coord-picker]').forEach(build);
})();
