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
let playerNames   = []; // ["Alice", "Bob"] — populated on game-start

/** Returns true if this client is the writer for the current round. */
function amITheWriter() {
  return myPlayerIndex === writerIndex;
}

// ── Lobby ────────────────────────────────────────────────────────────────────

document.getElementById('create-btn').addEventListener('click', () => {
  const name = document.getElementById('player-name').value.trim();
  if (!name) { alert('Please enter your name.'); return; }
  socket.emit('create-room', { playerName: name });
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

socket.on('game-start', ({ players, writerIndex: wi, round }) => {
  writerIndex  = wi;
  currentRound = round;
  playerNames  = players;

  if (amITheWriter()) {
    ['stmt-0', 'stmt-1', 'stmt-2'].forEach(id => {
      document.getElementById(id).value = '';
    });
    const submitBtn = document.getElementById('submit-statements-btn');
    submitBtn.disabled    = false;
    submitBtn.textContent = 'Submit Statements';
    document.getElementById('writing-round').textContent = `Round ${round}`;
    showScreen('screen-writing');
  } else {
    document.getElementById('waiting-round').textContent = `Round ${round}`;
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
    document.getElementById('waiting-round').textContent = `Round ${currentRound}`;
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
      btn.className   = 'guess-btn';
      btn.textContent = text;
      btn.addEventListener('click', () => {
        container.querySelectorAll('.guess-btn').forEach(b => b.disabled = true);
        socket.emit('submit-guess', { guessIndex: i });
      });
      container.appendChild(btn);
    });

    document.getElementById('guessing-round').textContent = `Round ${currentRound}`;
    showScreen('screen-guessing');
  }
});

socket.on('round-result', ({ guessIndex, lieIndex, correct, writerName, guesserName, statements, writerMsg, guesserMsg }) => {
  const heading = amITheWriter() ? writerMsg : guesserMsg;
  const detail  = amITheWriter()
    ? (correct ? `${guesserName} spotted your lie.`  : `${guesserName} couldn't find your lie.`)
    : (correct ? 'You spotted the lie!'              : `Statement ${lieIndex + 1} was the lie. Better luck next round!`);

  document.getElementById('result-heading').textContent = heading;
  document.getElementById('result-detail').textContent  = detail;
  document.getElementById('results-round').textContent  = `Round ${currentRound}`;

  buildResultsList(statements, lieIndex, guessIndex);

  const nextBtn = document.getElementById('next-round-btn');
  nextBtn.disabled    = false;
  nextBtn.textContent = 'Next Round →';
  document.getElementById('waiting-next-msg').classList.add('hidden');

  showScreen('screen-results');
});

socket.on('waiting-for-next-round', () => {
  const btn = document.getElementById('next-round-btn');
  btn.disabled    = true;
  btn.textContent = 'Waiting…';
  document.getElementById('waiting-next-msg').classList.remove('hidden');
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
