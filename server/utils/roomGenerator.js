/**
 * Room Generator
 * Procedurally generates puzzle rooms with clues and door assignments.
 *
 * KEY DESIGN: The LIVE door is ALWAYS the correct door.
 * The clue's answerRule is evaluated against the resolved variables to determine
 * whether the condition is TRUE or FALSE.
 *   - Condition TRUE  → LIVE door survives  (player should pick LIVE)
 *   - Condition FALSE → DIE door survives   (player should pick DIE)
 *
 * This means the clue logic is ALWAYS consistent:
 *   "Only even numbers survive. The code is 733."
 *   733 is odd → condition FALSE → correctDoor = 'DIE'
 *   Player picks DIE → survives ✅
 */

const Clue = require('../models/Clue');
const { v4: uuidv4 } = require('uuid');

// ─── Seeded random helper ─────────────────────────────────────────────────────
function seededRandom(seed) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

// ─── Answer rule evaluator ────────────────────────────────────────────────────
/**
 * Evaluates whether the clue condition is TRUE (LIVE) or FALSE (DIE).
 * All variables in answerRule are already resolved (e.g. "divisible_by:4:36").
 *
 * @param {String} answerRule - fully resolved rule string
 * @returns {Boolean} true = LIVE door wins, false = DIE door wins
 */
