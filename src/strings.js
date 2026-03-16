'use strict';

// ── Flavour strings ───────────────────────────────────────────────────────────
//
// Each category is an array of messages. The server picks one at random when a
// round ends and sends it to both players inside the 'round-result' event.
//
const strings = {

  // Shown to the WRITER when the guesser found their lie
  writerCaught: [
    '😅 Caught! Your lie was too obvious.',
    '🫣 They saw right through you!',
    '🚨 Lie detector triggered.',
    '😬 Better craft a more convincing lie next time.',
    '👀 They were watching closely.',
    '🔍 Busted. Try harder next round.',
    '🫠 Your poker face needs work.',
  ],

  // Shown to the WRITER when the guesser missed the lie
  writerWon: [
    '😈 They fell for it! Master of deception.',
    '🃏 Flawless performance.',
    '🦊 Cunning. Very cunning.',
    '💅 Too easy.',
    '🎭 Oscar-worthy lying.',
    '😂 That was a terrible lie and they still missed it.',
    '🧙 Pure wizardry.',
  ],

  // Shown to the GUESSER when they found the lie
  guesserCorrect: [
    '🎉 You spotted the lie!',
    '👏 Nice guess — you saw right through it!',
    '🕵️ Nothing gets past you!',
    '🔍 Lie detected. Great instincts!',
    '😎 Too easy for you, apparently.',
    '🧠 Big brain energy.',
    '🫵 Gotcha!',
  ],

  // Shown to the GUESSER when they missed the lie
  guesserWrong: [
    '🤨 Suspicious… and yet, wrong.',
    '💀 Completely bamboozled.',
    '🙈 The lie was right there!',
    '😬 Better luck next round.',
    '😂 Walked right into that one.',
    '🃏 You played yourself.',
    '🫠 Totally fooled.',
  ],

};

/** Pick a random entry from an array. */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = { strings, pick };
