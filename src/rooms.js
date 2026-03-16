'use strict';

// ── In-memory game state ──────────────────────────────────────────────────────
//
// rooms[roomCode] = {
//   players:        [ { id: socketId, name: string }, ... ],  // max 2
//   writerIndex:    number,   // 0 or 1 — index into players[]
//   statements:     string[], // 3 statements submitted by the writer
//   targetIndex:    number,   // shuffled index the guesser must pick to be correct
//   round:          number,   // starts at 1, increments each round
//   phase:          string,   // 'waiting' | 'writing' | 'guessing' | 'reveal'
//   nextRoundVotes: Set,      // socket IDs that clicked "Next Round"
//   settings:       { totalRounds: number, gameMode: 'ttol'|'ottl' },
//   scores:         [number, number],  // scores[playerIndex]
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