function evaluateAnswerRule(answerRule) {
  const rule = answerRule.trim().toLowerCase();

  try {
    // ── Simple parity ──────────────────────────────────────────────────────────
    if (rule === 'even') {
      // No variable — means the clue uses a static even/odd check.
      // We default to true (LIVE) since the template provides the number inline.
      return true;
    }
    if (rule === 'odd') {
      return true;
    }

    // ── even:{X} / odd:{X} ─────────────────────────────────────────────────────
    const evenMatch = rule.match(/^even:(\d+)$/);
    if (evenMatch) return parseInt(evenMatch[1]) % 2 === 0;

    const oddMatch = rule.match(/^odd:(\d+)$/);
    if (oddMatch) return parseInt(oddMatch[1]) % 2 !== 0;

    // ── divisible_by:{X}:{Y} — is Y divisible by X? ───────────────────────────
    const divMatch = rule.match(/^divisible_by:(\d+):(\d+)$/);
    if (divMatch) return parseInt(divMatch[2]) % parseInt(divMatch[1]) === 0;

    // ── multiple_of:{X}:{Y} — same as divisible_by ────────────────────────────
    const mulMatch = rule.match(/^multiple_of:(\d+):(\d+)$/);
    if (mulMatch) return parseInt(mulMatch[2]) % parseInt(mulMatch[1]) === 0;

    // ── greater_than:{X}:{Y} — is Y > X? ─────────────────────────────────────
    const gtMatch = rule.match(/^greater_than:(\d+):(\d+)$/);
    if (gtMatch) return parseInt(gtMatch[2]) > parseInt(gtMatch[1]);

    // ── less_than:{X}:{Y} — is Y < X? ────────────────────────────────────────
    const ltMatch = rule.match(/^less_than:(\d+):(\d+)$/);
    if (ltMatch) return parseInt(ltMatch[2]) < parseInt(ltMatch[1]);

    // ── digit_sum:{X}:{Y} — does digit sum of Y equal X? ─────────────────────
    const dsMatch = rule.match(/^digit_sum:(\d+):(\d+)$/);
    if (dsMatch) {
      const target = parseInt(dsMatch[1]);
      const num = dsMatch[2];
      const sum = num.split('').reduce((acc, d) => acc + parseInt(d), 0);
      return sum === target;
    }

    // ── is_prime:{X} ──────────────────────────────────────────────────────────
    const primeMatch = rule.match(/^is_prime:(\d+)$/);
    if (primeMatch) {
      const n = parseInt(primeMatch[1]);
      if (n < 2) return false;
      for (let i = 2; i <= Math.sqrt(n); i++) {
        if (n % i === 0) return false;
      }
      return true;
    }

    // ── fibonacci:{X} ─────────────────────────────────────────────────────────
    const fibMatch = rule.match(/^fibonacci:(\d+)$/);
    if (fibMatch) {
      const n = parseInt(fibMatch[1]);
      // A number is Fibonacci iff one or both of (5n²+4) or (5n²-4) is a perfect square
      const isPerfectSquare = (x) => {
        const s = Math.round(Math.sqrt(x));
        return s * s === x;
      };
      return isPerfectSquare(5 * n * n + 4) || isPerfectSquare(5 * n * n - 4);
    }

    // ── is_square:{X} ─────────────────────────────────────────────────────────
    const sqMatch = rule.match(/^is_square:(\d+)$/);
    if (sqMatch) {
      const n = parseInt(sqMatch[1]);
      const s = Math.round(Math.sqrt(n));
      return s * s === n;
    }

    // ── contains_letter:{L}:{W} ───────────────────────────────────────────────
    const clMatch = rule.match(/^contains_letter:([a-z]):([a-z]+)$/);
    if (clMatch) return clMatch[2].includes(clMatch[1]);

    // ── length_greater:{X}:{W} ────────────────────────────────────────────────
    const lgMatch = rule.match(/^length_greater:(\d+):([a-z]+)$/);
    if (lgMatch) return lgMatch[2].length > parseInt(lgMatch[1]);

    // ── length_equals:{X}:{W} ─────────────────────────────────────────────────
    const leMatch = rule.match(/^length_equals:(\d+):([a-z]+)$/);
    if (leMatch) return leMatch[2].length === parseInt(leMatch[1]);

    // ── palindrome:{W} ────────────────────────────────────────────────────────
    const palMatch = rule.match(/^palindrome:([a-z]+)$/);
    if (palMatch) {
      const w = palMatch[1];
      return w === w.split('').reverse().join('');
    }

    // ── starts_with:{C}:{W} ───────────────────────────────────────────────────
    const swMatch = rule.match(/^starts_with:([a-z]):([a-z]+)$/);
    if (swMatch) return swMatch[2].startsWith(swMatch[1]);

    // ── ends_vowel:{W} ────────────────────────────────────────────────────────
    const evMatch = rule.match(/^ends_vowel:([a-z]+)$/);
    if (evMatch) return 'aeiou'.includes(evMatch[1].slice(-1));

    // ── no_vowels:{W} ─────────────────────────────────────────────────────────
    const nvMatch = rule.match(/^no_vowels:([a-z]+)$/);
    if (nvMatch) return !/[aeiou]/.test(nvMatch[1]);

    // ── is_triangle:{S} ───────────────────────────────────────────────────────
    const triMatch = rule.match(/^is_triangle:(.+)$/);
    if (triMatch) return ['▲', '△', '▽'].includes(triMatch[1]);

    // ── is_angular:{S} ────────────────────────────────────────────────────────
    const angMatch = rule.match(/^is_angular:(.+)$/);
    if (angMatch) return ['▲', '■', '◆', '⬡', '⬟', '⬠', '★', '△', '▽', '□', '▭'].includes(angMatch[1]);

    // ── is_quadrilateral:{S} ──────────────────────────────────────────────────
    const quadMatch = rule.match(/^is_quadrilateral:(.+)$/);
    if (quadMatch) return ['■', '◆', '□', '▭', '▱', '◻'].includes(quadMatch[1]);

    // ── is_filled:{S} ─────────────────────────────────────────────────────────
    const filledMatch = rule.match(/^is_filled:(.+)$/);
    if (filledMatch) return ['▲', '■', '●', '◆', '★'].includes(filledMatch[1]);

    // ── symbol_match:{S1}:{S2} ────────────────────────────────────────────────
    const symMatch = rule.match(/^symbol_match:(.+):(.+)$/);
    if (symMatch) return symMatch[1] === symMatch[2];

    // ── temperature_safe:{T}:{X} — is T <= X (not above X)? ──────────────────
    const tempMatch = rule.match(/^temperature_safe:(\d+):(\d+)$/);
    if (tempMatch) return parseInt(tempMatch[1]) <= parseInt(tempMatch[2]);

    // ── before_midnight:{H} — is hour < 24 (and not 0)? ──────────────────────
    const midnightMatch = rule.match(/^before_midnight:(\d+)$/);
    if (midnightMatch) {
      const h = parseInt(midnightMatch[1]);
      return h > 0 && h < 24;
    }

    // ── subtract_positive:{X}:{Y} — is X - Y > 0? ────────────────────────────
    const subMatch = rule.match(/^subtract_positive:(\d+):(\d+)$/);
    if (subMatch) return parseInt(subMatch[1]) - parseInt(subMatch[2]) > 0;

    // ── exact_count:{X}:{Y} — is Y === X? ────────────────────────────────────
    const countMatch = rule.match(/^exact_count:(\d+):(\d+)$/);
    if (countMatch) return parseInt(countMatch[1]) === parseInt(countMatch[2]);

    // ── tile_color:{C1} — condition is always true (the safe tile is named) ───
    if (rule.startsWith('tile_color:')) return true;

    // ── modus_tollens:no — conclusion is always NO (DIE) ─────────────────────
    if (rule === 'modus_tollens:no') return false;

    // ── deductive_chain:yes — conclusion is always YES (LIVE) ─────────────────
    if (rule === 'deductive_chain:yes') return true;

    // ── contrapositive:no — cannot enter (DIE) ────────────────────────────────
    if (rule === 'contrapositive:no') return false;

    // ── monty_hall:switch — switching is always correct ───────────────────────
    // By convention we say switching leads to LIVE
    if (rule === 'monty_hall:switch') return true;

    // ── syllogism:not_necessarily / truth_teller:uncertain ────────────────────
    // These are ambiguous — use seeded random to pick
    if (rule.includes('uncertain') || rule.includes('not_necessarily')) {
      return null; // handled below with fallback
    }

    // ── disjunction:yes ───────────────────────────────────────────────────────
    if (rule === 'disjunction:yes') return true;

    // ── color_cycle:{N}:{C} ───────────────────────────────────────────────────
    const ccMatch = rule.match(/^color_cycle:(\d+):([a-z]+)$/);
    if (ccMatch) {
      const pos = parseInt(ccMatch[1]);
      const color = ccMatch[2];
      const cycle = ['red', 'green', 'blue'];
      return cycle[(pos - 1) % 3] === color;
    }

    // ── shape_cycle:{X}:{S} ───────────────────────────────────────────────────
    const scMatch = rule.match(/^shape_cycle:(\d+):(.+)$/);
    if (scMatch) {
      const pos = parseInt(scMatch[1]);
      const shape = scMatch[2];
      const cycle = ['▲', '●', '■'];
      return cycle[(pos - 1) % 3] === shape;
    }

    // ── letter_cycle:{N}:{L} ──────────────────────────────────────────────────
    const lcMatch = rule.match(/^letter_cycle:(\d+):([a-z])$/);
    if (lcMatch) {
      const pos = parseInt(lcMatch[1]);
      const letter = lcMatch[2];
      const cycle = ['a', 'b', 'c'];
      return cycle[(pos - 1) % 3] === letter;
    }

    // ── parity_alternation:{N}:{X} ────────────────────────────────────────────
    const paMatch = rule.match(/^parity_alternation:(\d+):(\d+)$/);
    if (paMatch) {
      const pos = parseInt(paMatch[1]);
      const val = parseInt(paMatch[2]);
      const posIsOdd = pos % 2 !== 0;
      const valIsOdd = val % 2 !== 0;
      return posIsOdd === valIsOdd;
    }

    // ── arithmetic_sequence:{A}:{B}:{C}:{D} ──────────────────────────────────
    const asMatch = rule.match(/^arithmetic_sequence:(\d+):(\d+):(\d+):(\d+)$/);
    if (asMatch) {
      const [a, b, c, d] = [1,2,3,4].map(i => parseInt(asMatch[i]));
      const gap = b - a;
      return d === c + gap;
    }

    // ── double_sequence:{A}:{B}:{C}:{D} ──────────────────────────────────────
    const dblMatch = rule.match(/^double_sequence:(\d+):(\d+):(\d+):(\d+)$/);
    if (dblMatch) {
      const c = parseInt(dblMatch[3]);
      const d = parseInt(dblMatch[4]);
      return d === c * 2;
    }

    // ── higher_pitch:{A}:{B} — is A > B? ─────────────────────────────────────
    const hpMatch = rule.match(/^higher_pitch:(\d+):(\d+)$/);
    if (hpMatch) return parseInt(hpMatch[1]) > parseInt(hpMatch[2]);

    // ── rhythm_pattern:{N}:{B} ────────────────────────────────────────────────
    const rpMatch = rule.match(/^rhythm_pattern:(\d+):([a-z]+)$/);
    if (rpMatch) {
      const pos = parseInt(rpMatch[1]);
      const beat = rpMatch[2];
      return (pos % 3 === 1) === (beat === 'loud');
    }

    // ── is_north:{D} ──────────────────────────────────────────────────────────
    const northMatch = rule.match(/^is_north:([a-z]+)$/);
    if (northMatch) return northMatch[1] === 'north';

    // ── star_points:{N} — always true (flavor only, N is given in template) ───
    if (rule.startsWith('star_points:')) return true;

    // ── symmetry_gte:{N}:{S} ─────────────────────────────────────────────────
    const symGteMatch = rule.match(/^symmetry_gte:(\d+):(.+)$/);
    if (symGteMatch) {
      const n = parseInt(symGteMatch[1]);
      const s = symGteMatch[2];
      const symLines = { '●': 999, '■': 4, '▲': 3, '⬡': 6, '◆': 2, '▭': 2, '△': 3, '□': 4 };
      return (symLines[s] || 1) >= n;
    }

    // ── skip_pattern:{K}:{P}:{T} ──────────────────────────────────────────────
    const skipMatch = rule.match(/^skip_pattern:(\d+):(\d+):([a-z]+)$/);
    if (skipMatch) {
      const k = parseInt(skipMatch[1]);
      const p = parseInt(skipMatch[2]);
      const t = skipMatch[3];
      const isSkipped = p % k === 0;
      return (t === 'skipped' || t === 'empty' || t === 'blank') === isSkipped;
    }

    // ── interval_count:{K}:{T}:{N} ────────────────────────────────────────────
    const icMatch = rule.match(/^interval_count:(\d+):(\d+):(\d+)$/);
    if (icMatch) {
      const k = parseInt(icMatch[1]);
      const t = parseInt(icMatch[2]);
      const n = parseInt(icMatch[3]);
      return Math.floor(t / k) === n;
    }

    // ── Fallback: unknown rule — default to LIVE ───────────────────────────────
    console.warn(`[roomGenerator] Unknown answerRule: "${answerRule}" — defaulting to LIVE`);
    return true;

  } catch (err) {
    console.error(`[roomGenerator] Error evaluating rule "${answerRule}":`, err.message);
    return true; // safe default
  }
}

