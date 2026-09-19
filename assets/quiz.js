document.querySelectorAll('[data-quiz]').forEach((quiz) => {
  const output = quiz.querySelector('.feedback');
  quiz.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => {
      const correct = button.dataset.correct === 'true';
      output.className = `feedback ${correct ? 'good' : 'again'}`;
      output.textContent = correct ? button.dataset.good : button.dataset.again;
    });
  });
});
