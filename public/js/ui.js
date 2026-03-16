/**
 * ui.js — GuessMyLie DOM helpers
 *
 * Pure UI utilities with no dependency on game state.
 * Loaded before game.js so its functions are available as globals.
 */

/** Show one screen, hide all others. */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

/** Update the generic mid-round waiting screen. */
function setWaiting(heading, subtext) {
  document.getElementById('waiting-heading').textContent = heading;
  document.getElementById('waiting-subtext').textContent = subtext;
}

/** Show the error screen with a custom message. */
function showError(message) {
  document.getElementById('error-msg-text').textContent = message;
  showScreen('screen-error');
}

/**
 * Populate the annotated result statements list on the results screen.
 * @param {string[]} statements - The (shuffled) statement texts.
 * @param {number}   lieIndex   - Index of the lie within statements[].
 * @param {number}   guessIndex - Index the guesser picked.
 */
function buildResultsList(statements, lieIndex, guessIndex) {
  const list = document.getElementById('result-statements-list');
  list.innerHTML = '';

  statements.forEach((text, i) => {
    const isLie   = (i === lieIndex);
    const isGuess = (i === guessIndex);

    const div = document.createElement('div');
    div.className = `result-stmt ${isLie ? 'is-lie' : 'is-true'}`;

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
      guessSpan.textContent = '← guessed';
      div.appendChild(guessSpan);
    }

    list.appendChild(div);
  });
}
