'use strict';

const { rooms, generateRoomCode, getRoomForSocket } = require('./rooms');
const { strings, pick } = require('./strings');

/**
 * Registers all Socket.IO game event handlers on the given server instance.
 * @param {import('socket.io').Server} io
 */
function registerHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`[connect]    ${socket.id}`);

    // ── create-room ──────────────────────────────────────────────────────────
    socket.on('create-room', ({ playerName }) => {
      if (!playerName || typeof playerName !== 'string') return;
      const name = playerName.trim().slice(0, 20);
      if (!name) return;

      const roomCode = generateRoomCode();

      rooms[roomCode] = {
        players:        [{ id: socket.id, name }],
        writerIndex:    0,
        statements:     [],
        lieIndex:       null,
        round:          1,
        phase:          'waiting',
        nextRoundVotes: new Set(),
      };

      socket.join(roomCode);
      socket.data.roomCode    = roomCode;
      socket.data.playerName  = name;
      socket.data.playerIndex = 0;

      socket.emit('room-created', { roomCode, playerIndex: 0 });
      console.log(`[room]       ${roomCode} created by "${name}"`);
    });

    // ── join-room ────────────────────────────────────────────────────────────
    socket.on('join-room', ({ roomCode, playerName }) => {
      if (!playerName || !roomCode) return;
      const name = playerName.trim().slice(0, 20);
      const code = roomCode.trim().toUpperCase().slice(0, 5);
      if (!name || code.length !== 5) return;

      const room = rooms[code];

      if (!room) {
        socket.emit('error-message', 'Room not found. Double-check the code and try again.');
        return;
      }
      if (room.players.length >= 2) {
        socket.emit('error-message', 'This room is already full.');
        return;
      }
      if (room.phase !== 'waiting') {
        socket.emit('error-message', 'This game has already started.');
        return;
      }

      room.players.push({ id: socket.id, name });
      socket.join(code);
      socket.data.roomCode    = code;
      socket.data.playerName  = name;
      socket.data.playerIndex = 1;

      socket.emit('joined-room', { roomCode: code, playerIndex: 1 });

      room.phase = 'writing';
      io.to(code).emit('game-start', {
        players:     room.players.map(p => p.name),
        writerIndex: room.writerIndex,
        round:       room.round,
      });
      console.log(`[room]       ${code} started: "${room.players[0].name}" vs "${room.players[1].name}"`);
    });

    // ── submit-statements ────────────────────────────────────────────────────
    // statements[0] and [1] are truths, statements[2] is the lie.
    socket.on('submit-statements', ({ statements }) => {
      const room = getRoomForSocket(socket);
      if (!room || room.phase !== 'writing') return;
      if (socket.data.playerIndex !== room.writerIndex) return;

      if (!Array.isArray(statements) || statements.length !== 3) return;
      const cleaned = statements.map(s => String(s).trim().slice(0, 200));
      if (cleaned.some(s => !s)) return;

      // Shuffle so the guesser can't predict the lie by position
      const indices = [0, 1, 2];
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      room.statements = indices.map(i => cleaned[i]);
      room.lieIndex   = indices.indexOf(2); // the lie was originally at index 2
      room.phase      = 'guessing';

      io.to(socket.data.roomCode).emit('show-statements', {
        statements: room.statements,
      });
      console.log(`[room]       ${socket.data.roomCode} statements submitted`);
    });

    // ── submit-guess ─────────────────────────────────────────────────────────
    socket.on('submit-guess', ({ guessIndex }) => {
      const room = getRoomForSocket(socket);
      if (!room || room.phase !== 'guessing') return;
      if (socket.data.playerIndex === room.writerIndex) return;
      if (typeof guessIndex !== 'number' || guessIndex < 0 || guessIndex > 2) return;

      const correct     = guessIndex === room.lieIndex;
      const writerName  = room.players[room.writerIndex].name;
      const guesserName = room.players[1 - room.writerIndex].name;
      room.phase = 'reveal';

      io.to(socket.data.roomCode).emit('round-result', {
        guessIndex,
        lieIndex:   room.lieIndex,
        correct,
        writerName,
        guesserName,
        statements: room.statements,
        writerMsg:  correct ? pick(strings.writerCaught)   : pick(strings.writerWon),
        guesserMsg: correct ? pick(strings.guesserCorrect) : pick(strings.guesserWrong),
      });
      console.log(`[room]       ${socket.data.roomCode} round ${room.round} — ${correct ? 'correct ✓' : 'wrong ✗'}`);
    });

    // ── next-round ───────────────────────────────────────────────────────────
    // Both players must click "Next Round" before the game advances.
    socket.on('next-round', () => {
      const room = getRoomForSocket(socket);
      if (!room || room.phase !== 'reveal') return;

      room.nextRoundVotes.add(socket.id);

      if (room.nextRoundVotes.size >= 2) {
        room.nextRoundVotes.clear();
        room.round++;
        room.writerIndex = 1 - room.writerIndex;
        room.statements  = [];
        room.lieIndex    = null;
        room.phase       = 'writing';

        io.to(socket.data.roomCode).emit('game-start', {
          players:     room.players.map(p => p.name),
          writerIndex: room.writerIndex,
          round:       room.round,
        });
        console.log(`[room]       ${socket.data.roomCode} — round ${room.round} starting`);
      } else {
        socket.emit('waiting-for-next-round');        // Let the other player know this player is ready
        socket.to(socket.data.roomCode).emit('opponent-ready');      }
    });

    // ── disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const code = socket.data.roomCode;
      if (code && rooms[code]) {
        socket.to(code).emit('player-disconnected', { name: socket.data.playerName });
        delete rooms[code];
        console.log(`[room]       ${code} closed — "${socket.data.playerName}" left`);
      }
      console.log(`[disconnect] ${socket.id}`);
    });
  });
}

module.exports = { registerHandlers };
