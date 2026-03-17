const socket = io();

let myPlayerIndex = -1;
let writerIndex   = 0;
let currentRound  = 1;
let playerNames   = [];
let gameSettings  = { totalRounds: 5, gameMode: 'ttol' };
let scores        = [0, 0];

// Writer: stores the un-shuffled statements so we can label the shuffled preview
let submittedStatements = null;

let tipCycleIndex  = 0;
let tipInterval    = null;
let activeTipEl    = null;
let activeTipArray = null;

function startTips(tipElementId, tipArray, emoji = '💡') {
  stopTips();
  activeTipEl    = document.getElementById(tipElementId);
  activeTipArray = tipArray;
  tipCycleIndex  = Math.floor(Math.random() * tipArray.length);
  activeTipEl.classList.remove('tip-fade-out');
  activeTipEl.textContent = emoji + ' ' + activeTipArray[tipCycleIndex];
  tipInterval = setInterval(() => {
    activeTipEl.classList.add('tip-fade-out');
    setTimeout(() => {
      tipCycleIndex = (tipCycleIndex + 1) % activeTipArray.length;
      activeTipEl.textContent = emoji + ' ' + activeTipArray[tipCycleIndex];
      activeTipEl.classList.remove('tip-fade-out');
    }, 400);
  }, 10000);
}

function stopTips() {
  if (tipInterval !== null) {
    clearInterval(tipInterval);
    tipInterval    = null;
    activeTipEl    = null;
    activeTipArray = null;
  }
}

function amITheWriter() {
  return myPlayerIndex === writerIndex;
}

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

// settings UI
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
  // snap back to a valid number if they leave it blank
  roundsSetting = clampRounds(isNaN(parseInt(roundsInput.value, 10)) ? 5 : parseInt(roundsInput.value, 10));
  roundsInput.value = roundsSetting;
});

document.querySelectorAll('.mode-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// socket responses
socket.on('room-created', ({ roomCode, playerIndex }) => {
  myPlayerIndex = playerIndex;
  const roomCodeEl = document.getElementById('display-room-code');
  roomCodeEl.textContent = roomCode;
  roomCodeEl.onclick = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      roomCodeEl.classList.add('copied');
      setTimeout(() => roomCodeEl.classList.remove('copied'), 2000);
    });
  };
  
  showScreen('screen-waiting-room');
});

socket.on('joined-room', ({ roomCode, playerIndex }) => {
  myPlayerIndex = playerIndex;
});

// game-start fires at the start of every round
socket.on('game-start', ({ players, writerIndex: wi, round, settings, scores: s }) => {
  writerIndex  = wi;
  currentRound = round;
  playerNames  = players;
  if (settings) gameSettings = settings;
  if (s)        scores = s;

  // Reset per-round waiting-screen state
  submittedStatements = null;
  stopTips();
  document.getElementById('waiting-statements-preview').classList.add('hidden');
  document.getElementById('waiting-fact-box').classList.add('hidden');
  const typingIndicator = document.getElementById('writer-typing-indicator');
  typingIndicator.classList.remove('is-typing');
  typingIndicator.classList.add('hidden');
  document.getElementById('writing-tip-box').classList.add('hidden');
  document.getElementById('guessing-tip-box').classList.add('hidden');

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

    // update writing rows for the current game mode
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

    ['stmt-0', 'stmt-1', 'stmt-2'].forEach(id => {
      document.getElementById(id + '-count').textContent = '0 / 200';
    });
    const submitBtn = document.getElementById('submit-statements-btn');
    submitBtn.disabled    = false;
    submitBtn.textContent = 'Submit Statements';
    submitBtn.classList.remove('sent');
    document.getElementById('writing-round').textContent = roundLabel;
    // Show rotating writer tips
    document.getElementById('writing-tip-box').classList.remove('hidden');
    const isOttlWriter = gameSettings.gameMode === 'ottl';
    startTips('writing-tip', isOttlWriter ? TIPS.writerOttl : TIPS.writer);
    showScreen('screen-writing');
  } else {
    document.getElementById('waiting-round').textContent = roundLabel;
    setWaiting(
      `${playerNames[writerIndex]} is writing…`,
      'The writer is crafting their statements. Hang tight!'
    );
    document.getElementById('writer-typing-name').textContent = playerNames[writerIndex];
    document.getElementById('writer-typing-indicator').classList.remove('hidden');
    document.getElementById('waiting-fact-box').classList.remove('hidden');
    startTips('waiting-fact', FACTS, '🧠');
    showScreen('screen-waiting');
  }
});

