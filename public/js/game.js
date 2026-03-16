/**
 * game.js — GuessMyLie client
 *
 * Manages game state, wires up all Socket.IO events and UI interactions.
 * DOM helpers (showScreen, setWaiting, showError, buildResultsList) live
 * in ui.js and are available as globals via the preceding <script> tag.
 *
 * Screens (only one visible at a time):
 *   screen-lobby        → enter name, create or join a room
 *   screen-waiting-room → show room code while waiting for 2nd player
 *   screen-writing      → writer enters 2 truths + 1 lie
 *   screen-waiting      → generic "please wait" used mid-round
 *   screen-guessing     → guesser picks which statement is the lie
 *   screen-results      → annotated result + Next Round button
 *   screen-error        → disconnect / room error
 */

const socket = io();

// ── Game state ───────────────────────────────────────────────────────────────
let myPlayerIndex = -1; // Seat: 0 (creator) or 1 (joiner)
let writerIndex   = 0;  // Which player is the writer this round
let currentRound  = 1;  // Round counter (displayed in the UI)
let playerNames   = []; // ["Alice", "Bob"] — populated on game-startlet gameSettings  = { totalRounds: 5, gameMode: 'ttol' };
let scores        = [0, 0];
/** Returns true if this client is the writer for the current round. */
function amITheWriter() {
  return myPlayerIndex === writerIndex;
}

// ── Lobby ────────────────────────────────────────────────────────────────────

document.getElementById('create-btn').addEventListener('click', () => {
  const name = document.getElementById('player-name').value.trim();
  if (!name) { alert('Please enter your name.'); return; }
  showScreen('screen-room-settings');
});

document.getElementById('confirm-create-btn').addEventListener('click', () => {
  const name     = document.getElementById('player-name').value.trim();
  if (!roundsInput.checkValidity() || roundsInput.value === '') {
    roundsInput.reportValidity();
    return;
  }
  const gameMode = document.querySelector('.mode-pill.active').dataset.mode;
  socket.emit('create-room', { playerName: name, settings: { totalRounds: roundsSetting, gameMode } });
});

document.getElementById('back-to-lobby-settings-btn').addEventListener('click', () => {
  showScreen('screen-lobby');
});

document.getElementById('join-btn').addEventListener('click', () => {
  const name = document.getElementById('player-name').value.trim();
  const code = document.getElementById('room-code-input').value.trim().toUpperCase();
  if (!name) { alert('Please enter your name.'); return; }
  if (code.length !== 5) { alert('Please enter a valid 5-character room code.'); return; }
  socket.emit('join-room', { roomCode: code, playerName: name });
});

// Allow pressing Enter in the code field to trigger Join
document.getElementById('room-code-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('join-btn').click();
});

// ── Settings UI (lobby only) ───────────────────────────────────────────────
let roundsSetting = 5;
const roundsInput = document.getElementById('rounds-display');

function clampRounds(val) {
  return Math.max(1, Math.min(30, val));
}

document.getElementById('rounds-dec').addEventListener('click', () => {
  roundsSetting = clampRounds(roundsSetting - 1);
  roundsInput.value = roundsSetting;
});

document.getElementById('rounds-inc').addEventListener('click', () => {
  roundsSetting = clampRounds(roundsSetting + 1);
  roundsInput.value = roundsSetting;
});

roundsInput.addEventListener('input', () => {
  const val = parseInt(roundsInput.value, 10);
  if (!isNaN(val)) roundsSetting = clampRounds(val);
});

roundsInput.addEventListener('blur', () => {
  // Restore a valid value if field is empty or out of range
  roundsSetting = clampRounds(isNaN(parseInt(roundsInput.value, 10)) ? 5 : parseInt(roundsInput.value, 10));
  roundsInput.value = roundsSetting;
});