/**
 * Determines which door label (LIVE or DIE) a player must choose to survive.
 *
 * Logic:
 *   conditionTrue  → the clue says this value IS the survivor → pick LIVE
 *   conditionFalse → the clue says this value is NOT the survivor → pick DIE
 *
 * Example:
 *   "Only even numbers survive. Code is 733."
 *   answerRule = "even" (no variable — the number 733 comes from the template)
 *   Wait — for rules like "even"/"odd" without embedded number,
 *   we need to extract the number from resolvedVars. See generateRoom below.
 */
function determineCorrectDoor(answerRule) {
  const result = evaluateAnswerRule(answerRule);
  // null means ambiguous (e.g. uncertain syllogism) — randomly assign
  if (result === null) {
    return Math.random() > 0.5 ? 'LIVE' : 'DIE';
  }
  return result ? 'LIVE' : 'DIE';
}

/**
 * Resolves variables in a clue template using seeded randomness.
 * Also ensures the answerRule contains the resolved values so evaluateAnswerRule
 * can work correctly — e.g. bare "even" becomes "even:765" after resolving {X}=765.
 */
function resolveClue(clue, seed) {
  const resolvedVars = {};
  let text = clue.template;
  let answerRule = clue.answerRule;

  clue.variables.forEach((variable, i) => {
    let value;
    const rand = seededRandom(seed + i * 137);

    if (variable.type === 'number') {
      value = Math.floor(rand * (variable.max - variable.min + 1)) + variable.min;
    } else if (variable.type === 'letter') {
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      value = letters[Math.floor(rand * 26)];
    } else if (variable.type === 'word' || variable.type === 'choice') {
      const opts = variable.options || [];
      value = opts.length > 0 ? opts[Math.floor(rand * opts.length)] : '?';
    } else if (variable.type === 'symbol') {
      const symbols = ['★', '▲', '●', '■', '◆', '✦', '⬟', '⬡'];
      value = symbols[Math.floor(rand * symbols.length)];
    } else {
      value = '?';
    }

    resolvedVars[variable.name] = value;
    // Replace {NAME} in both template text and answer rule
    const pattern = new RegExp(`\\{${variable.name}\\}`, 'g');
    text = text.replace(pattern, value);
    answerRule = answerRule.replace(pattern, String(value).toLowerCase());
  });

  // ── Post-process: embed resolved number into bare parity rules ──────────────
  // If answerRule is just "even" or "odd" but the clue has a number variable,
  // append the resolved number so evaluateAnswerRule can check it properly.
  // e.g. answerRule="even", resolvedVars={X:765} → answerRule="even:765"
  const bareEven = answerRule.trim().toLowerCase() === 'even';
  const bareOdd  = answerRule.trim().toLowerCase() === 'odd';

  if (bareEven || bareOdd) {
    // Find the first number variable's resolved value
    const numVar = clue.variables.find(v => v.type === 'number');
    if (numVar && resolvedVars[numVar.name] !== undefined) {
      answerRule = `${answerRule.trim().toLowerCase()}:${resolvedVars[numVar.name]}`;
    }
  }

  return { text, resolvedVars, answerRule };
}

