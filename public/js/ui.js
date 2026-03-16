function showScreen(id) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function setWaiting(heading, subtext) {
  document.getElementById('waiting-heading').textContent = heading;
  document.getElementById('waiting-subtext').textContent = subtext;
}

function showError(message) {
  document.getElementById('error-msg-text').textContent = message;
  showScreen('screen-error');
}

function buildResultsList(statements, targetIndex, guessIndex, gameMode) {
  const list = document.getElementById('result-statements-list');
  list.innerHTML = '';
  const guessedCorrectly = guessIndex === targetIndex;

  statements.forEach((text, i) => {
    const isLie   = gameMode === 'ottl' ? (i !== targetIndex) : (i === targetIndex);
    const isGuess = (i === guessIndex);

    const div = document.createElement('div');
    div.className = `result-stmt ${isLie ? 'is-lie' : 'is-true'}`;
    div.style.animationDelay = `${i * 0.12}s`;

    const badge = document.createElement('span');
    badge.className   = 'stmt-badge';
    badge.textContent = isLie ? '✗ LIE' : '✓ TRUTH';

    const textSpan = document.createElement('span');
    textSpan.className   = 'stmt-text';
    textSpan.textContent = text;

    div.appendChild(badge);
    div.appendChild(textSpan);

    if (isGuess) {
      const guessSpan = document.createElement('span');
      guessSpan.className   = 'guessed-badge';
      guessSpan.textContent = '← guessed ' + (guessedCorrectly ? '✅' : '❌');
      div.appendChild(guessSpan);
    }

    list.appendChild(div);
  });
}
