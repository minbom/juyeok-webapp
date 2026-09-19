/* 주역 워크스페이스 공용 컴포넌트
   - drawHex(container, values)  : 6개의 효값(6/7/8/9) 배열을 괘 그림으로 렌더링
   - [data-caster]               : 동전 3개를 여섯 번 던져 본괘를 아래에서 위로 쌓는 위젯
   효값 규약: 6=노음(변효), 7=소양, 8=소음, 9=노양(변효). 배열의 0번이 초효(맨 아래). */

const YAO = {
  6: { cls: 'yin moving',  name: '노음',   note: '음이지만 변한다' },
  7: { cls: 'yang',        name: '소양',   note: '양, 변하지 않는다' },
  8: { cls: 'yin',         name: '소음',   note: '음, 변하지 않는다' },
  9: { cls: 'yang moving', name: '노양',   note: '양이지만 변한다' },
};
const POS = ['초효', '2효', '3효', '4효', '5효', '상효'];

function drawHex(container, values) {
  container.innerHTML = '';
  container.classList.add('hex');
  for (let i = 0; i < 6; i++) {
    const v = values[i];
    const row = document.createElement('div');
    row.className = 'hex-row';
    const meta = v ? YAO[v] : null;
    row.innerHTML = `<span class="hex-pos">${POS[i]}</span>` +
      `<span class="yao ${meta ? meta.cls : 'empty'}"></span>` +
      `<span class="hex-note">${meta ? `<b>${v}</b> · ${meta.name} — ${meta.note}` : '아직 뽑지 않음'}</span>`;
    container.appendChild(row);
  }
}

function castOneLine() {
  const faces = [0, 0, 0].map(() => (Math.random() < 0.5 ? 3 : 2));
  return { faces, value: faces.reduce((a, b) => a + b, 0) };
}

document.querySelectorAll('[data-caster]').forEach((box) => {
  const hex = box.querySelector('[data-hex]');
  const coins = box.querySelector('.coins');
  const status = box.querySelector('.caster-status');
  const throwBtn = box.querySelector('[data-throw]');
  const resetBtn = box.querySelector('[data-reset]');
  let values = [];

  const render = () => {
    drawHex(hex, values);
    throwBtn.disabled = values.length >= 6;
    if (values.length === 0) {
      status.textContent = '질문을 하나 정한 뒤 첫 던지기를 하세요. 첫 효는 맨 아래에 놓입니다.';
      coins.innerHTML = '';
    } else if (values.length < 6) {
      status.textContent = `${values.length}개 완성 — 다음은 ${POS[values.length]}, 바로 위 칸에 쌓입니다.`;
    } else {
      const moving = values.map((v, i) => (v === 6 || v === 9 ? POS[i] : null)).filter(Boolean);
      status.textContent = moving.length
        ? `본괘 완성. 변효는 ${moving.join(', ')} — 모두 ${moving.length}개입니다.`
        : '본괘 완성. 변효가 하나도 없습니다 (약 18% 확률로 일어납니다).';
    }
  };

  throwBtn.addEventListener('click', () => {
    const { faces, value } = castOneLine();
    coins.innerHTML = faces
      .map((f) => `<span class="coin ${f === 3 ? 'head' : 'tail'}">${f === 3 ? '앞 3' : '뒤 2'}</span>`)
      .join('') + `<span class="coin tail" style="border-style:dashed">= ${value}</span>`;
    values.push(value);
    render();
  });

  resetBtn.addEventListener('click', () => { values = []; render(); });
  render();
});
