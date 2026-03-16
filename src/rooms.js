'use strict';

// ── In-memory game state ──────────────────────────────────────────────────────
//
// rooms[roomCode] = {
//   players:        [ { id: socketId, name: string }, ... ],  // max 2
//   writerIndex:    number,   // 0 or 1 — index into players[]
//   statements:     string[], // 3 statements submitted by the writer
//   lieIndex:       number,   // shuffled index (0-2) of the lie statement
//   round:          number,   // starts at 1, increments each round
//   phase:          string,   // 'waiting' | 'writing' | 'guessing' | 'reveal'
//   nextRoundVotes: Set,      // socket IDs that clicked "Next Round"
// }
//
const rooms = {};

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

module.exports = { rooms, generateRoomCode, getRoomForSocket };