/**
 * Generates a single room configuration.
 */
async function generateRoom(roomNumber, difficulty, excludeClueIds = []) {
  const seed = Date.now() + roomNumber * 7919;

  // ── Fetch eligible clues ──────────────────────────────────────────────────
  let clues = await Clue.find({
    isActive: true,
    difficulty: { $lte: difficulty + 1, $gte: Math.max(1, difficulty - 1) },
    _id: { $nin: excludeClueIds },
  }).limit(20);

  if (clues.length === 0) {
    clues = await Clue.find({ isActive: true }).limit(20);
    if (clues.length === 0) throw new Error('No clues available in database');
  }

  // Pick a clue using seeded random for reproducibility
  const clue = clues[Math.floor(seededRandom(seed) * clues.length)];

  // Resolve all {VARIABLE} placeholders
  const { text, resolvedVars, answerRule } = resolveClue(clue, seed);

  // Determine correct door by evaluating the resolved answer rule
  const correctDoor = determineCorrectDoor(answerRule);

  // ── Environment theming ───────────────────────────────────────────────────
  const environments = [
    'laboratory', 'library', 'server_room', 'bunker', 'observatory',
    'greenhouse', 'archive', 'control_room', 'vault', 'chapel',
  ];
  const environment = environments[roomNumber % environments.length];
  const ambientObjects = generateAmbientObjects(environment, seed);

  return {
    roomId: uuidv4(),
    roomNumber,
    clueId: clue._id,
    clueCategory: clue.category,
    clueText: text,
    flavorText: clue.flavorText,
    hints: clue.hints || [],
    resolvedVars,             // server-side only
    answerRule,               // server-side only
    correctDoor,              // server-side only — never sent to client until reveal
    difficulty,
    environment,
    ambientObjects,
    clueSeed: seed,
    timerSeconds: 30,
    doorTimerSeconds: 30,
  };
}

