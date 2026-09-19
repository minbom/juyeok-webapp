/* 모바일 주역 실전 기록 앱.
   질문·괘·해석·의견은 localStorage에만 둔다. 네트워크로 전송하지 않는다.
   사후 결과 입력과 적중 판정은 이 앱이 아니라 저장소의 tools/reading_log.py에서 처리한다.
   난수표는 reference/random-number-table.html을 읽어 기존 파생본을 단일 원천으로 쓴다. */
(() => {
  'use strict';

  const STORE = 'juyeok-web-records-v2';
  const CURRENT = 'juyeok-web-current-v2';
  const TICK = 48;
  const POSITIONS = ['초효', '2효', '3효', '4효', '5효', '상효'];
  const HANJA_NUM = ['初', '二', '三', '四', '五', '上'];
  const RATING = { hit: '대체로 맞음', mixed: '섞여 있음', miss: '대체로 틀림', unclear: '판정 불가' };

  const questionForm = document.querySelector('[data-question-form]');
  const questionLocked = document.querySelector('[data-question-locked]');
  const questionError = document.querySelector('[data-question-error]');
  const castStage = document.querySelector('[data-stage="cast"]');
  const resultStage = document.querySelector('[data-stage="result"]');
  const resultHost = document.querySelector('[data-cast-result]');
  const guessStage = document.querySelector('[data-stage="guess"]');
  const guessForm = document.querySelector('[data-guess-form]');
  const guessLocked = document.querySelector('[data-guess-locked]');
  const guessError = document.querySelector('[data-guess-error]');
  const saveStatus = document.querySelector('[data-save-status]');
  const exportStatus = document.querySelector('[data-export-status]');
  const recordsHost = document.querySelector('[data-records]');
  const emptyState = document.querySelector('[data-empty]');
  let currentId = null;
  let deferredInstall = null;
  let tablePromise = null;

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[ch]);

  const now = () => new Date().toISOString();
  const localTime = (stamp) => new Date(stamp).toLocaleString('ko-KR', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  const makeId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function loadRecords() {
    try {
      const records = JSON.parse(localStorage.getItem(STORE) || '[]');
      return Array.isArray(records) ? records : [];
    } catch {
      return [];
    }
  }

  function saveRecords(records) {
    localStorage.setItem(STORE, JSON.stringify(records));
  }

  function saveRecord(record) {
    const records = loadRecords();
    const at = records.findIndex((item) => item.id === record.id);
    if (at < 0) records.unshift(record);
    else records[at] = record;
    saveRecords(records);
    renderRecords();
  }

  function getRecord(id) {
    return loadRecords().find((item) => item.id === id) || null;
  }

  function updateRecord(id, change) {
    const record = getRecord(id);
    if (!record) return null;
    Object.assign(record, change, { updated_at: now() });
    saveRecord(record);
    return record;
  }

  function guessText(record) {
    return record.guess?.text || record.prereg?.prediction || '';
  }

  function setProgress(n) {
    document.querySelectorAll('[data-progress]').forEach((el) => {
      const step = Number(el.dataset.progress);
      el.classList.toggle('active', step === n);
      el.classList.toggle('done', step < n);
    });
  }

  function renderQuestionLocked(record) {
    questionForm.hidden = true;
    questionLocked.hidden = false;
    questionLocked.innerHTML = `
      <h3>질문 잠김</h3>
      <dl>
        <dt>질문</dt><dd>${esc(record.question)}</dd>
      </dl>
      <p class="lock-time">${esc(localTime(record.question_at))}에 잠김 · 수정 불가</p>
      <button type="button" data-abandon>${record.cast ? '새 질문으로 시작' : '이 기록을 중단하고 새 질문 쓰기'}</button>`;
    questionLocked.querySelector('[data-abandon]').addEventListener('click', () => {
      if (!record.cast) updateRecord(record.id, { status: 'abandoned', abandoned_at: now() });
      localStorage.removeItem(CURRENT);
      location.reload();
    });
  }

  function renderGuessLocked(record) {
    guessForm.hidden = true;
    guessLocked.hidden = false;
    guessLocked.innerHTML = `
      <h3>의견 기록됨</h3>
      <dl>
        <dt>내 의견</dt><dd>${esc(record.guess.text)}</dd>
      </dl>
      <p class="lock-time">${esc(localTime(record.guess.at))}에 기록 · 수정 불가</p>`;
  }

  questionForm.addEventListener('submit', (event) => {
    event.preventDefault();
    questionError.textContent = '';
    if (!questionForm.reportValidity()) return;
    const data = new FormData(questionForm);
    const question = String(data.get('question') || '').trim();
    if (!question) {
      questionError.textContent = '질문을 적어 주세요.';
      return;
    }
    const record = {
      schema: 3,
      id: makeId(),
      status: 'question',
      created_at: now(),
      updated_at: now(),
      question,
      question_at: now(),
      cast: null,
      reading: '',
      guess: null
    };
    currentId = record.id;
    saveRecord(record);
    localStorage.setItem(CURRENT, record.id);
    renderQuestionLocked(record);
    castStage.hidden = false;
    setProgress(2);
    castStage.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  let textPromise = null;
  async function loadText64() {
    if (textPromise) return textPromise;
    textPromise = fetch('assets/text64.json')
      .then((response) => {
        if (!response.ok) throw new Error(`원문 코퍼스 응답 ${response.status}`);
        return response.json();
      })
      .then((data) => data.hex);
    return textPromise;
  }

  function renderJuso(block) {
    if (!block?.juso?.length) return '';
    return `<details class="juso"><summary>注疏 보기 (${block.juso.length})</summary>${block.juso.map((j) => `<p class="juso-line"><span class="org">${esc(j.org)}</span><span class="trans">${esc(j.trans)}</span></p>`).join('')}</details>`;
  }

  function renderReadItem(item, hexData) {
    const h = hexData[String(item.hexNum)];
    if (!h) return '<p class="form-error">이 괘의 원문을 찾지 못했습니다.</p>';
    const star = item.main ? '★ 主' : '보조';
    const role = item.role ? ` [${esc(item.role)}]` : '';
    if (item.kind === '괘사') {
      return `<div class="read-item">
        <p class="read-head">${star}${role} · ${h.num} ${esc(h.name)} 괘사</p>
        <p class="org">${esc(h.gua.org)}</p>
        <p class="trans">${esc(h.gua.trans)}</p>
        ${renderJuso(h.gua)}
        <p class="daxiang"><b>大象</b> ${esc(h.daxiang.org)}<br>${esc(h.daxiang.trans)}</p>
        ${h.daxiang.partial ? `<p class="partial-note">※ ${esc(h.daxiang.partial)}</p>` : ''}
      </div>`;
    }
    if (item.kind === '효사') {
      const ln = h.lines[item.seat - 1];
      return `<div class="read-item">
        <p class="read-head">${star} · ${h.num} ${esc(h.name)} · ${POSITIONS[item.seat - 1]} ${esc(ln.label)}</p>
        <p class="org">${esc(ln.org)}</p>
        <p class="trans">${esc(ln.trans)}</p>
        ${renderJuso(ln)}
        ${ln.xiaoxiang ? `<p class="xiaoxiang"><b>小象</b> ${esc(ln.xiaoxiang.org)}<br>${esc(ln.xiaoxiang.trans)}</p>${renderJuso(ln.xiaoxiang)}` : ''}
        <p class="daxiang"><b>大象</b> ${esc(h.daxiang.org)} — ${esc(h.daxiang.trans)}</p>
      </div>`;
    }
    const e = h.extra[item.extraIndex];
    return `<div class="read-item">
      <p class="read-head">${star} · ${h.num} ${esc(h.name)} · ${esc(e.label)}</p>
      <p class="org">${esc(e.org)}</p>
      <p class="trans">${esc(e.trans)}</p>
      ${renderJuso(e)}
    </div>`;
  }

  async function renderReadingText(cast) {
    const host = document.querySelector('[data-reading-text]');
    if (!host) return;
    try {
      const hexData = await loadText64();
      host.innerHTML = (cast.rule.read || []).map((item) => renderReadItem(item, hexData)).join('');
    } catch (err) {
      host.innerHTML = `<p class="form-error">원문을 불러오지 못했습니다: ${esc(err.message)}</p>`;
    }
  }

  async function loadTable() {
    if (tablePromise) return tablePromise;
    tablePromise = fetch('reference/random-number-table.html')
      .then((response) => {
        if (!response.ok) throw new Error(`난수표 응답 ${response.status}`);
        return response.text();
      })
      .then((html) => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const rows = [...doc.querySelectorAll('table.nansu tbody tr')].map((tr) => ({
          n: Number(tr.querySelector('th')?.textContent.trim()),
          digits: (tr.querySelector('td')?.textContent || '').replace(/\D/g, '')
        })).sort((a, b) => a.n - b.n);
        if (rows.length !== 40 || rows.some((row, i) => row.n !== i + 1 || row.digits.length !== 50)) {
          throw new Error('난수표가 40행 × 50열 형식이 아닙니다.');
        }
        return rows.map((row) => row.digits);
      });
    return tablePromise;
  }

  function readFrom(table, row, col, length) {
    const flat = table.join('');
    const start = (row - 1) * table[0].length + col - 1;
    return Array.from({ length }, (_, i) => flat[(start + i) % flat.length]).join('');
  }

  function secureIndex(max) {
    const maxUint = 0x100000000;
    const limit = maxUint - (maxUint % max);
    const values = new Uint32Array(1);
    do crypto.getRandomValues(values); while (values[0] >= limit);
    return values[0] % max;
  }

  function shuffledRing(size) {
    const ring = Array.from({ length: size }, (_, i) => i + 1);
    for (let i = ring.length - 1; i > 0; i--) {
      const j = secureIndex(i + 1);
      [ring[i], ring[j]] = [ring[j], ring[i]];
    }
    return ring;
  }

  function afterCast(record) {
    castStage.hidden = true;
    renderResult(record);
    resultStage.hidden = false;
    guessStage.hidden = false;
    setProgress(3);
    resultStage.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function buildTablePicker() {
    const host = document.querySelector('[data-app-picker]');
    const go = host.querySelector('[data-picker-go]');
    const hint = host.querySelector('[data-picker-hint]');
    const error = host.querySelector('[data-picker-error]');
    const dials = { row: host.querySelector('[data-dial="row"]'), col: host.querySelector('[data-dial="col"]') };
    const nums = { row: dials.row.querySelector('.dial-num'), col: dials.col.querySelector('.dial-num') };
    let stage = 0;
    let timer = null;
    let ring = [];
    let at = 0;
    const picked = { row: 0, col: 0 };
    const pad = (n) => String(n).padStart(2, '0');

    function spin(which, max) {
      ring = shuffledRing(max);
      at = 0;
      nums[which].textContent = pad(ring[at]);
      dials[which].classList.add('spinning');
      timer = setInterval(() => {
        at = (at + 1) % ring.length;
        nums[which].textContent = pad(ring[at]);
      }, TICK);
    }

    function stop(which) {
      clearInterval(timer);
      timer = null;
      picked[which] = ring[at];
      nums[which].textContent = pad(picked[which]);
      dials[which].classList.remove('spinning');
      dials[which].classList.add('locked');
    }

    async function finish() {
      go.disabled = true;
      error.textContent = '';
      hint.textContent = `${picked.row}행 ${picked.col}열을 읽고 있습니다.`;
      try {
        const table = await loadTable();
        const digits = readFrom(table, picked.row, picked.col, 24);
        const before = loadRecords().find((record) => record.cast?.source?.row === picked.row && record.cast?.source?.col === picked.col);
        if (before) {
          throw new Error(`이 좌표는 ${localTime(before.cast.at)}에 이미 사용했습니다. 새 좌표를 골라 주세요.`);
        }
        const cast = castFromTable(digits, picked.row, picked.col);
        const record = updateRecord(currentId, { status: 'cast', cast, reading: buildReading(cast) });
        afterCast(record);
      } catch (err) {
        error.textContent = err.message;
        go.disabled = false;
        go.textContent = '다른 좌표 뽑기';
        hint.textContent = '';
        stage = 3;
      }
    }

    function reset() {
      clearInterval(timer);
      timer = null;
      stage = 0;
      go.disabled = false;
      go.textContent = '시작';
      hint.textContent = '행을 멈춘 다음, 열을 멈춥니다.';
      error.textContent = '';
      ['row', 'col'].forEach((which) => {
        picked[which] = 0;
        nums[which].textContent = '--';
        dials[which].classList.remove('spinning', 'locked');
      });
    }

    go.addEventListener('click', () => {
      if (stage === 0) {
        stage = 1;
        spin('row', 40);
        go.textContent = '행 멈추기';
        hint.textContent = '행이 돌고 있습니다. 멈추고 싶을 때 누르세요.';
      } else if (stage === 1) {
        stop('row');
        stage = 2;
        spin('col', 50);
        go.textContent = '열 멈추기';
        hint.textContent = `${picked.row}행 확정. 이제 열을 멈추세요.`;
      } else if (stage === 2) {
        stop('col');
        stage = 3;
        finish();
      } else {
        reset();
      }
    });

    return { reset };
  }

  function buildCoinPicker() {
    const host = document.querySelector('[data-coin-picker]');
    const rows = host.querySelector('[data-coin-rows]');
    const go = host.querySelector('[data-coin-go]');
    const error = host.querySelector('[data-coin-error]');
    const selects = POSITIONS.map((label) => {
      const row = document.createElement('label');
      row.className = 'coin-row';
      row.innerHTML = `<span>${label}</span><select>
        <option value="">--</option>
        <option value="6">6 · 老陰(변)</option>
        <option value="7">7 · 少陽</option>
        <option value="8">8 · 少陰</option>
        <option value="9">9 · 老陽(변)</option>
      </select>`;
      rows.appendChild(row);
      return row.querySelector('select');
    });

    function checkReady() {
      go.disabled = selects.some((select) => !select.value);
    }
    selects.forEach((select) => select.addEventListener('change', checkReady));

    go.addEventListener('click', () => {
      error.textContent = '';
      const values = selects.map((select) => Number(select.value));
      const cast = castFromCoins(values);
      const record = updateRecord(currentId, { status: 'cast', cast, reading: buildReading(cast) });
      afterCast(record);
    });

    function reset() {
      selects.forEach((select) => { select.value = ''; });
      go.disabled = true;
      error.textContent = '';
    }

    return { reset };
  }

  function buildMethodTabs(tablePicker, coinPicker) {
    const tabs = [...document.querySelectorAll('[data-method]')];
    const panels = {
      table: document.querySelector('[data-app-picker]'),
      coin: document.querySelector('[data-coin-picker]')
    };
    tabs.forEach((tab) => tab.addEventListener('click', () => {
      const method = tab.dataset.method;
      if (tab.classList.contains('active')) return;
      tabs.forEach((btn) => btn.classList.toggle('active', btn === tab));
      panels.table.hidden = method !== 'table';
      panels.coin.hidden = method !== 'coin';
      tablePicker.reset();
      coinPicker.reset();
    }));
  }

  function valueFromFour(chunk) {
    const odd = [...chunk].map((digit) => Number(digit) % 2 === 1);
    const changes = [odd[0] && odd[1] ? 9 : 5, odd[2] ? 8 : 4, odd[3] ? 8 : 4];
    const large = changes.filter((value) => value === 9 || value === 8).length;
    return { value: 9 - large, changes };
  }

  function lineLabel(position, value) {
    const force = value === 7 || value === 9 ? '九' : '六';
    if (position === 0) return `初${force}`;
    if (position === 5) return `上${force}`;
    return `${force}${HANJA_NUM[position]}`;
  }

  function readingRule(values, result) {
    const moving = result.movingAt;
    const count = moving.length;
    const still = [1, 2, 3, 4, 5, 6].filter((position) => !moving.includes(position));
    const changed = values.map((value) => value === 6 ? 7 : value === 9 ? 8 : value);
    if (count === 0) return { title: '六爻不變 — 본괘의 괘사', detail: `${result.ben.name}의 괘사를 읽습니다. 효사는 고르지 않습니다.`, main: `본괘 ${result.ben.num} ${result.ben.name}`, read: [{ kind: '괘사', hexNum: result.ben.num, main: true }] };
    if (count === 1) {
      const pos = moving[0];
      return { title: '一爻變 — 본괘의 변효 효사', detail: `${POSITIONS[pos - 1]} ${lineLabel(pos - 1, values[pos - 1])}를 읽습니다.`, main: `${result.ben.name} ${lineLabel(pos - 1, values[pos - 1])}`, read: [{ kind: '효사', hexNum: result.ben.num, seat: pos, main: true }] };
    }
    if (count === 2) {
      const main = Math.max(...moving);
      return { title: '二爻變 — 본괘의 두 변효 효사', detail: `${moving.map((pos) => lineLabel(pos - 1, values[pos - 1])).join('·')}를 모두 읽고, 주자 규약에 따라 위쪽 ${lineLabel(main - 1, values[main - 1])}를 主로 삼습니다.`, main: `${result.ben.name} ${lineLabel(main - 1, values[main - 1])}`, read: moving.map((pos) => ({ kind: '효사', hexNum: result.ben.num, seat: pos, main: pos === main })) };
    }
    if (count === 3) {
      const zh = zhenHui(moving);
      return { title: '三爻變 — 본괘와 지괘의 괘사', detail: `${zh.rank}/20 ${zh.half}이므로 主는 ${zh.main}(${zh.mainHex})입니다. 두 괘사를 함께 읽되 ${zh.mainHex} 쪽에 무게를 둡니다.`, main: `${zh.mainHex} ${zh.front ? result.ben.num : result.zhi.num} ${zh.front ? result.ben.name : result.zhi.name}`, zhenhui: zh, read: [
        { kind: '괘사', hexNum: result.ben.num, main: zh.main === '貞', role: '貞(본괘)' },
        { kind: '괘사', hexNum: result.zhi.num, main: zh.main === '悔', role: '悔(지괘)' }
      ] };
    }
    if (count === 4) {
      const main = Math.min(...still);
      return { title: '四爻變 — 지괘의 불변효 두 효사', detail: `${still.map((pos) => lineLabel(pos - 1, changed[pos - 1])).join('·')}를 읽고, 아래쪽 ${lineLabel(main - 1, changed[main - 1])}를 主로 삼습니다.`, main: `${result.zhi.name} ${lineLabel(main - 1, changed[main - 1])}`, read: still.map((pos) => ({ kind: '효사', hexNum: result.zhi.num, seat: pos, main: pos === main })) };
    }
    if (count === 5) {
      const pos = still[0];
      return { title: '五爻變 — 지괘의 불변효 효사', detail: `${POSITIONS[pos - 1]} ${lineLabel(pos - 1, changed[pos - 1])} 하나를 읽습니다.`, main: `${result.zhi.name} ${lineLabel(pos - 1, changed[pos - 1])}`, read: [{ kind: '효사', hexNum: result.zhi.num, seat: pos, main: true }] };
    }
    const special = result.ben.num === 1 ? '건괘의 用九를 읽습니다.' : result.ben.num === 2 ? '곤괘의 用六을 읽습니다.' : `${result.zhi.name}의 괘사를 읽습니다.`;
    const read = result.ben.num === 1 || result.ben.num === 2
      ? [{ kind: '用', hexNum: result.ben.num, extraIndex: 0, main: true }]
      : [{ kind: '괘사', hexNum: result.zhi.num, main: true }];
    return { title: '六爻變 — 지괘의 괘사', detail: special, main: result.ben.num === 1 ? '乾 用九' : result.ben.num === 2 ? '坤 用六' : `지괘 ${result.zhi.num} ${result.zhi.name}`, read };
  }

  function finalizeCast(values, source, rolls) {
    const result = readCast(values);
    const rule = readingRule(values, result);
    return {
      at: now(),
      source,
      rolls: rolls || null,
      values,
      ben: result.ben,
      zhi: result.movingAt.length ? result.zhi : null,
      moving: result.movingAt,
      rule
    };
  }

  function castFromTable(digits, row, col) {
    const rolls = Array.from({ length: 6 }, (_, i) => {
      const chunk = digits.slice(i * 4, i * 4 + 4);
      return { position: i + 1, digits: chunk, ...valueFromFour(chunk) };
    });
    const values = rolls.map((roll) => roll.value);
    return finalizeCast(values, { method: '난수표 방법 B', row, col, digits }, rolls);
  }

  function castFromCoins(values) {
    return finalizeCast(values, { method: '동전' });
  }

  function buildReading(cast) {
    return [`읽을 곳: ${cast.rule.main}`, cast.rule.title, cast.rule.detail].join('\n');
  }

  function renderResult(record) {
    if (!record?.cast) return;
    currentId = record.id;
    const cast = record.cast;
    const movingNames = cast.moving.map((pos) => POSITIONS[pos - 1]);
    const coordLine = cast.source.method === '동전'
      ? '<p><b>방법</b> 동전 (직접 입력)</p>'
      : `<p><b>좌표</b> ${cast.source.row}행 ${cast.source.col}열</p><p class="digits-line"><b>숫자열</b> ${esc(cast.source.digits)}</p>`;
    resultHost.innerHTML = `
      <div class="result-summary">
        <div class="hex-panel"><h3>본괘 ${cast.ben.num} ${esc(cast.ben.name)}</h3><div data-ben-hex></div></div>
        ${cast.zhi ? '<div class="result-arrow" aria-hidden="true">→</div>' : '<div></div>'}
        ${cast.zhi ? `<div class="hex-panel"><h3>지괘 ${cast.zhi.num} ${esc(cast.zhi.name)}</h3><div data-zhi-hex></div></div>` : '<div class="hex-panel"><h3>변효 없음</h3><p>본괘의 괘사를 읽습니다.</p></div>'}
      </div>
      <div class="result-meta">
        <p><b>직접 뽑은 효</b> ${cast.values.join(' · ')} <small>(초효→상효)</small></p>
        <p><b>변효</b> ${movingNames.length ? esc(movingNames.join(' · ')) : '없음'}</p>
        ${coordLine}
      </div>
      <div class="reading-rule">
        <h3>고변점 추출문</h3>
        <p class="reading-target">主: ${esc(cast.rule.main)}</p>
        <p class="rule-detail">${esc(cast.rule.title)} — ${esc(cast.rule.detail)}</p>
        <p class="saved-note">이 규칙 판정은 이 기기에 자동 저장되었습니다.</p>
      </div>
      <div class="reading-text" data-reading-text><p class="loading-note">괘사·효사 원문을 불러오는 중…</p></div>
      <p class="source-links"><b>번역·注疏</b> <a href="${TRANS_LINK[cast.ben.num]}" target="_blank" rel="noopener">본괘 ${cast.ben.num}번</a>${cast.zhi ? ` · <a href="${TRANS_LINK[cast.zhi.num]}" target="_blank" rel="noopener">지괘 ${cast.zhi.num}번</a>` : ''}<br><b>현토 원문</b> <a href="${DB_LINK[cast.ben.num]}" target="_blank" rel="noopener">본괘 ${cast.ben.num}번</a>${cast.zhi ? ` · <a href="${DB_LINK[cast.zhi.num]}" target="_blank" rel="noopener">지괘 ${cast.zhi.num}번</a>` : ''}</p>`;
    drawHex(resultHost.querySelector('[data-ben-hex]'), cast.values);
    if (cast.zhi) {
      drawHex(resultHost.querySelector('[data-zhi-hex]'), cast.values.map((value) => value === 6 ? 7 : value === 9 ? 8 : value));
    }
    renderReadingText(cast);
  }

  guessForm.addEventListener('submit', (event) => {
    event.preventDefault();
    guessError.textContent = '';
    if (!guessForm.reportValidity()) return;
    const data = new FormData(guessForm);
    const text = String(data.get('guess') || '').trim();
    if (!text) {
      guessError.textContent = '의견을 적어 주세요.';
      return;
    }
    const record = updateRecord(currentId, { status: 'answered', guess: { text, at: now() } });
    renderGuessLocked(record);
    setProgress(4);
  });

  document.querySelector('[data-copy-packet]').addEventListener('click', async () => {
    const record = getRecord(currentId);
    if (!record?.cast) return;
    const packet = `主: ${record.cast.rule.main}`;
    try {
      await navigator.clipboard.writeText(packet);
      saveStatus.textContent = '고변점 추출문(主)을 복사했습니다.';
    } catch {
      saveStatus.textContent = '자동 복사가 막혔습니다. HTTPS에서 다시 시도해 주세요.';
    }
  });

  function renderRecords() {
    const records = loadRecords();
    emptyState.hidden = records.length > 0;
    recordsHost.innerHTML = records.map((record, index) => {
      const castName = record.cast ? `${record.cast.ben.num} ${record.cast.ben.name}${record.cast.zhi ? ` → ${record.cast.zhi.num} ${record.cast.zhi.name}` : ''}` : '괘를 뽑기 전';
      const state = record.status === 'answered' ? '완료'
        : record.status === 'abandoned' ? '중단 기록'
        : record.cast ? '의견 대기'
        : '괘 대기';
      const guess = guessText(record);
      return `<details class="record"${index === 0 ? ' open' : ''}>
        <summary>
          <span class="record-id">${String(records.length - index).padStart(3, '0')}</span>
          <span class="record-title"><b>${esc(record.question)}</b><small>${esc(castName)} · ${esc(localTime(record.created_at))}</small></span>
          <span class="record-state${record.status === 'answered' ? ' done' : ''}">${esc(state)}</span>
        </summary>
        <div class="record-body">
          <dl>
            ${record.cast ? `<dt>읽을 곳</dt><dd>${esc(record.cast.rule.main)}</dd>` : ''}
            ${guess ? `<dt>내 의견</dt><dd>${esc(guess)}</dd>` : ''}
            ${record.outcome ? `<dt>실제 사실</dt><dd>${esc(record.outcome.facts)}</dd><dt>판정</dt><dd>${esc(RATING[record.outcome.rating] || record.outcome.rating)}</dd>${record.outcome.note ? `<dt>메모</dt><dd>${esc(record.outcome.note)}</dd>` : ''}` : ''}
          </dl>
        </div>
      </details>`;
    }).join('');
  }

  document.querySelector('[data-export]').addEventListener('click', async () => {
    const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
    const filename = `juyeok-records-${stamp}.json`;
    const json = JSON.stringify({ schema: 3, exported_at: now(), records: loadRecords() }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const file = new File([blob], filename, { type: 'application/json' });
    exportStatus.textContent = '';
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: '주역 기록 JSON', files: [file] });
        exportStatus.textContent = '공유 시트에서 JSON 파일을 내보냈습니다.';
        return;
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        exportStatus.textContent = '내보내기를 취소했습니다.';
        return;
      }
    }
    const isiOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isiOS) {
      try {
        await navigator.clipboard.writeText(json);
        exportStatus.textContent = '파일 공유를 지원하지 않아 JSON을 클립보드에 복사했습니다.';
      } catch {
        exportStatus.textContent = 'Safari에서 내보내지 못했습니다. 공유 권한을 확인해 주세요.';
      }
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    exportStatus.textContent = 'JSON 파일을 내려받았습니다.';
  });

  document.querySelector('[data-import]').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (![1, 2, 3].includes(data.schema) || !Array.isArray(data.records)) throw new Error('이 앱의 기록 파일 형식이 아닙니다.');
      const current = loadRecords();
      const byId = new Map(current.map((record) => [record.id, record]));
      data.records.forEach((record) => {
        if (!record.id || !record.question) throw new Error('필수 항목이 없는 기록이 있습니다.');
        if (!byId.has(record.id)) byId.set(record.id, record);
      });
      saveRecords([...byId.values()].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))));
      renderRecords();
    } catch (err) {
      alert(`가져오지 못했습니다: ${err.message}`);
    } finally {
      event.target.value = '';
    }
  });

  document.querySelector('[data-clear-all]').addEventListener('click', () => {
    if (!confirm('이 기기에 저장된 모든 질문·괘·결과를 지울까요? 먼저 JSON으로 내보내면 복구할 수 있습니다.')) return;
    localStorage.removeItem(STORE);
    localStorage.removeItem(CURRENT);
    location.reload();
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstall = event;
    document.querySelector('[data-install]').hidden = false;
  });
  document.querySelector('[data-install]').addEventListener('click', async (event) => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
    event.currentTarget.hidden = true;
  });

  function updateNetwork() {
    document.querySelector('[data-network]').textContent = navigator.onLine ? '기기 안에만 저장' : '오프라인 · 기기 안에 저장';
  }
  window.addEventListener('online', updateNetwork);
  window.addEventListener('offline', updateNetwork);

  async function init() {
    updateNetwork();
    const records = loadRecords();
    let migrated = false;
    records.forEach((record) => {
      if (record.cast && !record.reading) {
        record.reading = buildReading(record.cast);
        record.updated_at = now();
        migrated = true;
      }
    });
    if (migrated) saveRecords(records);
    renderRecords();
    const tablePicker = buildTablePicker();
    const coinPicker = buildCoinPicker();
    buildMethodTabs(tablePicker, coinPicker);
    const savedId = localStorage.getItem(CURRENT);
    const current = savedId && getRecord(savedId);
    if (current?.status === 'question' && !current.cast) {
      currentId = current.id;
      renderQuestionLocked(current);
      castStage.hidden = false;
      setProgress(2);
    } else if (current?.cast) {
      currentId = current.id;
      renderQuestionLocked(current);
      renderResult(current);
      resultStage.hidden = false;
      guessStage.hidden = false;
      if (current.guess) renderGuessLocked(current);
      setProgress(current.guess ? 4 : 3);
    }
    try {
      await loadTable();
    } catch (err) {
      document.querySelector('[data-picker-error]').textContent = `난수표를 준비하지 못했습니다: ${err.message}`;
    }
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch((err) => console.warn('서비스 워커 등록 실패', err));
    }
  }

  init();
})();