socket.on('show-statements', ({ statements }) => {
  if (amITheWriter()) {
    document.getElementById('waiting-round').textContent = `Round ${currentRound} / ${gameSettings.totalRounds}`;
    setWaiting(
      'Waiting for the guesser…',
      'Can they spot your lie?'
    );
    showScreen('screen-waiting');

    // Show the writer a labelled preview of their statements in shuffled order
    if (submittedStatements) {
      const isOttl    = gameSettings.gameMode === 'ottl';
      // In ottl the un-shuffled truth is index 0; in ttol the lie is index 2
      const keyText   = isOttl ? submittedStatements[0] : submittedStatements[2];
      const previewList = document.getElementById('waiting-preview-list');
      previewList.innerHTML = '';
      statements.forEach((text, i) => {
        const isLie = isOttl ? (text !== keyText) : (text === keyText);
        const div = document.createElement('div');
        div.className = `result-stmt ${isLie ? 'is-lie' : 'is-true'}`;
        div.style.animationDelay = `${i * 0.1}s`;
        const badge = document.createElement('span');
        badge.className   = 'stmt-badge';
        badge.textContent = isLie ? '\u2717 LIE' : '\u2713 TRUTH';
        const textSpan = document.createElement('span');
        textSpan.className   = 'stmt-text';
        textSpan.textContent = text;
        div.appendChild(badge);
        div.appendChild(textSpan);
        previewList.appendChild(div);
      });
      document.getElementById('waiting-statements-preview').classList.remove('hidden');
    }
  } else {
    stopTips();
    // Clear typing indicator in case a stale event or timer is still pending
    const indicator = document.getElementById('writer-typing-indicator');
    clearTimeout(indicator._hideTimer);
    indicator.classList.remove('is-typing');
    const container = document.getElementById('guess-buttons');
    container.innerHTML = '';

    statements.forEach((text, i) => {
      const btn = document.createElement('button');
      btn.className            = 'guess-btn animate-in';
      btn.style.animationDelay = `${i * 0.1}s`;
      btn.textContent = text;
      btn.addEventListener('click', () => {
        stopTips();
        document.getElementById('guessing-tip-box').classList.add('hidden');
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
    document.getElementById('guessing-tip-box').classList.remove('hidden');
    startTips('guessing-tip', isOttl ? TIPS.guesserOttl : TIPS.guesser);
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

socket.on('player-disconnected', ({ name }) => {
  showError(`${name} disconnected. The game has ended.`);
});

socket.on('error-message', message => {
  showError(message);
});

// Debounced writer-typing emitter + character counters
let typingDebounce = null;
['stmt-0', 'stmt-1', 'stmt-2'].forEach(id => {
  const input   = document.getElementById(id);
  const counter = document.getElementById(id + '-count');
  input.addEventListener('input', () => {
    const len = input.value.length;
    counter.textContent = `${len} / 200`;
    counter.classList.toggle('near-limit', len >= 160);

    if (typingDebounce) return;
    socket.emit('writer-typing');
    typingDebounce = setTimeout(() => { typingDebounce = null; }, 2000);
  });
});

socket.on('writer-typing', () => {
  const indicator = document.getElementById('writer-typing-indicator');
  indicator.classList.add('is-typing');
  clearTimeout(indicator._hideTimer);
  indicator._hideTimer = setTimeout(() => indicator.classList.remove('is-typing'), 5000);
});

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

  // Prevent further writer-typing events after submission
  ['stmt-0', 'stmt-1', 'stmt-2'].forEach(id => {
    document.getElementById(id).disabled = true;
  });

  submittedStatements = [s0, s1, s2];
  socket.emit('submit-statements', { statements: [s0, s1, s2] });
});

document.getElementById('next-round-btn').addEventListener('click', () => {
  socket.emit('next-round');
});

document.getElementById('back-to-lobby-btn').addEventListener('click', () => {
  location.reload();
});

document.getElementById('play-again-btn').addEventListener('click', () => {
  socket.emit('play-again');
});
