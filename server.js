/**
 * server.js — GuessMyLie game server
 *
 * Uses Express to serve static files and Socket.IO for real-time
 * communication between the two players.
 *
 * Game flow (one round):
 *  1. Two players join the same room code.
 *  2. One is the "writer", the other the "guesser".
 *  3. The writer submits 3 statements and marks which is TRUE.
 *  4. The guesser picks the statement they believe is true.
 *  5. The server reveals whether the guess was correct.
 *  6. Roles swap and the next round begins.
 */

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

// Serve everything in the /public folder as static files.
app.use(express.static(path.join(__dirname, 'public')));

// ── In-memory game state ────────────────────────────────────────────────────
//
// rooms[roomCode] = {
//   players:        [ { id: socketId, name: string }, ... ],  // max 2
//   writerIndex:    number,   // 0 or 1 — index into players[]
//   statements:     string[], // 3 statements submitted by the writer
//   lieIndex:       number,   // shuffled index (0-2) of the lie statement
//   round:          number,   // starts at 1, increments each round
//   phase:          string,   // 'waiting' | 'writing' | 'guessing' | 'results'
//   nextRoundVotes: Set,      // socket IDs that clicked "Next Round"
// }
//
const rooms = {};

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Generates a unique 5-character room code using only unambiguous characters
 * so the code is easy to share verbally (no 0/O, 1/I/L).
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from(
      { length: 5 },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  } while (rooms[code]); // retry on the rare collision
  return code;
}

/**
 * Returns the room object for the given socket, or null if not in a room.
 */
function getRoomForSocket(socket) {
  const code = socket.data.roomCode;
  return code ? rooms[code] : null;
}

// ── Socket.IO connection handler ─────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[connect]    ${socket.id}`);

  // ── create-room ────────────────────────────────────────────────────────────
  // A player wants to open a brand-new room.
  socket.on('create-room', ({ playerName }) => {
    // Basic input sanitisation
    if (!playerName || typeof playerName !== 'string') return;
    const name = playerName.trim().slice(0, 20);
    if (!name) return;

    const roomCode = generateRoomCode();

    // Initialise the room in memory
    rooms[roomCode] = {
      players:        [{ id: socket.id, name }],
      writerIndex:    0,
      statements:     [],
      lieIndex:       null,
      round:          1,
      phase:          'waiting',
      nextRoundVotes: new Set(),
    };

    // Store info on the socket for easy lookup later
    socket.join(roomCode);
    socket.data.roomCode    = roomCode;
    socket.data.playerName  = name;
    socket.data.playerIndex = 0;

    // Tell this player their room code and seat
    socket.emit('room-created', { roomCode, playerIndex: 0 });
    console.log(`[room]       ${roomCode} created by "${name}"`);
  });

  // ── join-room ──────────────────────────────────────────────────────────────
  // A second player wants to join an existing room.
  socket.on('join-room', ({ roomCode, playerName }) => {
    // Input sanitisation
    if (!playerName || !roomCode) return;
    const name = playerName.trim().slice(0, 20);
    const code = roomCode.trim().toUpperCase().slice(0, 5);
    if (!name || code.length !== 5) return;

    const room = rooms[code];

    // Guard: room must exist, have room for one more, and not have started yet
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

    // Add the second player
    room.players.push({ id: socket.id, name });
    socket.join(code);
    socket.data.roomCode    = code;
    socket.data.playerName  = name;
    socket.data.playerIndex = 1;

    // Confirm the join to this player
    socket.emit('joined-room', { roomCode: code, playerIndex: 1 });

    // Both players are present — start the game!
    room.phase = 'writing';
    io.to(code).emit('game-start', {
      players:     room.players.map(p => p.name),
      writerIndex: room.writerIndex,
      round:       room.round,
    });
    console.log(`[room]       ${code} started: "${room.players[0].name}" vs "${room.players[1].name}"`);
  });

  // ── submit-statements ──────────────────────────────────────────────────────
  // The writer submits their 3 statements and marks which one is true.
  socket.on('submit-statements', ({ statements }) => {
    const room = getRoomForSocket(socket);
    if (!room || room.phase !== 'writing') return;
    if (socket.data.playerIndex !== room.writerIndex) return; // only the writer may submit

    // Validate the payload — statements[0] and [1] are truths, [2] is the lie
    if (!Array.isArray(statements) || statements.length !== 3) return;
    const cleaned = statements.map(s => String(s).trim().slice(0, 200));
    if (cleaned.some(s => !s)) return; // every statement must be non-empty

    // Shuffle so the guesser can't predict the lie by position
    const indices = [0, 1, 2];
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const shuffled = indices.map(i => cleaned[i]);
    const lieIndex = indices.indexOf(2); // the lie was originally at index 2

    room.statements = shuffled;
    room.lieIndex   = lieIndex;
    room.phase      = 'guessing';

    // Broadcast the shuffled statements to both players (the guesser will see them).
    io.to(socket.data.roomCode).emit('show-statements', {
      statements: room.statements,
    });
    console.log(`[room]       ${socket.data.roomCode} statements submitted`);
  });

  // ── submit-guess ───────────────────────────────────────────────────────────
  // The guesser clicks the statement they believe is true.
  socket.on('submit-guess', ({ guessIndex }) => {
    const room = getRoomForSocket(socket);
    if (!room || room.phase !== 'guessing') return;
    if (socket.data.playerIndex === room.writerIndex) return; // only the guesser may guess

    if (typeof guessIndex !== 'number' || guessIndex < 0 || guessIndex > 2) return;

    const correct    = guessIndex === room.lieIndex;
    const writerName = room.players[room.writerIndex].name;
    const guesserName = room.players[1 - room.writerIndex].name;
    room.phase = 'reveal';

    // Send the outcome to both players
    io.to(socket.data.roomCode).emit('round-result', {
      guessIndex,
      lieIndex:    room.lieIndex,
      correct,
      writerName,
      guesserName,
      statements:  room.statements,
    });
    console.log(`[room]       ${socket.data.roomCode} round ${room.round} — ${correct ? 'correct ✓' : 'wrong ✗'}`);
  });

  // ── next-round ─────────────────────────────────────────────────────────────
  // A player clicked "Next Round". Both players must click before we advance.
  socket.on('next-round', () => {
    const room = getRoomForSocket(socket);
    if (!room || room.phase !== 'reveal') return;

    room.nextRoundVotes.add(socket.id);

    if (room.nextRoundVotes.size >= 2) {
      // Both players are ready — advance to the next round
      room.nextRoundVotes.clear();
      room.round++;
      room.writerIndex = 1 - room.writerIndex; // swap writer/guesser roles
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
      // Only one player has clicked — tell them to wait
      socket.emit('waiting-for-next-round');
    }
  });

  // ── disconnect ─────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    if (code && rooms[code]) {
      // Tell the other player (if any) the game is over
      socket.to(code).emit('player-disconnected', { name: socket.data.playerName });
      delete rooms[code];
      console.log(`[room]       ${code} closed — "${socket.data.playerName}" left`);
    }
    console.log(`[disconnect] ${socket.id}`);
  });
});

// ── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\nGuessMyLie is running → http://localhost:${PORT}\n`);
});
