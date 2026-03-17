// keep in sync with src/strings.js

const TIPS = {

  // guesser tips (2 truths, 1 lie)
  guesser: [
    'Liars often add unnecessary detail to sound more credible.',
    'The most interesting-sounding statement might be the lie.',
    'Truths tend to feel natural — lies can feel slightly over-prepared.',
    'Trust your gut. Your first instinct is often right.',
    'Look for statements that are oddly vague or suspiciously specific.',
    "If a statement feels like it's trying too hard, it probably is.",
    'A well-crafted liar will hide the lie in plain sight.',
    'Statements that are too perfect or too dramatic are often the lie.',
    'Watch for statements that feel emotionally flat — lies are sometimes underplayed.',
    'If one statement stands out as unusual but oddly believable, it might be a trap.',
    'The lie is often the one that sounds the most like a story.',
    'Consider which statement the writer would find hardest to defend under questioning.',
    'Liars tend to avoid pronouns — look for impersonal or passive phrasing.',
    "A statement that hedges or qualifies itself might be the one they're unsure about.",
    "Your opponent knows what you'll expect. Sometimes the obvious one is the trick.",
  ],

  // guesser tips (1 truth, 2 lies)
  guesserOttl: [
    'With two lies in the mix, the truth will likely be the most understated.',
    'The true statement is often the one that feels the least like it needs to impress.',
    'Liars have to invent two stories here — look for the one that feels most consistent.',
    'Trust your gut. Your first instinct is often right.',
    'The truth rarely tries to convince you. The lies might.',
    'Watch for two statements that feel thematically similar — one is probably a pair of lies.',
    'The real statement is likely to be quieter and more matter-of-fact.',
    'In 1T2L, the writer has to work twice as hard. Look for small inconsistencies between the lies.',
    'A lie needs to be maintained; a truth just needs to be remembered.',
    'If one statement feels oddly specific and personal, it might actually be the truth.',
    'Two lies means double the chances of a slip-up — look for the one that stands apart.',
    'The truth often lacks the flair the writer tries to give the lies.',
  ],

  // writer tips (2 truths, 1 lie)
  writer: [
    'Ground your lie in something plausible — the best lies are almost true.',
    'Use specific details in your truths to make the lie feel just as real.',
    'A lie with an emotional angle is harder to dismiss.',
    'Keep all three statements similar in length so nothing stands out.',
    'Pick a lie that could believably happen to someone like you.',
    'Avoid starting sentences differently — consistent phrasing reduces tells.',
    'The best lies borrow a little truth from somewhere else in your life.',
    'Make your lie sound as boring as your truths — drama attracts suspicion.',
    'If possible, set your lie in a real place or time period you know well.',
    'Add a minor flaw or awkward detail to your lie to make it feel lived-in.',
    'Avoid superlatives in your lie — "the most" and "the only" draw attention.',
    'Think about which statement your opponent will find hardest to believe, and make it a truth.',
    'A lie hidden between two very different truths is easier to spot — vary your truths wisely.',
    'Read all three statements aloud in your head — the lie should feel just as natural as the rest.',
    "Don't overthink the lie. Simple and plausible beats clever and elaborate.",
  ],

  // writer tips (1 truth, 2 lies)
  writerOttl: [
    'You only have one truth — make it feel just as unremarkable as the lies.',
    'Keep your truth from standing out. Plain and quiet wins.',
    'Your two lies should feel distinct from each other so they both seem credible.',
    'Borrow real details from your life for the lies — it makes them harder to dismiss.',
    'Avoid making your truth the most interesting-sounding statement.',
    'Make all three statements a similar emotional weight so nothing jumps out.',
    'With two lies to craft, consistency is your biggest challenge — read them together.',
    'The guesser is looking for the outlier. Make sure nothing stands alone.',
    "Don't let your truth sound more confident than your lies.",
    'Think about what the guesser will instinctively trust — bury the truth in that space.',
    'Two lies means twice the risk of giving something away — keep them grounded.',
    'Vary the style of your lies slightly so they feel independently genuine.',
  ],

};

// did you know facts
const FACTS = [
  'Most people tell 1–2 lies per day on average.',
  'Research suggests 54% of lies go undetected by the person being lied to.',
  'Humans are only slightly better than chance at detecting lies — about 54% accurate.',
  'The face is the least reliable body part when spotting a liar.',
  'Silence is a surprisingly powerful lie-detection tool — liars hate pauses.',
  'Children start lying as early as age 2, but get better at it by age 4.',
  'Studies show that people lie more via phone than face-to-face.',
  'The average person encounters over 200 lies per week.',
  'Poker players are trained specifically to suppress unconscious truth-leaking signals.',
  'Liars tend to use fewer first-person pronouns like "I" to distance themselves from the lie.',
  'The "Pinocchio effect" is real — lying causes a slight increase in nose temperature.',
  'Most people focus on the wrong cues when spotting a lie (eye contact, fidgeting).',
  'There is no single reliable tell — skilled lie detectors look for inconsistencies instead.',
  'The more someone protests "I swear" or "honestly", the more suspicious it can appear.',
  'Psychopaths are better at lying — they feel less stress and show fewer physical tells.',
  'Memory is reconstructive, meaning even honest people can "remember" things that never happened.',
  'Truthful people tend to include more spontaneous corrections and self-doubts in their stories.',
];
