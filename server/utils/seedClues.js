/**
 * Seed Script — Populates the database with a rich clue pool
 * Every clue has up to 2 progressive hints:
 *   hints[0] → revealed after ~33% of puzzle time (vague nudge)
 *   hints[1] → revealed after ~67% of puzzle time (stronger nudge, still no answer)
 *
 * Hint philosophy:
 *   - Never give the answer directly
 *   - Hint 1: reminds the player what kind of thing to look for
 *   - Hint 2: narrows the thinking without solving it
 *
 * Run: node utils/seedClues.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Clue = require('../models/Clue');
const { v4: uuidv4 } = require('uuid');

const cluePool = [

  // ══════════════════════════════════════════════════════════════════════════════
  // NUMBER PUZZLES
  // Hints focus on: what property to check, how to test it
  // ══════════════════════════════════════════════════════════════════════════════
  {
    category: 'number',
    template: 'Only even numbers survive. The code is {X}.',
    answerRule: 'even:{X}',
    variables: [{ name: 'X', type: 'number', min: 100, max: 999 }],
    flavorText: 'A wall covered in number sequences. Some glow green, some red.',
    difficulty: 1,
    hints: [
      'Even numbers are perfectly divisible by 2 with no remainder.',
      'Check the last digit — 0, 2, 4, 6, or 8 means even. Odd ends in 1, 3, 5, 7, or 9.',
    ],
  },
  {
    category: 'number',
    template: 'Numbers divisible by {X} escape. The lock reads {Y}.',
    answerRule: 'divisible_by:{X}:{Y}',
    variables: [
      { name: 'X', type: 'number', min: 2, max: 9 },
      { name: 'Y', type: 'number', min: 10, max: 99 },
    ],
    flavorText: 'Mathematical equations etched into the walls.',
    difficulty: 2,
    hints: [
      'Divisible means it divides evenly — no remainder left over.',
      'Divide the lock number by the rule number. If the result is a whole number, it qualifies.',
    ],
  },
  {
    category: 'number',
    template: 'The sum of digits must equal {X}. The code is {Y}.',
    answerRule: 'digit_sum:{X}:{Y}',
    variables: [
      { name: 'X', type: 'number', min: 5, max: 15 },
      { name: 'Y', type: 'number', min: 100, max: 999 },
    ],
    flavorText: 'A calculator display flickers on the wall.',
    difficulty: 3,
    hints: [
      'Add each individual digit of the code together separately, not the whole number.',
      'For a 3-digit code like 342: 3 + 4 + 2 = 9. Compare that sum to the target.',
    ],
  },
  {
    category: 'number',
    template: 'Prime numbers unlock the exit. You hold {X}.',
    answerRule: 'is_prime:{X}',
    variables: [{ name: 'X', type: 'number', min: 2, max: 100 }],
    flavorText: 'Ancient mathematical texts line the shelves.',
    difficulty: 3,
    hints: [
      'A prime number has exactly two divisors: 1 and itself. 1 is NOT prime.',
      'Try dividing the number by 2, 3, 5, 7… up to its square root. If nothing divides evenly, it\'s prime.',
    ],
  },
  {
    category: 'number',
    template: 'Odd numbers walk free. The sequence continues: {X}.',
    answerRule: 'odd:{X}',
    variables: [{ name: 'X', type: 'number', min: 1, max: 500 }],
    flavorText: 'Numbers carved into stone pillars surround you.',
    difficulty: 1,
    hints: [
      'An odd number cannot be divided equally into two whole groups.',
      'Just check the last digit — if it ends in 1, 3, 5, 7, or 9, it\'s odd.',
    ],
  },
  {
    category: 'number',
    template: 'Numbers greater than {X} survive. The counter shows {Y}.',
    answerRule: 'greater_than:{X}:{Y}',
    variables: [
      { name: 'X', type: 'number', min: 20, max: 80 },
      { name: 'Y', type: 'number', min: 1, max: 100 },
    ],
    flavorText: 'A threshold meter glows on the far wall.',
    difficulty: 2,
    hints: [
      'Compare the two numbers — the counter must strictly exceed the threshold.',
      '"Greater than" means strictly above, not equal. Equal does not survive.',
    ],
  },
  {
    category: 'number',
    template: 'The Fibonacci sequence holds truth. Is {X} in the sequence?',
    answerRule: 'fibonacci:{X}',
    variables: [{ name: 'X', type: 'number', min: 1, max: 200 }],
    flavorText: 'Spiraling patterns decorate every surface.',
    difficulty: 4,
    hints: [
      'The Fibonacci sequence: 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144… each number is the sum of the two before it.',
      'Check if your number appears in: 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233. If not, it\'s not Fibonacci.',
    ],
  },
  {
    category: 'number',
    template: 'Multiples of {X} are safe. The door number is {Y}.',
    answerRule: 'multiple_of:{X}:{Y}',
    variables: [
      { name: 'X', type: 'number', min: 3, max: 12 },
      { name: 'Y', type: 'number', min: 12, max: 120 },
    ],
    flavorText: 'Grid paper covers the walls, numbers crossed out systematically.',
    difficulty: 2,
    hints: [
      'Multiples are the numbers in a times table: ×1, ×2, ×3, etc.',
      'Divide the door number by the safe multiplier. If the remainder is 0, it\'s a multiple.',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // WORD CLUES
  // Hints focus on: what property of the word to test, how to check it
  // ══════════════════════════════════════════════════════════════════════════════
  {
    category: 'word',
    template: 'Words that contain the letter {L} lead to freedom. The word is "{W}".',
    answerRule: 'contains_letter:{L}:{W}',
    variables: [
      { name: 'L', type: 'letter' },
      { name: 'W', type: 'choice', options: ['APPLE', 'BRIDGE', 'CLOCK', 'DREAM', 'EAGLE', 'FLAME', 'GROVE', 'HEDGE', 'INDEX', 'JEWEL'] },
    ],
    flavorText: 'A typewriter sits on the desk, keys worn smooth.',
    difficulty: 2,
    hints: [
      'Scan each letter of the word one by one, looking for the target letter.',
      'The letter can appear anywhere — start, middle, or end of the word.',
    ],
  },
  {
    category: 'word',
    template: 'Words with more than {X} letters survive. The word is "{W}".',
    answerRule: 'length_greater:{X}:{W}',
    variables: [
      { name: 'X', type: 'number', min: 3, max: 7 },
      { name: 'W', type: 'choice', options: ['CAT', 'BIRD', 'EAGLE', 'PYTHON', 'ELEPHANT', 'RHINOCEROS', 'SALAMANDER'] },
    ],
    flavorText: 'Dictionaries stacked ceiling-high line the walls.',
    difficulty: 1,
    hints: [
      'Count the letters in the word carefully, one by one.',
      '"More than" means strictly above — a word with exactly that many letters does not survive.',
    ],
  },
  {
    category: 'word',
    template: 'Palindromes are the key. Is "{W}" a palindrome?',
    answerRule: 'palindrome:{W}',
    variables: [
      { name: 'W', type: 'choice', options: ['RACECAR', 'LEVEL', 'CIVIC', 'PLAIN', 'HELLO', 'REFER', 'TABLE', 'RADAR', 'HOUSE', 'KAYAK'] },
    ],
    flavorText: 'Mirrors line every wall, reflecting each other infinitely.',
    difficulty: 3,
    hints: [
      'A palindrome reads exactly the same forwards and backwards.',
      'Write the word, then compare the first letter to the last, second to second-to-last, and so on.',
    ],
  },
  {
    category: 'word',
    template: 'Only words starting with {C} survive. The password starts with "{W}".',
    answerRule: 'starts_with:{C}:{W}',
    variables: [
      { name: 'C', type: 'letter' },
      { name: 'W', type: 'choice', options: ['ALPHA', 'BETA', 'COBALT', 'DELTA', 'ECHO', 'FOXTROT', 'GAMMA', 'HERALD', 'IRON', 'JADE'] },
    ],
    flavorText: 'Alphabetical charts plastered on the ceiling.',
    difficulty: 2,
    hints: [
      'Look only at the very first letter of the word — that\'s all that matters here.',
      'Ignore everything else about the word. Does it begin with the required letter?',
    ],
  },
  {
    category: 'word',
    template: 'Words ending in a vowel escape. The word is "{W}".',
    answerRule: 'ends_vowel:{W}',
    variables: [
      { name: 'W', type: 'choice', options: ['STONE', 'GRAVEL', 'FIRE', 'STORM', 'CANDLE', 'BRIDGE', 'SMOKE', 'IRON', 'MARBLE', 'WINDOW'] },
    ],
    flavorText: 'Linguistic symbols and phonetic charts line the walls.',
    difficulty: 2,
    hints: [
      'The vowels are: A, E, I, O, U.',
      'Check only the last letter of the word. Is it one of the five vowels?',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // SYMBOL PUZZLES
  // Hints focus on: what shape property to identify, how to classify it
  // ══════════════════════════════════════════════════════════════════════════════
  {
    category: 'symbol',
    template: 'The {S1} symbol grants passage. Your mark is {S2}.',
    answerRule: 'symbol_match:{S1}:{S2}',
    variables: [
      { name: 'S1', type: 'symbol' },
      { name: 'S2', type: 'symbol' },
    ],
    flavorText: 'Arcane symbols carved into every stone.',
    difficulty: 2,
    hints: [
      'Compare the two symbols visually — are they identical, or just similar?',
      'Look at the exact number of sides, points, and fill style. Minor differences matter.',
    ],
  },
  {
    category: 'symbol',
    template: 'Triangular shapes survive. The door bears {S}.',
    answerRule: 'is_triangle:{S}',
    variables: [
      { name: 'S', type: 'choice', options: ['▲', '△', '▽', '●', '■', '◆', '★', '⬡', '⬟', '⬠'] },
    ],
    flavorText: 'Geometric murals cover the floor.',
    difficulty: 1,
    hints: [
      'A triangle has exactly 3 sides and 3 corners.',
      'Circles, squares, diamonds, hexagons, and stars are NOT triangles.',
    ],
  },
  {
    category: 'symbol',
    template: 'Stars lead the way. Count the points: {S} has {N} points.',
    answerRule: 'star_points:{N}',
    variables: [
      { name: 'S', type: 'choice', options: ['★', '✦', '✧', '✩', '✪', '✫', '✬'] },
      { name: 'N', type: 'number', min: 4, max: 8 },
    ],
    flavorText: 'Celestial maps adorn the domed ceiling.',
    difficulty: 3,
    hints: [
      'Count the sharp outer tips of the star — each spike is one point.',
      'A standard ★ has 5 points. More elaborate stars can have 4, 6, or 8. Count carefully.',
    ],
  },
  {
    category: 'symbol',
    template: 'Angular shapes escape. Round ones perish. The mark is {S}.',
    answerRule: 'is_angular:{S}',
    variables: [
      { name: 'S', type: 'choice', options: ['▲', '■', '◆', '●', '⬡', '⬟', '★', '⬠', '◯', '⊙'] },
    ],
    flavorText: 'Two columns: one labeled SHARP, one labeled ROUND.',
    difficulty: 2,
    hints: [
      'Angular shapes have corners and straight edges. Round shapes have curves.',
      'Circles, ellipses, and ovals are round. Triangles, squares, diamonds, and hexagons are angular.',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // ENVIRONMENT CLUES
  // Hints focus on: what to look at, how to calculate or compare
  // ══════════════════════════════════════════════════════════════════════════════
  {
    category: 'environment',
    template: 'The north wall has {X} marks. The south has {Y}. Subtract to find your path.',
    answerRule: 'subtract:{X}:{Y}',
    variables: [
      { name: 'X', type: 'number', min: 10, max: 30 },
      { name: 'Y', type: 'number', min: 5, max: 25 },
    ],
    flavorText: 'Tally marks cover both walls obsessively.',
    difficulty: 2,
    hints: [
      'Subtraction: take the smaller number away from the larger one.',
      'North minus South gives you a value. Think about whether that value matches what survival requires.',
    ],
  },
  {
    category: 'environment',
    template: 'The room temperature reads {T}°. Temperatures above {X}° are deadly.',
    answerRule: 'temperature_safe:{T}:{X}',
    variables: [
      { name: 'T', type: 'number', min: 15, max: 45 },
      { name: 'X', type: 'number', min: 20, max: 40 },
    ],
    flavorText: 'Thermometers mounted on every wall tick ominously.',
    difficulty: 2,
    hints: [
      'Compare the current temperature to the danger threshold — above it is deadly.',
      '"Above" means strictly greater than. At exactly the threshold, you are still safe.',
    ],
  },
  {
    category: 'environment',
    template: 'The clock shows {H}:{M}. Hours before midnight survive.',
    answerRule: 'before_midnight:{H}',
    variables: [
      { name: 'H', type: 'number', min: 1, max: 23 },
      { name: 'M', type: 'number', min: 0, max: 59 },
    ],
    flavorText: 'A grandfather clock dominates the room, ticking loudly.',
    difficulty: 2,
    hints: [
      'Focus only on the hour, not the minutes. Midnight is hour 0 or 24.',
      'Hours 1 through 11 are before midnight (AM). Hours 13 through 23 are after noon — are they before midnight?',
    ],
  },
  {
    category: 'environment',
    template: 'The floor tiles are {C1} and {C2}. Stand on {C1} to survive.',
    answerRule: 'tile_color:{C1}',
    variables: [
      { name: 'C1', type: 'choice', options: ['RED', 'BLUE', 'GREEN', 'WHITE', 'BLACK', 'YELLOW'] },
      { name: 'C2', type: 'choice', options: ['ORANGE', 'PURPLE', 'GRAY', 'BROWN', 'CYAN', 'PINK'] },
    ],
    flavorText: 'Checkerboard floor in two stark colors.',
    difficulty: 1,
    hints: [
      'The clue names the safe color directly — you just need to identify it.',
      'There are exactly two colors. The clue tells you which is safe. Don\'t overthink it.',
    ],
  },
  {
    category: 'environment',
    template: 'Exactly {X} items on the shelf survive. Count: there are {Y}.',
    answerRule: 'exact_count:{X}:{Y}',
    variables: [
      { name: 'X', type: 'number', min: 3, max: 10 },
      { name: 'Y', type: 'number', min: 2, max: 15 },
    ],
    flavorText: 'Identical objects line the shelves in neat rows.',
    difficulty: 3,
    hints: [
      'You need an exact match — more or fewer items than required is still wrong.',
      'Compare the count on the shelf to the survival number. Are they equal?',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // LOGIC RIDDLES
  // Hints focus on: which logical rule applies, how to reason step by step
  // ══════════════════════════════════════════════════════════════════════════════
  {
    category: 'logic',
    template: 'All {A}s are {B}s. Some {B}s are {C}s. Is this {A} a {C}?',
    answerRule: 'syllogism:uncertain',
    variables: [
      { name: 'A', type: 'choice', options: ['ravens', 'cats', 'stones', 'trees', 'rivers'] },
      { name: 'B', type: 'choice', options: ['animals', 'objects', 'things', 'entities', 'bodies'] },
      { name: 'C', type: 'choice', options: ['mortal', 'heavy', 'alive', 'ancient', 'silent'] },
    ],
    flavorText: 'A philosopher\'s notebook lies open on the table.',
    difficulty: 4,
    hints: [
      '"All A are B" is certain. "Some B are C" means only part of B qualifies — not all.',
      'You know the item is A, therefore it is B. But does being B guarantee being C? No — only some B are C.',
    ],
  },
  {
    category: 'logic',
    template: 'If it rains, the ground is wet. The ground is dry. Did it rain?',
    answerRule: 'modus_tollens:no',
    variables: [],
    flavorText: 'A weather station with contradictory readings.',
    difficulty: 3,
    hints: [
      'This is a cause-and-effect chain. If the cause happened, the effect would follow.',
      'The effect (wet ground) did NOT happen. Therefore the cause (rain) cannot have happened either.',
    ],
  },
  {
    category: 'logic',
    template: 'A guard always lies. A prisoner always tells truth. One says "{X}". Do you believe them?',
    answerRule: 'truth_teller:uncertain',
    variables: [
      { name: 'X', type: 'choice', options: ['Go left', 'Take the LIVE door', 'Trust the symbol', 'Follow the numbers', 'The clock is right'] },
    ],
    flavorText: 'Two figures in the shadows, faces obscured.',
    difficulty: 4,
    hints: [
      'You don\'t know which figure is the guard and which is the prisoner.',
      'Since you can\'t tell who\'s speaking, any statement could be a lie OR truth. The claim is unverifiable.',
    ],
  },
  {
    category: 'logic',
    template: 'Three boxes: one has treasure, two have traps. You pick box {N}. One trap box is revealed. Should you switch?',
    answerRule: 'monty_hall:switch',
    variables: [
      { name: 'N', type: 'number', min: 1, max: 3 },
    ],
    flavorText: 'Three identical boxes sit on a pedestal. One glows faintly.',
    difficulty: 5,
    hints: [
      'Your initial pick had a 1-in-3 chance. The other two boxes together held a 2-in-3 chance.',
      'Revealing a trap doesn\'t change your original odds — it concentrates the 2/3 probability into the one remaining unchosen box.',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // PATTERN PUZZLES
  // Hints focus on: how to identify the pattern, how to apply it
  // ══════════════════════════════════════════════════════════════════════════════
  {
    category: 'pattern',
    template: 'The sequence: {A}, {B}, {C}, ?. The next number is {D}. Does {D} match the pattern?',
    answerRule: 'sequence:{A}:{B}:{C}:{D}',
    variables: [
      { name: 'A', type: 'number', min: 1, max: 5 },
      { name: 'B', type: 'number', min: 2, max: 10 },
      { name: 'C', type: 'number', min: 3, max: 15 },
      { name: 'D', type: 'number', min: 4, max: 20 },
    ],
    flavorText: 'Number sequences projected on every wall.',
    difficulty: 3,
    hints: [
      'Find the pattern by looking at what changes between each number: addition, multiplication, or something else?',
      'Calculate the gap: B-A, then C-B. If the gaps are equal, it\'s arithmetic. Apply the same gap to C to get the expected next value.',
    ],
  },
  {
    category: 'pattern',
    template: 'Colors cycle: RED → GREEN → BLUE → RED… The {N}th color is {C}.',
    answerRule: 'color_cycle:{N}:{C}',
    variables: [
      { name: 'N', type: 'number', min: 4, max: 20 },
      { name: 'C', type: 'choice', options: ['RED', 'GREEN', 'BLUE'] },
    ],
    flavorText: 'Colored light panels flash in sequence.',
    difficulty: 3,
    hints: [
      'The pattern repeats every 3 steps: RED=1, GREEN=2, BLUE=3, then RED=4 again.',
      'Use the remainder when dividing N by 3: remainder 1 = RED, remainder 2 = GREEN, remainder 0 = BLUE.',
    ],
  },
  {
    category: 'pattern',
    template: 'The pattern ▲●■ repeats. Position {X} holds {S}.',
    answerRule: 'shape_pattern:{X}:{S}',
    variables: [
      { name: 'X', type: 'number', min: 4, max: 15 },
      { name: 'S', type: 'choice', options: ['▲', '●', '■'] },
    ],
    flavorText: 'Tiles in a repeating pattern stretch across the floor.',
    difficulty: 2,
    hints: [
      'The cycle is exactly 3 long: ▲ at position 1, ● at position 2, ■ at position 3, then ▲ again at 4.',
      'Divide the position by 3. Remainder 1 = ▲, remainder 2 = ●, remainder 0 = ■.',
    ],
  },
  {
    category: 'pattern',
    template: 'Double each time: {A}, {B}, {C}… The next value is {D}. Is {D} correct?',
    answerRule: 'double_sequence:{A}:{B}:{C}:{D}',
    variables: [
      { name: 'A', type: 'number', min: 1, max: 4 },
      { name: 'B', type: 'number', min: 2, max: 8 },
      { name: 'C', type: 'number', min: 4, max: 16 },
      { name: 'D', type: 'number', min: 5, max: 40 },
    ],
    flavorText: 'Exponential graphs cover every wall.',
    difficulty: 4,
    hints: [
      'Each number is exactly twice the previous one — that\'s a geometric sequence with ratio 2.',
      'Multiply C by 2 to get the expected next value. Does your D match that?',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // SOUND CLUES
  // Hints focus on: what audio property to analyze, how to categorize it
  // ══════════════════════════════════════════════════════════════════════════════
  {
    category: 'sound',
    template: 'The siren pulses {X} times. Odd pulse counts unlock the exit.',
    answerRule: 'odd:{X}',
    variables: [{ name: 'X', type: 'number', min: 1, max: 15 }],
    flavorText: 'A distant alarm echoes through the ventilation shafts.',
    difficulty: 1,
    hints: [
      'Count the pulses carefully — miscount by one and you choose the wrong door.',
      'Odd means the count cannot be split into two equal halves. Check: is the number odd or even?',
    ],
  },
  {
    category: 'sound',
    template: 'The tone frequency reads {X} Hz. Frequencies above {Y} Hz are safe.',
    answerRule: 'greater_than:{Y}:{X}',
    variables: [
      { name: 'X', type: 'number', min: 200, max: 800 },
      { name: 'Y', type: 'number', min: 300, max: 700 },
    ],
    flavorText: 'A frequency analyzer displays waveforms on the wall panel.',
    difficulty: 2,
    hints: [
      'Compare the displayed frequency against the safety threshold.',
      'Higher frequency means a higher-pitched sound. Is the reading above or below the threshold?',
    ],
  },
  {
    category: 'sound',
    template: 'Morse code plays: {X} beeps total. Prime counts signal safety.',
    answerRule: 'is_prime:{X}',
    variables: [{ name: 'X', type: 'number', min: 2, max: 30 }],
    flavorText: 'A telegraph machine taps out a rhythmic signal.',
    difficulty: 3,
    hints: [
      'Count every beep — both short and long — to get the total.',
      'A prime number is only divisible by 1 and itself. 2, 3, 5, 7, 11, 13, 17, 19, 23, 29 are prime under 30.',
    ],
  },
];

async function seedClues() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dead-or-alive');
    console.log('✅ Connected to MongoDB');

    const before = await Clue.countDocuments();
    await Clue.deleteMany({});
    console.log(`🗑️  Cleared ${before} existing clues`);

    const cluesWithIds = cluePool.map((c) => ({ ...c, clueId: uuidv4() }));
    await Clue.insertMany(cluesWithIds);

    // Print summary
    const byCategory = {};
    for (const c of cluePool) {
      byCategory[c.category] = (byCategory[c.category] || 0) + 1;
    }
    console.log(`\n✅ Seeded ${cluesWithIds.length} clues:\n`);
    for (const [cat, count] of Object.entries(byCategory)) {
      const bar = '█'.repeat(count);
      console.log(`   ${cat.padEnd(14)} ${bar} ${count}`);
    }
    const withHints = cluePool.filter((c) => c.hints?.length > 0).length;
    console.log(`\n   ${withHints}/${cluesWithIds.length} clues have hints\n`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
}

seedClues();