document.querySelectorAll('.mode-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ── Socket: lobby responses ───────────────────────────────────────────────────

socket.on('room-created', ({ roomCode, playerIndex }) => {
  myPlayerIndex = playerIndex; // 0
  document.getElementById('display-room-code').textContent = roomCode;
  showScreen('screen-waiting-room');
});

socket.on('joined-room', ({ roomCode, playerIndex }) => {
  myPlayerIndex = playerIndex; // 1 — game-start fires immediately after
});

// ── Socket: game-start (fires at the beginning of every round) ───────────────

socket.on('game-start', ({ players, writerIndex: wi, round, settings, scores: s }) => {
  writerIndex  = wi;
  currentRound = round;
  playerNames  = players;
  if (settings) gameSettings = settings;
  if (s)        scores = s;

  document.querySelector('header').classList.add('compact');

  // Update score banner names and values
  document.getElementById('score-name-0').textContent = playerNames[0];
  document.getElementById('score-name-1').textContent = playerNames[1];
  document.getElementById('score-val-0').textContent  = scores[0];
  document.getElementById('score-val-1').textContent  = scores[1];

  const roundLabel = `Round ${round} / ${gameSettings.totalRounds}`;

  if (amITheWriter()) {
    ['stmt-0', 'stmt-1', 'stmt-2'].forEach(id => {
      document.getElementById(id).value = '';
    });

    // Adjust writing screen rows for game mode
    const isOttl = gameSettings.gameMode === 'ottl';
    const row1   = document.getElementById('stmt-1').closest('.stmt-row');
    const badge1 = row1.querySelector('.stmt-type-badge');
    if (isOttl) {
      row1.className                                  = 'stmt-row lie-row';
      badge1.className                                = 'stmt-type-badge lie-badge';
      badge1.textContent                              = 'Lie';
      document.getElementById('stmt-0').placeholder  = 'The truth!';
      document.getElementById('stmt-1').placeholder  = 'First lie';
      document.getElementById('stmt-2').placeholder  = 'Second lie';
      document.getElementById('writing-prompt').innerHTML =
        'Enter your <strong>one truth</strong> in the first field and <strong>two lies</strong> in the other two. The order will be shuffled for the guesser.';
    } else {
      row1.className                                  = 'stmt-row truth-row';
      badge1.className                                = 'stmt-type-badge truth-badge';
      badge1.textContent                              = 'Truth';
      document.getElementById('stmt-0').placeholder  = 'First Truth';
      document.getElementById('stmt-1').placeholder  = 'Second Truth';
      document.getElementById('stmt-2').placeholder  = 'The lie!';
      document.getElementById('writing-prompt').innerHTML =
        'Enter <strong>two truths</strong> in the first two fields and your <strong>one lie</strong> in the last. The order will be shuffled for the guesser.';
    }

    const submitBtn = document.getElementById('submit-statements-btn');
    submitBtn.disabled    = false;
    submitBtn.textContent = 'Submit Statements';
    submitBtn.classList.remove('sent');
    document.getElementById('writing-round').textContent = roundLabel;
    showScreen('screen-writing');
  } else {
    document.getElementById('waiting-round').textContent = roundLabel;
    setWaiting(
      `${playerNames[writerIndex]} is writing…`,
      'The writer is crafting their three statements. Hang tight!'
    );
    showScreen('screen-waiting');
  }
});

// ── Socket: mid-round ─────────────────────────────────────────────────────────

socket.on('show-statements', ({ statements }) => {
  if (amITheWriter()) {
    document.getElementById('waiting-round').textContent = `Round ${currentRound} / ${gameSettings.totalRounds}`;
    setWaiting(
      'Waiting for the guesser…',
      'The other player is reading your statements and making their pick.'
    );
    showScreen('screen-waiting');
  } else {
    const container = document.getElementById('guess-buttons');
    container.innerHTML = '';

    statements.forEach((text, i) => {
      const btn = document.createElement('button');
      btn.className            = 'guess-btn animate-in';
      btn.style.animationDelay = `${i * 0.1}s`;
      btn.textContent = text;
      btn.addEventListener('click', () => {
        btn.classList.add('picked');
        container.querySelectorAll('.guess-btn').forEach(b => b.disabled = true);
        socket.emit('submit-guess', { guessIndex: i });
      });
      container.appendChild(btn);
    });

    const isOttl = gameSettings.gameMode === 'ottl';
    document.getElementById('guessing-round').textContent   = `Round ${currentRound} / ${gameSettings.totalRounds}`;
    document.getElementById('guessing-h2').textContent      = isOttl ? 'Which One Is The Truth?' : 'Which One Is The Lie?';
    document.getElementById('guessing-prompt').textContent  = isOttl
      ? 'Tap the statement you think is the truth.'
      : 'Tap the statement you think is the lie.';
    showScreen('screen-guessing');
  }
});

socket.on('round-result', ({ guessIndex, targetIndex, gameMode, correct, writerName, guesserName, statements, scores: s, writerMsg, guesserMsg }) => {
  if (s) scores = s;
  const isOttl  = gameMode === 'ottl';
  const heading = amITheWriter() ? writerMsg : guesserMsg;
  const detail  = amITheWriter()
    ? (correct
        ? (isOttl ? `${guesserName} found your truth!`         : `${guesserName} spotted your lie.`)
        : (isOttl ? `${guesserName} couldn't find your truth.` : `${guesserName} couldn't find your lie.`))
    : (correct
        ? (isOttl ? 'You found the truth!'    : 'You spotted the lie!')
        : (isOttl
            ? `Statement ${targetIndex + 1} was the truth. Better luck next round!`
            : `Statement ${targetIndex + 1} was the lie. Better luck next round!`));

  const headingEl = document.getElementById('result-heading');
  headingEl.textContent = heading;
  headingEl.classList.remove('pop');
  void headingEl.offsetWidth;
  headingEl.classList.add('pop');

  document.getElementById('result-detail').textContent  = detail;
  document.getElementById('results-round').textContent  = `Round ${currentRound} / ${gameSettings.totalRounds}`;

  document.getElementById('score-val-0').textContent = scores[0];
  document.getElementById('score-val-1').textContent = scores[1];

  buildResultsList(statements, targetIndex, guessIndex, gameMode);

  const nextBtn = document.getElementById('next-round-btn');
  nextBtn.disabled    = false;
  nextBtn.textContent = currentRound >= gameSettings.totalRounds ? 'Finish Game →' : 'Next Round →';
  nextBtn.classList.remove('pulse');

  document.getElementById('ready-name-me').textContent   = playerNames[myPlayerIndex];
  document.getElementById('ready-name-them').textContent = playerNames[1 - myPlayerIndex];
  document.getElementById('ready-pill-me').classList.remove('is-ready');
  document.getElementById('ready-pill-them').classList.remove('is-ready');

  showScreen('screen-results');
});

socket.on('waiting-for-next-round', () => {
  const btn = document.getElementById('next-round-btn');
  btn.disabled    = true;
  btn.textContent = 'Waiting…';
  btn.classList.remove('pulse');
  document.getElementById('ready-pill-me').classList.add('is-ready');
});
socket.on('opponent-ready', () => {
  document.getElementById('ready-pill-them').classList.add('is-ready');
  const btn = document.getElementById('next-round-btn');
  if (!btn.disabled) btn.classList.add('pulse');
});
socket.on('game-over', ({ players, scores: finalScores, winner }) => {
  document.querySelector('header').classList.remove('compact');

  let heading;
  if (winner === -1)                 heading = "It's a Tie! \uD83E\uDD1D";
  else if (winner === myPlayerIndex) heading = 'You Win! \uD83C\uDF89';
  else                               heading = `${players[winner]} Wins! \uD83C\uDFC6`;

  document.getElementById('gameover-heading').textContent = heading;
  document.getElementById('gameover-detail').textContent  =
    `${finalScores[0] + finalScores[1]} round${finalScores[0] + finalScores[1] !== 1 ? 's' : ''} played`;

  document.getElementById('final-score-display').innerHTML = players.map((name, i) =>
    `<div class="final-score-row">
      <span class="final-score-name${i === winner ? ' winner' : ''}">${name}</span>
      <span class="final-score-num">${finalScores[i]}</span>
    </div>`
  ).join('');

  const playBtn = document.getElementById('play-again-btn');
  playBtn.disabled    = false;
  playBtn.textContent = 'Play Again';
  playBtn.classList.remove('pulse');
  document.getElementById('play-again-name-me').textContent   = playerNames[myPlayerIndex];
  document.getElementById('play-again-name-them').textContent = playerNames[1 - myPlayerIndex];
  document.getElementById('play-again-pill-me').classList.remove('is-ready');
  document.getElementById('play-again-pill-them').classList.remove('is-ready');

  showScreen('screen-game-over');
});

socket.on('play-again-waiting', () => {
  const btn = document.getElementById('play-again-btn');
  btn.disabled    = true;
  btn.textContent = 'Waiting…';
  btn.classList.remove('pulse');
  document.getElementById('play-again-pill-me').classList.add('is-ready');
});

socket.on('opponent-play-again', () => {
  document.getElementById('play-again-pill-them').classList.add('is-ready');
  const btn = document.getElementById('play-again-btn');
  if (!btn.disabled) btn.classList.add('pulse');
});
// ── Socket: error / disconnect ────────────────────────────────────────────────

socket.on('player-disconnected', ({ name }) => {
  showError(`${name} disconnected. The game has ended.`);
});

socket.on('error-message', message => {
  showError(message);
});

// ── Writing screen ────────────────────────────────────────────────────────────

document.getElementById('submit-statements-btn').addEventListener('click', () => {
  const s0 = document.getElementById('stmt-0').value.trim();
  const s1 = document.getElementById('stmt-1').value.trim();
  const s2 = document.getElementById('stmt-2').value.trim();

  if (!s0 || !s1 || !s2) {
    alert('Please fill in all three statements.');
    return;
  }

  const btn = document.getElementById('submit-statements-btn');
  btn.disabled    = true;
  btn.textContent = 'Submitted! Waiting for guesser…';
  btn.classList.add('sent');

  socket.emit('submit-statements', { statements: [s0, s1, s2] });
});

// ── Results screen ────────────────────────────────────────────────────────────

document.getElementById('next-round-btn').addEventListener('click', () => {
  socket.emit('next-round');
});

// ── Error screen ──────────────────────────────────────────────────────────────

document.getElementById('back-to-lobby-btn').addEventListener('click', () => {
  location.reload();
});

document.getElementById('play-again-btn').addEventListener('click', () => {
  socket.emit('play-again');
});
