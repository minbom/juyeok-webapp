/* 해석문 5요소 빌더. 다섯 칸을 채우면 초안 문단을 조립해 준다. */
document.querySelectorAll('[data-builder]').forEach((box) => {
  const fields = box.querySelectorAll('[data-slot]');
  const out = box.querySelector('output');
  const copy = box.querySelector('[data-copy]');
  const v = (k) => (box.querySelector(`[data-slot="${k}"]`).value || '').trim();

  const build = () => {
    const missing = [...fields].filter((f) => !f.value.trim()).length;
    if (missing) {
      out.textContent = `아직 ${missing}칸 남았습니다. 다섯 칸을 다 채우면 초안이 조립됩니다.`;
      out.style.opacity = .65;
      return;
    }
    out.style.opacity = 1;
    out.textContent =
      `“${v('q')}”라고 묻고 ${v('cast')}을 얻었다. ` +
      `변효가 있으므로 ${v('rule')}를 읽는다. ` +
      `${v('image')} ` +
      `내 상황에 붙이면, ${v('apply')} ` +
      `(점법은 동전 3개·앞면 3점, 독법은 주자 《역학계몽》 「고변점」을 따랐다.)`;
  };
  fields.forEach((f) => f.addEventListener('input', build));
  copy.addEventListener('click', () => {
    navigator.clipboard?.writeText(out.textContent);
    copy.textContent = '복사했습니다';
    setTimeout(() => (copy.textContent = '초안 복사'), 1500);
  });
  build();
});
