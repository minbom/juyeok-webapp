/* 이름을 가린 채 텍스트만 보고 판단하는 훈련 위젯.
   괘 이름의 인상에서 출발하는 미끄러짐(LR-0005)을 막기 위한 것.

   마크업:
     <section class="blind" data-blind data-name="困">
       <div class="blind-text"> … <b class="mask">困</b> … </div>
       <div class="choices"><button data-correct data-good data-again>…</button></div>
       <div class="feedback"></div>
       <div class="reveal" hidden> … 이름을 알고 난 뒤의 대조 … </div>
     </section>

   첫 응답이 들어오면 정답 여부와 무관하게 이름을 공개한다 — 맞히든 틀리든
   그 순간이 배우는 지점이기 때문이다. 이후 응답은 피드백만 갱신한다. */
document.querySelectorAll('[data-blind]').forEach((box) => {
  const output = box.querySelector('.feedback');
  const reveal = box.querySelector('.reveal');
  const name = box.dataset.name || '';
  let answered = false;

  box.querySelectorAll('.choices button').forEach((button) => {
    button.addEventListener('click', () => {
      const correct = button.dataset.correct === 'true';
      output.className = `feedback ${correct ? 'good' : 'again'}`;
      output.textContent = correct ? button.dataset.good : button.dataset.again;

      if (answered) return;
      answered = true;
      box.querySelectorAll('.mask').forEach((el) => {
        el.textContent = name;
        el.classList.add('unmasked');
      });
      if (reveal) reveal.hidden = false;
    });
  });
});
