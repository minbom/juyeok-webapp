/* 모바일 주역 실전 기록 앱.
   질문·사전등록·결과는 localStorage에만 둔다. 네트워크로 전송하지 않는다.
   난수표는 reference/random-number-table.html을 읽어 기존 파생본을 단일 원천으로 쓴다. */
(() => {
  'use strict';

  const STORE = 'juyeok-web-records-v2';
  const CURRENT = 'juyeok-web-current-v2';
  const TICK = 48;
  const POSITIONS = ['초효', '2효', '3효', '4효', '5효', '상효'];
  const HANJA_NUM = ['初', '二', '三', '四', '五', '上'];
  const RATING = { hit: '대체로 맞음', mixed: '섞여 있음', miss: '대체로 틀림', unclear: '판정 불가' };

  const preregForm = document.querySelector('[data-prereg-form]');
  const preregLocked = document.querySelector('[data-prereg-locked]');
  const preregError = document.querySelector('[data-prereg-error]');
  const pickerStage = document.querySelector('[data-stage="picker"]');
  const resultStage = document.querySelector('[data-stage="result"]');
  const resultHost = document.querySelector('[data-cast-result]');
  const interpretation = document.querySelector('[data-interpretation]');
  const saveStatus = document.querySelector('[data-save-status]');
  const recordsHost = document.querySelector('[data-records]');
  const emptyState = document.querySelector('[data-empty]');
  const dialog = document.querySelector('[data-outcome-dialog]');
  const outcomeForm = document.querySelector('[data-outcome-form]');
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

  function setProgress(n) {
    document.querySelectorAll('[data-progress]').forEach((el) => {
      const step = Number(el.dataset.progress);
      el.classList.toggle('active', step === n);
      el.classList.toggle('done', step < n);
    });
  }

  function renderLocked(record) {
    preregForm.hidden = true;
    preregLocked.hidden = false;
    preregLocked.innerHTML = `
      <h3>사전등록 잠김</h3>
      <dl>
        <dt>질문</dt><dd>${esc(record.question)}</dd>
        <dt>관측 계획</dt><dd>${esc(record.prereg.observation_plan)}</dd>
        <dt>내 예상</dt><dd>${esc(record.prereg.prediction)}</dd>
        <dt>반증 조건</dt><dd>${esc(record.prereg.falsifier)}</dd>
      </dl>
      <p class="lock-time">${esc(localTime(record.prereg.at))}에 잠김 · 수정 불가</p>
      <button type="button" data-abandon>${record.cast ? '새 질문으로 시작' : '이 기록을 중단하고 새 질문 쓰기'}</button>`;
    preregLocked.querySelector('[data-abandon]').addEventListener('click', () => {
      if (!record.cast) updateRecord(record.id, { status: 'abandoned', abandoned_at: now() });
      localStorage.removeItem(CURRENT);
      location.reload();
    });
  }

  preregForm.addEventListener('submit', (event) => {
    event.preventDefault();
    preregError.textContent = '';
    if (!preregForm.reportValidity()) return;
    const data = new FormData(preregForm);
    const fields = ['question', 'plan', 'prediction', 'falsifier'];
    if (fields.some((key) => !String(data.get(key) || '').trim())) {
      preregError.textContent = '네 칸을 모두 채워 주세요.';
      return;
    }
    const record = {
      schema: 1,
      id: makeId(),
      status: 'preregistered',
      created_at: now(),
      updated_at: now(),
      question: String(data.get('question')).trim(),
      prereg: {
        observation_plan: String(data.get('plan')).trim(),
        prediction: String(data.get('prediction')).trim(),
        falsifier: String(data.get('falsifier')).trim(),
        at: now()
      },
      cast: null,
      interpretation: '',
      outcome: null
    };
    currentId = record.id;
    saveRecord(record);
    localStorage.setItem(CURRENT, record.id);
    renderLocked(record);
    pickerStage.hidden = false;
    setProgress(2);
    pickerStage.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

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

  function buildPicker() {
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
        const cast = castDigits(digits, picked.row, picked.col);
        updateRecord(currentId, { status: 'cast', cast });
        renderResult(getRecord(currentId));
        resultStage.hidden = false;
        pickerStage.hidden = true;
        setProgress(3);
        resultStage.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    if (count === 0) return { title: '六爻不變 — 본괘의 괘사', detail: `${result.ben.name}의 괘사를 읽습니다. 효사는 고르지 않습니다.`, main: `본괘 ${result.ben.num} ${result.ben.name}` };
    if (count === 1) {
      const pos = moving[0];
      return { title: '一爻變 — 본괘의 변효 효사', detail: `${POSITIONS[pos - 1]} ${lineLabel(pos - 1, values[pos - 1])}를 읽습니다.`, main: `${result.ben.name} ${lineLabel(pos - 1, values[pos - 1])}` };
    }
    if (count === 2) {
      const main = Math.max(...moving);
      return { title: '二爻變 — 본괘의 두 변효 효사', detail: `${moving.map((pos) => lineLabel(pos - 1, values[pos - 1])).join('·')}를 모두 읽고, 주자 규약에 따라 위쪽 ${lineLabel(main - 1, values[main - 1])}를 主로 삼습니다.`, main: `${result.ben.name} ${lineLabel(main - 1, values[main - 1])}` };
    }
    if (count === 3) {
      const zh = zhenHui(moving);
      return { title: '三爻變 — 본괘와 지괘의 괘사', detail: `${zh.rank}/20 ${zh.half}이므로 主는 ${zh.main}(${zh.mainHex})입니다. 두 괘사를 함께 읽되 ${zh.mainHex} 쪽에 무게를 둡니다.`, main: `${zh.mainHex} ${zh.front ? result.ben.num : result.zhi.num} ${zh.front ? result.ben.name : result.zhi.name}`, zhenhui: zh };
    }
    if (count === 4) {
      const main = Math.min(...still);
      return { title: '四爻變 — 지괘의 불변효 두 효사', detail: `${still.map((pos) => lineLabel(pos - 1, changed[pos - 1])).join('·')}를 읽고, 아래쪽 ${lineLabel(main - 1, changed[main - 1])}를 主로 삼습니다.`, main: `${result.zhi.name} ${lineLabel(main - 1, changed[main - 1])}` };
    }
    if (count === 5) {
      const pos = still[0];
      return { title: '五爻變 — 지괘의 불변효 효사', detail: `${POSITIONS[pos - 1]} ${lineLabel(pos - 1, changed[pos - 1])} 하나를 읽습니다.`, main: `${result.zhi.name} ${lineLabel(pos - 1, changed[pos - 1])}` };
    }
    const special = result.ben.num === 1 ? '건괘의 用九를 읽습니다.' : result.ben.num === 2 ? '곤괘의 用六을 읽습니다.' : `${result.zhi.name}의 괘사를 읽습니다.`;
    return { title: '六爻變 — 지괘의 괘사', detail: special, main: result.ben.num === 1 ? '乾 用九' : result.ben.num === 2 ? '坤 用六' : `지괘 ${result.zhi.num} ${result.zhi.name}` };
  }

  function castDigits(digits, row, col) {
    const rolls = Array.from({ length: 6 }, (_, i) => {
      const chunk = digits.slice(i * 4, i * 4 + 4);
      return { position: i + 1, digits: chunk, ...valueFromFour(chunk) };
    });
    const values = rolls.map((roll) => roll.value);
    const result = readCast(values);
    const rule = readingRule(values, result);
    return {
      at: now(),
      source: { method: '난수표 방법 B', row, col, digits },
      rolls,
      values,
      ben: result.ben,
      zhi: result.movingAt.length ? result.zhi : null,
      moving: result.movingAt,
      rule
    };
  }

  function renderResult(record) {
    if (!record?.cast) return;
    currentId = record.id;
    const cast = record.cast;
    const movingNames = cast.moving.map((pos) => POSITIONS[pos - 1]);
    resultHost.innerHTML = `
      <div class="result-summary">
        <div class="hex-panel"><h3>본괘 ${cast.ben.num} ${esc(cast.ben.name)}</h3><div data-ben-hex></div></div>
        ${cast.zhi ? '<div class="result-arrow" aria-hidden="true">→</div>' : '<div></div>'}
        ${cast.zhi ? `<div class="hex-panel"><h3>지괘 ${cast.zhi.num} ${esc(cast.zhi.name)}</h3><div data-zhi-hex></div></div>` : '<div class="hex-panel"><h3>변효 없음</h3><p>본괘의 괘사를 읽습니다.</p></div>'}
      </div>
      <div class="result-meta">
        <p><b>직접 뽑은 효</b> ${cast.values.join(' · ')} <small>(초효→상효)</small></p>
        <p><b>변효</b> ${movingNames.length ? esc(movingNames.join(' · ')) : '없음'}</p>
        <p><b>좌표</b> ${cast.source.row}행 ${cast.source.col}열</p>
        <p class="digits-line"><b>숫자열</b> ${esc(cast.source.digits)}</p>
      </div>
      <div class="reading-rule">
        <h3>${esc(cast.rule.title)}</h3>
        <p>${esc(cast.rule.detail)}</p>
        <p><b>主:</b> ${esc(cast.rule.main)}</p>
      </div>
      <p class="source-links"><b>번역·注疏</b> <a href="${TRANS_LINK[cast.ben.num]}" target="_blank" rel="noopener">본괘 ${cast.ben.num}번</a>${cast.zhi ? ` · <a href="${TRANS_LINK[cast.zhi.num]}" target="_blank" rel="noopener">지괘 ${cast.zhi.num}번</a>` : ''}<br><b>현토 원문</b> <a href="${DB_LINK[cast.ben.num]}" target="_blank" rel="noopener">본괘 ${cast.ben.num}번</a>${cast.zhi ? ` · <a href="${DB_LINK[cast.zhi.num]}" target="_blank" rel="noopener">지괘 ${cast.zhi.num}번</a>` : ''}</p>`;
    drawHex(resultHost.querySelector('[data-ben-hex]'), cast.values);
    if (cast.zhi) {
      drawHex(resultHost.querySelector('[data-zhi-hex]'), cast.values.map((value) => value === 6 ? 7 : value === 9 ? 8 : value));
    }
    interpretation.value = record.interpretation || '';
  }

  document.querySelector('[data-save-interpretation]').addEventListener('click', () => {
    if (!currentId) return;
    updateRecord(currentId, { interpretation: interpretation.value.trim() });
    saveStatus.textContent = `이 기기에 저장했습니다 · ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
  });

  document.querySelector('[data-copy-packet]').addEventListener('click', async () => {
    const record = getRecord(currentId);
    if (!record?.cast) return;
    const packet = [
      `질문: ${record.question}`,
      `사전등록 시각: ${record.prereg.at}`,
      `관측 계획: ${record.prereg.observation_plan}`,
      `괘 전 예상: ${record.prereg.prediction}`,
      `반증 조건: ${record.prereg.falsifier}`,
      '',
      `난수표 ${record.cast.source.row}행 ${record.cast.source.col}열 → ${record.cast.source.digits}`,
      `효값: ${record.cast.values.join(' ')} (초효→상효)`,
      `본괘 ${record.cast.ben.num} ${record.cast.ben.name}`,
      `변효: ${record.cast.moving.length ? record.cast.moving.map((p) => POSITIONS[p - 1]).join('·') : '없음'}`,
      record.cast.zhi ? `지괘 ${record.cast.zhi.num} ${record.cast.zhi.name}` : '',
      `고변점: ${record.cast.rule.title} / 主 ${record.cast.rule.main}`,
      '',
      '위 사전등록은 괘를 보기 전에 잠겼습니다. 《주역정의》의 해당 經文·注疏와 大象을 확인하고, 이름의 인상에서 출발하지 말고 한국어 해석문을 작성해 주세요.'
    ].filter((line) => line !== '').join('\n');
    try {
      await navigator.clipboard.writeText(packet);
      saveStatus.textContent = '해석용 묶음을 복사했습니다.';
    } catch {
      saveStatus.textContent = '자동 복사가 막혔습니다. HTTPS에서 다시 시도해 주세요.';
    }
  });

  function renderRecords() {
    const records = loadRecords();
    emptyState.hidden = records.length > 0;
    recordsHost.innerHTML = records.map((record, index) => {
      const castName = record.cast ? `${record.cast.ben.num} ${record.cast.ben.name}${record.cast.zhi ? ` → ${record.cast.zhi.num} ${record.cast.zhi.name}` : ''}` : '괘를 뽑기 전';
      const state = record.outcome ? RATING[record.outcome.rating] : record.status === 'abandoned' ? '중단 기록' : record.cast ? '결과 대기' : '사전등록만';
      return `<details class="record"${index === 0 ? ' open' : ''}>
        <summary>
          <span class="record-id">${String(records.length - index).padStart(3, '0')}</span>
          <span class="record-title"><b>${esc(record.question)}</b><small>${esc(castName)} · ${esc(localTime(record.created_at))}</small></span>
          <span class="record-state${record.outcome ? ' done' : ''}">${esc(state)}</span>
        </summary>
        <div class="record-body">
          <dl>
            <dt>관측 계획</dt><dd>${esc(record.prereg?.observation_plan)}</dd>
            <dt>괘 전 예상</dt><dd>${esc(record.prereg?.prediction)}</dd>
            <dt>반증 조건</dt><dd>${esc(record.prereg?.falsifier)}</dd>
            ${record.interpretation ? `<dt>내 해석</dt><dd>${esc(record.interpretation)}</dd>` : ''}
            ${record.outcome ? `<dt>실제 사실</dt><dd>${esc(record.outcome.facts)}</dd><dt>판정</dt><dd>${esc(RATING[record.outcome.rating])}</dd>${record.outcome.note ? `<dt>메모</dt><dd>${esc(record.outcome.note)}</dd>` : ''}` : ''}
          </dl>
          ${record.cast && !record.outcome ? `<div class="button-row"><button type="button" data-outcome-id="${esc(record.id)}">실제 결과 기록</button></div>` : ''}
        </div>
      </details>`;
    }).join('');
    recordsHost.querySelectorAll('[data-outcome-id]').forEach((button) => {
      button.addEventListener('click', () => openOutcome(button.dataset.outcomeId));
    });
  }

  function openOutcome(id) {
    outcomeForm.reset();
    outcomeForm.elements.id.value = id;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  document.querySelector('[data-close-dialog]').addEventListener('click', () => dialog.close());
  outcomeForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!outcomeForm.reportValidity()) return;
    const data = new FormData(outcomeForm);
    updateRecord(String(data.get('id')), {
      outcome: { recorded_at: now(), facts: String(data.get('facts')).trim(), rating: String(data.get('rating')), note: String(data.get('note')).trim() }
    });
    dialog.close();
    setProgress(4);
  });

  document.querySelector('[data-export]').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ schema: 1, exported_at: now(), records: loadRecords() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `juyeok-records-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  document.querySelector('[data-import]').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.schema !== 1 || !Array.isArray(data.records)) throw new Error('이 앱의 기록 파일 형식이 아닙니다.');
      const current = loadRecords();
      const byId = new Map(current.map((record) => [record.id, record]));
      data.records.forEach((record) => {
        if (!record.id || !record.prereg || !record.question) throw new Error('필수 항목이 없는 기록이 있습니다.');
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
    renderRecords();
    buildPicker();
    const savedId = localStorage.getItem(CURRENT);
    const current = savedId && getRecord(savedId);
    if (current?.status === 'preregistered' && !current.cast) {
      currentId = current.id;
      renderLocked(current);
      pickerStage.hidden = false;
      setProgress(2);
    } else if (current?.cast) {
      currentId = current.id;
      renderLocked(current);
      renderResult(current);
      resultStage.hidden = false;
      setProgress(current.outcome ? 4 : 3);
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
