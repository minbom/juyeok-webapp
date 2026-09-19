/* 팔괘 인식 드릴 + 64괘 찾기 도구. assets/hex64.js와 assets/hexagram.js 뒤에 불러올 것. */

document.querySelectorAll('[data-tri-drill]').forEach((box) => {
  const stage = box.querySelector('[data-stage]');
  const choices = box.querySelector('[data-choices]');
  const fb = box.querySelector('.feedback');
  const score = box.querySelector('[data-score]');
  let answer = null, done = 0, hit = 0, locked = false;

  const draw = () => {
    answer = TRI_ORDER[Math.floor(Math.random() * 8)];
    const bits = TRIGRAMS[answer].bits; // 하→상
    stage.innerHTML = '';
    stage.className = 'hex';
    for (let i = 0; i < 3; i++) {
      const row = document.createElement('div');
      row.className = 'hex-row';
      row.innerHTML = `<span class="hex-pos">${['아래', '가운데', '위'][i]}</span>` +
        `<span class="yao ${bits[i] === '1' ? 'yang' : 'yin'}"></span><span></span>`;
      stage.appendChild(row);
    }
    locked = false;
  };

  TRI_ORDER.forEach((t) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `${TRIGRAMS[t].ko} ${t}<br><small style="opacity:.7">${TRIGRAMS[t].nature}</small>`;
    b.style.textAlign = 'center';
    b.addEventListener('click', () => {
      if (locked) return;
      locked = true;
      done++;
      const ok = t === answer;
      if (ok) hit++;
      const a = TRIGRAMS[answer];
      fb.className = `feedback ${ok ? 'good' : 'again'}`;
      fb.textContent = ok
        ? `정답 — ${a.ko}(${answer}), ${a.nature}. 다음 문제로 넘어갑니다.`
        : `아닙니다. 아래에서 위로 ${a.bits.split('').map((x) => (x === '1' ? '양' : '음')).join('·')} 이므로 ${a.ko}(${answer}), ${a.nature}입니다.`;
      score.textContent = `${done}문제 중 ${hit}개 정답`;
      setTimeout(draw, ok ? 900 : 2600);
    });
    choices.appendChild(b);
  });
  draw();
});

document.querySelectorAll('[data-lookup]').forEach((box) => {
  const up = box.querySelector('[data-up]');
  const lo = box.querySelector('[data-lo]');
  const out = box.querySelector('output');
  TRI_ORDER.forEach((t) => {
    const label = `${TRIGRAMS[t].ko} ${t} (${TRIGRAMS[t].nature})`;
    up.insertAdjacentHTML('beforeend', `<option value="${t}">${label}</option>`);
    lo.insertAdjacentHTML('beforeend', `<option value="${t}">${label}</option>`);
  });
  const run = () => {
    const h = lookupHex(up.value, lo.value);
    out.textContent = h
      ? `제${h.num}괘 · ${h.name} — 위가 ${TRIGRAMS[up.value].nature}(${up.value}), 아래가 ${TRIGRAMS[lo.value].nature}(${lo.value})`
      : '찾을 수 없습니다.';
  };
  up.addEventListener('change', run);
  lo.addEventListener('change', run);
  run();
});
