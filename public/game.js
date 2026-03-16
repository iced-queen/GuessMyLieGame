/**
 * game.js — GuessMyLie client
 *
 * Handles all UI transitions and communicates with the server
 * in real-time via Socket.IO.
 *
 * Screens (only one is visible at a time):
 *   screen-lobby        → enter name, create or join a room
 *   screen-waiting-room → show room code while waiting for 2nd player
 *   screen-writing      → writer enters 3 statements + marks the truth
 *   screen-waiting      → generic "please wait" (used mid-round)
 *   screen-guessing     → guesser picks which statement is true
 *   screen-results      → annotated result + Next Round button
 *   screen-error        → disconnect / room error
 */

const socket = io();

// ── Client-side game state ───────────────────────────────────────────────────
let myPlayerIndex = -1;  // Seat number: 0 (creator) or 1 (joiner)
let writerIndex   = 0;   // Which player is the writer this round (0 or 1)
let currentRound  = 1;   // Round counter (displayed in the UI)
let playerNames   = [];  // ["Alice", "Bob"] — set when both players join

// ── Utility functions ────────────────────────────────────────────────────────

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

// ── Socket events: lobby responses ───────────────────────────────────────────

/**
 * Server confirmed that our new room was created.
 * We are player 0 (the creator / first writer).
 */
socket.on('room-created', ({ roomCode, playerIndex }) => {
  myPlayerIndex = playerIndex; // 0
  document.getElementById('display-room-code').textContent = roomCode;
  showScreen('screen-waiting-room');
});

/**
 * Server confirmed that we successfully joined an existing room.
 * We are player 1. game-start will fire immediately after.
 */
socket.on('joined-room', ({ roomCode, playerIndex }) => {
  myPlayerIndex = playerIndex; // 1
  // game-start is emitted by the server right after this, so no UI change here
});

// ── Socket events: game-start (fires at the start of every round) ────────────

/**
 * Both players are in the room — a round is beginning.
 * The writer sees the input form; the guesser sees a waiting screen.
 */
socket.on('game-start', ({ players, writerIndex: wi, round }) => {
  writerIndex  = wi;
  currentRound = round;
  playerNames  = players;

  if (amITheWriter()) {
    // Reset the writing form so it's clean for this round
    ['stmt-0', 'stmt-1', 'stmt-2'].forEach(id => {
      document.getElementById(id).value = '';
    });

    // Re-enable submit in case it was disabled during a previous round
    const submitBtn = document.getElementById('submit-statements-btn');
    submitBtn.disabled    = false;
    submitBtn.textContent = 'Submit Statements';

    document.getElementById('writing-round').textContent = `Round ${round}`;
    showScreen('screen-writing');

  } else {
    // I'm the guesser — wait for the writer to finish
    document.getElementById('waiting-round').textContent = `Round ${round}`;
    setWaiting(
      `${playerNames[writerIndex]} is writing…`,
      'The writer is crafting their three statements. Hang tight!'
    );
    showScreen('screen-waiting');
  }
});

// ── Socket events: mid-round ─────────────────────────────────────────────────

/**
 * The writer submitted their statements.
 * Writer → wait screen.  Guesser → guessing screen.
 */
socket.on('show-statements', ({ statements }) => {
  if (amITheWriter()) {
    // Wait for the guesser to pick
    document.getElementById('waiting-round').textContent = `Round ${currentRound}`;
    setWaiting(
      'Waiting for the guesser…',
      'The other player is reading your statements and making their pick.'
    );
    showScreen('screen-waiting');

  } else {
    // Build the statement buttons dynamically
    const container = document.getElementById('guess-buttons');
    container.innerHTML = '';

    statements.forEach((text, i) => {
      const btn = document.createElement('button');
      btn.className   = 'guess-btn';
      btn.textContent = text;

      btn.addEventListener('click', () => {
        // Disable all buttons immediately to prevent double-submission
        container.querySelectorAll('.guess-btn').forEach(b => b.disabled = true);
        socket.emit('submit-guess', { guessIndex: i });
      });

      container.appendChild(btn);
    });

    document.getElementById('guessing-round').textContent = `Round ${currentRound}`;
    showScreen('screen-guessing');
  }
});

