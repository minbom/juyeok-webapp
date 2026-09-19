/* 변효 개수 → 무엇을 읽는가 드릴. assets/hex64.js 뒤에 불러올 것. */
const READ_RULES = {
  0: { label: '본괘의 괘사',                  hint: '변효가 없으니 효사를 고를 근거가 없다. 괘 전체를 말하는 괘사를 읽는다.' },
  1: { label: '본괘의 그 변효 효사',          hint: '움직이는 효가 하나뿐이니, 그 효의 효사가 곧 답이다.' },
  2: { label: '본괘의 두 변효 효사',          hint: '둘 다 읽되, 주자는 위쪽 변효를 주(主)로 삼으라고 했다.' },
  3: { label: '본괘와 지괘의 괘사',           hint: '절반이 움직이면 효 하나로 좁힐 수 없다. 두 괘의 괘사를 함께 본다.' },
  4: { label: '지괘의 안 변한 두 효 효사',    hint: '무게중심이 지괘로 넘어간다. 지괘에서 조용히 남은 두 효를 읽되 아래쪽을 주로 삼는다.' },
  5: { label: '지괘의 안 변한 한 효 효사',    hint: '지괘에서 유일하게 안 변한 효 하나가 답이다.' },
  6: { label: '지괘의 괘사',                  hint: '전부 변했으니 본괘는 껍데기다. 지괘의 괘사를 읽는다 (건·곤만 예외).' },
};

document.querySelectorAll('[data-rule-drill]').forEach((box) => {
  const stage = box.querySelector('[data-stage]');
  const choices = box.querySelector('[data-choices]');
  const fb = box.querySelector('.feedback');
  const score = box.querySelector('[data-score]');
  let answer = 0, done = 0, hit = 0, locked = false;
  const POOL = [0, 1, 2, 3, 4, 5, 6];

  const draw = () => {
    answer = POOL[Math.floor(Math.random() * POOL.length)];
    const spots = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5).slice(0, answer);
    const vals = [0, 1, 2, 3, 4, 5].map((i) =>
      spots.includes(i) ? (Math.random() < 0.5 ? 6 : 9) : (Math.random() < 0.5 ? 7 : 8));
    drawHex(stage, vals);
    fb.className = 'feedback';
    fb.textContent = `변효가 ${answer}개입니다. 무엇을 읽어야 합니까?`;
    locked = false;
  };

  choices.innerHTML = '';
  Object.keys(READ_RULES).map(Number).forEach((n) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = READ_RULES[n].label;
    b.addEventListener('click', () => {
      if (locked) return;
      locked = true;
      done++;
      const ok = n === answer;
      if (ok) hit++;
      fb.className = `feedback ${ok ? 'good' : 'again'}`;
      fb.textContent = ok
        ? `정답 — 변효 ${answer}개이므로 「${READ_RULES[answer].label}」. ${READ_RULES[answer].hint}`
        : `아닙니다. 변효는 ${answer}개였으므로 「${READ_RULES[answer].label}」입니다. ${READ_RULES[answer].hint}`;
      score.textContent = `${done}문제 중 ${hit}개 정답`;
      setTimeout(draw, ok ? 1600 : 3600);
    });
    choices.appendChild(b);
  });
  draw();
});