/**
 * Generates ambient environmental objects for storytelling.
 */
function generateAmbientObjects(environment, seed) {
  const objectSets = {
    laboratory:   ['beakers with numbered labels', 'periodic table poster', 'test tube rack', 'digital counter'],
    library:      ['books with numbered spines', 'alphabetical index cards', 'reading lamp', 'manuscript scroll'],
    server_room:  ['blinking server racks', 'binary display panel', 'cooling fan array', 'network diagram'],
    bunker:       ['military code charts', 'Morse code manual', 'survival guide', 'encrypted radio'],
    observatory:  ['star charts', 'constellation maps', 'telescope with inscriptions', 'cosmic calendar'],
    greenhouse:   ['labeled plant specimens', 'growth charts', 'soil pH meters', 'botanical sketches'],
    archive:      ['filing cabinets with codes', 'classified folders', 'pattern charts', 'cipher wheels'],
    control_room: ['monitoring screens', 'status indicators', 'alarm panels', 'operation manuals'],
    vault:        ['combination locks', 'pattern keypads', 'encrypted manifests', 'security cameras'],
    chapel:       ['stained glass patterns', 'symbolic inscriptions', 'ritual objects', 'ancient texts'],
  };

  const objects = objectSets[environment] || objectSets.laboratory;
  const count = 2 + Math.floor(seededRandom(seed + 456) * 2);
  const shuffled = [...objects].sort(() => seededRandom(seed) - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Validates a player's door choice server-side.
 */
function validateDoorChoice(room, chosenDoor) {
  return chosenDoor === room.correctDoor;
}

/**
 * Generates a full room sequence for a match.
 */
async function generateRoomSequence(playerCount, excludeClueIds = []) {
  const roomCount = Math.min(10, Math.max(5, playerCount + 2));
  const rooms = [];

  for (let i = 0; i < roomCount; i++) {
    const difficulty = Math.min(5, Math.floor(i / 2) + 1);
    const room = await generateRoom(i + 1, difficulty, excludeClueIds);
    rooms.push(room);
  }

  return rooms;
}

module.exports = {
  generateRoom,
  generateRoomSequence,
  validateDoorChoice,
  resolveClue,
  evaluateAnswerRule, // exported for testing
};