/**
 * The round is over — show annotated results to both players.
 */
socket.on('round-result', ({ guessIndex, lieIndex, correct, writerName, guesserName, statements }) => {
  // ── Build the heading based on who I am ────────────────────────────────
  let heading, detail;

  if (amITheWriter()) {
    if (correct) {
      heading = '😅 Caught!';
      detail  = `${guesserName} spotted your lie.`;
    } else {
      heading = '😈 They fell for it!';
      detail  = `${guesserName} couldn't find your lie.`;
    }
  } else {
    if (correct) {
      heading = '🎉 Correct!';
      detail  = 'You spotted the lie!';
    } else {
      heading = '❌ Wrong!';
      detail  = `Statement ${lieIndex + 1} was the lie. Better luck next round!`;
    }
  }

  document.getElementById('result-heading').textContent = heading;
  document.getElementById('result-detail').textContent  = detail;
  document.getElementById('results-round').textContent  = `Round ${currentRound}`;

  // ── Build annotated statement list ─────────────────────────────────────
  const list = document.getElementById('result-statements-list');
  list.innerHTML = '';

  statements.forEach((text, i) => {
    const isLie   = (i === lieIndex);
    const isGuess = (i === guessIndex);

    // Outer container — red for lie, green for truths
    const div = document.createElement('div');
    div.className = `result-stmt ${isLie ? 'is-lie' : 'is-true'}`;

    // Small "✓ TRUTH" / "✗ LIE" badge
    const badge = document.createElement('span');
    badge.className   = 'stmt-badge';
    badge.textContent = isLie ? '✗ LIE' : '✓ TRUTH';

    // Statement text
    const textSpan = document.createElement('span');
    textSpan.className   = 'stmt-text';
    textSpan.textContent = text;

    div.appendChild(badge);
    div.appendChild(textSpan);

    // Optionally mark this as the guessed statement
    if (isGuess) {
      const guessSpan = document.createElement('span');
      guessSpan.className   = 'guessed-badge';
      guessSpan.textContent = '← guessed';
      div.appendChild(guessSpan);
    }

    list.appendChild(div);
  });

  // Reset the Next Round button
  const nextBtn = document.getElementById('next-round-btn');
  nextBtn.disabled    = false;
  nextBtn.textContent = 'Next Round →';
  document.getElementById('waiting-next-msg').classList.add('hidden');

  showScreen('screen-results');
});

/**
 * This player clicked Next Round but the other hasn't yet — lock the button.
 */
socket.on('waiting-for-next-round', () => {
  const btn = document.getElementById('next-round-btn');
  btn.disabled    = true;
  btn.textContent = 'Waiting…';
  document.getElementById('waiting-next-msg').classList.remove('hidden');
});

// ── Socket events: error / disconnect ────────────────────────────────────────

/** The other player left — the room is now gone. */
socket.on('player-disconnected', ({ name }) => {
  showError(`${name} disconnected. The game has ended.`);
});

/** Server rejected an action (room full, room not found, etc.). */
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

  // Disable the button to prevent double-submission
  const btn = document.getElementById('submit-statements-btn');
  btn.disabled    = true;
  btn.textContent = 'Submitted! Waiting for guesser…';

  socket.emit('submit-statements', {
    statements: [s0, s1, s2],
  });
});

// ── Results screen ────────────────────────────────────────────────────────────

document.getElementById('next-round-btn').addEventListener('click', () => {
  socket.emit('next-round');
});

// ── Error screen ──────────────────────────────────────────────────────────────

document.getElementById('back-to-lobby-btn').addEventListener('click', () => {
  // Reload the page — simplest way to cleanly reset all state
  location.reload();
});
