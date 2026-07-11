/**
 * Room Generator — Phase 1
 * Supports 14 categories, difficulty 1-10, admin-controlled curves
 * LIVE door = condition TRUE, DIE door = condition FALSE
 */
const Clue = require('../models/Clue');
const GameSettings = require('../models/GameSettings');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

// ── Seeded random ─────────────────────────────────────────────────────────────
function seededRandom(seed) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

// ── Prime check ────────────────────────────────────────────────────────────────
function isPrime(n) {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i <= Math.sqrt(n); i += 2) if (n % i === 0) return false;
  return true;
}

// ── Fibonacci check ────────────────────────────────────────────────────────────
function isFibonacci(n) {
  const p = x => { const s = Math.round(Math.sqrt(x)); return s * s === x; };
  return p(5 * n * n + 4) || p(5 * n * n - 4);
}

// ── Binary helpers ─────────────────────────────────────────────────────────────
function binaryToDecimal(bin) {
  return parseInt(String(bin).replace(/[^01]/g, ''), 2);
}
function countOnes(bin) {
  return String(bin).split('').filter(b => b === '1').length;
}

// ── Caesar cipher ──────────────────────────────────────────────────────────────
function caesarShift(word, shift) {
  return word.toUpperCase().split('').map(c => {
    if (c < 'A' || c > 'Z') return c;
    return String.fromCharCode(((c.charCodeAt(0) - 65 + shift) % 26) + 65);
  }).join('');
}

// ── Color spectrum ROYGBIV ────────────────────────────────────────────────────
const SPECTRUM = ['red','orange','yellow','green','blue','indigo','violet'];
const WARM_COLORS = ['red','orange','yellow','pink','magenta'];
const COOL_COLORS = ['blue','green','indigo','violet','cyan','purple'];
const PRIMARY_COLORS = ['red','blue','yellow'];
const SECONDARY_COLORS = ['orange','green','violet','purple'];

/**
 * Master answer rule evaluator — all 14 categories
 * @param {String} answerRule - fully resolved rule string
 * @returns {Boolean|null} true=LIVE, false=DIE, null=uncertain
 */
function evaluateAnswerRule(answerRule) {
  const rule = (answerRule || '').trim().toLowerCase();

  try {
    // ════════════════════════════════════════════════════
    // NUMBER RULES
    // ════════════════════════════════════════════════════
    // even:{N}
    const evenM = rule.match(/^even:(-?\d+)$/);
    if (evenM) return parseInt(evenM[1]) % 2 === 0;

    // odd:{N}
    const oddM = rule.match(/^odd:(-?\d+)$/);
    if (oddM) return parseInt(oddM[1]) % 2 !== 0;

    // divisible_by:{X}:{Y} — is Y divisible by X?
    const divM = rule.match(/^divisible_by:(\d+):(-?\d+)$/);
    if (divM) return parseInt(divM[2]) % parseInt(divM[1]) === 0;

    // multiple_of:{X}:{Y}
    const mulM = rule.match(/^multiple_of:(\d+):(-?\d+)$/);
    if (mulM) return parseInt(mulM[2]) % parseInt(mulM[1]) === 0;

    // greater_than:{X}:{Y} — is Y > X?
    const gtM = rule.match(/^greater_than:(-?\d+):(-?\d+)$/);
    if (gtM) return parseInt(gtM[2]) > parseInt(gtM[1]);

    // less_than:{X}:{Y} — is Y < X?
    const ltM = rule.match(/^less_than:(-?\d+):(-?\d+)$/);
    if (ltM) return parseInt(ltM[2]) < parseInt(ltM[1]);

    // gte:{X}:{Y} — Y >= X
    const gteM = rule.match(/^gte:(-?\d+):(-?\d+)$/);
    if (gteM) return parseInt(gteM[2]) >= parseInt(gteM[1]);

    // lte:{X}:{Y} — Y <= X
    const lteM = rule.match(/^lte:(-?\d+):(-?\d+)$/);
    if (lteM) return parseInt(lteM[2]) <= parseInt(lteM[1]);

    // between:{LO}:{HI}:{N} — is LO <= N <= HI?
    const betM = rule.match(/^between:(-?\d+):(-?\d+):(-?\d+)$/);
    if (betM) {
      const [lo, hi, n] = [parseInt(betM[1]), parseInt(betM[2]), parseInt(betM[3])];
      return n >= lo && n <= hi;
    }

    // digit_sum:{X}:{Y} — does digit sum of Y equal X?
    const dsM = rule.match(/^digit_sum:(\d+):(\d+)$/);
    if (dsM) {
      const sum = String(dsM[2]).split('').reduce((a, d) => a + parseInt(d), 0);
      return sum === parseInt(dsM[1]);
    }

    // digit_sum_odd:{Y} — is the digit sum of Y odd?
    const dsoM = rule.match(/^digit_sum_odd:(\d+)$/);
    if (dsoM) {
      const sum = String(dsoM[1]).split('').reduce((a, d) => a + parseInt(d), 0);
      return sum % 2 !== 0;
    }

    // digit_sum_even:{Y} — is the digit sum of Y even?
    const dseM = rule.match(/^digit_sum_even:(\d+)$/);
    if (dseM) {
      const sum = String(dseM[1]).split('').reduce((a, d) => a + parseInt(d), 0);
      return sum % 2 === 0;
    }

    // digit_product:{X}:{Y}
    const dpM = rule.match(/^digit_product:(\d+):(\d+)$/);
    if (dpM) {
      const prod = String(dsM? dsM[2] : dpM[2]).split('').reduce((a, d) => a * parseInt(d), 1);
      return prod === parseInt(dpM[1]);
    }

    // digit_count:{X}:{Y} — does Y have exactly X digits?
    const dcM = rule.match(/^digit_count:(\d+):(\d+)$/);
    if (dcM) return String(dcM[2]).length === parseInt(dcM[1]);

    // is_prime:{X}
    const primeM = rule.match(/^is_prime:(\d+)$/);
    if (primeM) return isPrime(parseInt(primeM[1]));

    // is_composite:{X}
    const compM = rule.match(/^is_composite:(\d+)$/);
    if (compM) { const n = parseInt(compM[1]); return n > 1 && !isPrime(n); }

    // fibonacci:{X}
    const fibM = rule.match(/^fibonacci:(\d+)$/);
    if (fibM) return isFibonacci(parseInt(fibM[1]));

    // is_square:{X}
    const sqM = rule.match(/^is_square:(\d+)$/);
    if (sqM) { const s = Math.round(Math.sqrt(parseInt(sqM[1]))); return s * s === parseInt(sqM[1]); }

    // is_triangular:{X} — triangular numbers: 1,3,6,10,15,21...
    const triNumM = rule.match(/^is_triangular:(\d+)$/);
    if (triNumM) {
      const n = parseInt(triNumM[1]);
      const disc = 1 + 8 * n;
      const s = Math.round(Math.sqrt(disc));
      return s * s === disc && (s - 1) % 2 === 0;
    }

    // modulo:{X}:{Y}:{R} — is Y mod X equal to R?
    const modM = rule.match(/^modulo:(\d+):(\d+):(\d+)$/);
    if (modM) return parseInt(modM[2]) % parseInt(modM[1]) === parseInt(modM[3]);

    // gcd_gt:{A}:{B}:{X} — is GCD(A,B) > X?
    const gcdM = rule.match(/^gcd_gt:(\d+):(\d+):(\d+)$/);
    if (gcdM) {
      const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
      return gcd(parseInt(gcdM[1]), parseInt(gcdM[2])) > parseInt(gcdM[3]);
    }

    // sum_gt:{A}:{B}:{X} — is A+B > X?
    const sumGtM = rule.match(/^sum_gt:(\d+):(\d+):(\d+)$/);
    if (sumGtM) return parseInt(sumGtM[1]) + parseInt(sumGtM[2]) > parseInt(sumGtM[3]);

    // product_even:{A}:{B}
    const prodEvenM = rule.match(/^product_even:(\d+):(\d+)$/);
    if (prodEvenM) return (parseInt(prodEvenM[1]) * parseInt(prodEvenM[2])) % 2 === 0;

    // product_prime:{A}:{B}
    const prodPrimeM = rule.match(/^product_prime:(\d+):(\d+)$/);
    if (prodPrimeM) return isPrime(parseInt(prodPrimeM[1]) * parseInt(prodPrimeM[2]));

    // reverse_greater:{N}:{X} — is reverse of N > X?
    const revM = rule.match(/^reverse_greater:(\d+):(\d+)$/);
    if (revM) return parseInt(String(revM[1]).split('').reverse().join('')) > parseInt(revM[2]);

    // ════════════════════════════════════════════════════
    // WORD RULES
    // ════════════════════════════════════════════════════
    // contains_letter:{L}:{W}
    const clM = rule.match(/^contains_letter:([a-z]):([a-z]+)$/);
    if (clM) return clM[2].includes(clM[1]);

    // not_contains_letter:{L}:{W}
    const nclM = rule.match(/^not_contains_letter:([a-z]):([a-z]+)$/);
    if (nclM) return !nclM[2].includes(nclM[1]);

    // starts_with:{C}:{W}
    const swM = rule.match(/^starts_with:([a-z]):([a-z]+)$/);
    if (swM) return swM[2].startsWith(swM[1]);

    // ends_with:{C}:{W}
    const ewM = rule.match(/^ends_with:([a-z]):([a-z]+)$/);
    if (ewM) return ewM[2].endsWith(ewM[1]);

    // ends_vowel:{W}
    const evM = rule.match(/^ends_vowel:([a-z]+)$/);
    if (evM) return 'aeiou'.includes(evM[1].slice(-1));

    // starts_vowel:{W}
    const svM = rule.match(/^starts_vowel:([a-z]+)$/);
    if (svM) return 'aeiou'.includes(svM[1][0]);

    // length_greater:{X}:{W}
    const lgM = rule.match(/^length_greater:(\d+):([a-z]+)$/);
    if (lgM) return lgM[2].length > parseInt(lgM[1]);

    // length_equals:{X}:{W}
    const leM = rule.match(/^length_equals:(\d+):([a-z]+)$/);
    if (leM) return leM[2].length === parseInt(leM[1]);

    // length_less:{X}:{W}
    const llM = rule.match(/^length_less:(\d+):([a-z]+)$/);
    if (llM) return llM[2].length < parseInt(llM[1]);

    // palindrome:{W}
    const palM = rule.match(/^palindrome:([a-z]+)$/);
    if (palM) { const w = palM[1]; return w === w.split('').reverse().join(''); }

    // vowel_count_gt:{X}:{W}
    const vcM = rule.match(/^vowel_count_gt:(\d+):([a-z]+)$/);
    if (vcM) return [...vcM[2]].filter(c => 'aeiou'.includes(c)).length > parseInt(vcM[1]);

    // vowel_count_equals:{X}:{W}
    const vceM = rule.match(/^vowel_count_equals:(\d+):([a-z]+)$/);
    if (vceM) return [...vceM[2]].filter(c => 'aeiou'.includes(c)).length === parseInt(vceM[1]);

    // no_vowels:{W}
    const nvM = rule.match(/^no_vowels:([a-z]+)$/);
    if (nvM) return !/[aeiou]/.test(nvM[1]);

    // double_letter:{W} — has a repeated consecutive letter
    const dlM = rule.match(/^double_letter:([a-z]+)$/);
    if (dlM) return /(.)\1/.test(dlM[1]);

    // letter_count_gt:{L}:{X}:{W} — letter L appears more than X times
    const lcGtM = rule.match(/^letter_count_gt:([a-z]):(\d+):([a-z]+)$/);
    if (lcGtM) {
      const count = [...lcGtM[3]].filter(c => c === lcGtM[1]).length;
      return count > parseInt(lcGtM[2]);
    }

    // ════════════════════════════════════════════════════
    // SYMBOL RULES
    // ════════════════════════════════════════════════════
    const TRIANGLES      = ['▲','△','▽','▿'];
    const QUADRILATERALS = ['■','□','▭','▱','◻','◼','▰'];
    const CIRCLES        = ['●','○','◯','⊙','◉'];
    const ANGULAR        = ['▲','■','◆','⬡','⬟','⬠','★','△','▽','□','▭','◆','◇'];
    const FILLED         = ['▲','■','●','◆','★','▰','◼'];

    const isTriM   = rule.match(/^is_triangle:(.+)$/);
    if (isTriM)   return TRIANGLES.includes(isTriM[1]);

    const isQuadM  = rule.match(/^is_quadrilateral:(.+)$/);
    if (isQuadM)  return QUADRILATERALS.includes(isQuadM[1]);

    const isCircM  = rule.match(/^is_circle:(.+)$/);
    if (isCircM)  return CIRCLES.includes(isCircM[1]);

    const isAngM   = rule.match(/^is_angular:(.+)$/);
    if (isAngM)   return ANGULAR.includes(isAngM[1]);

    const isFilM   = rule.match(/^is_filled:(.+)$/);
    if (isFilM)   return FILLED.includes(isFilM[1]);

    const symMatchM = rule.match(/^symbol_match:(.+):(.+)$/);
    if (symMatchM) return symMatchM[1] === symMatchM[2];

    const starPtM  = rule.match(/^star_points:(\d+)$/);
    if (starPtM)  return true; // flavor only

    const symGteM  = rule.match(/^symmetry_gte:(\d+):(.+)$/);
    if (symGteM) {
      const lines = { '●': 999,'■': 4,'▲': 3,'⬡': 6,'◆': 2,'▭': 2,'△': 3,'□': 4 };
      return (lines[symGteM[2]] || 1) >= parseInt(symGteM[1]);
    }

    // ════════════════════════════════════════════════════
    // ENVIRONMENT RULES
    // ════════════════════════════════════════════════════
    const tempM = rule.match(/^temperature_safe:(-?\d+):(-?\d+)$/);
    if (tempM) return parseInt(tempM[1]) <= parseInt(tempM[2]);

    const tempAboveM = rule.match(/^temperature_above:(-?\d+):(-?\d+)$/);
    if (tempAboveM) return parseInt(tempAboveM[1]) > parseInt(tempAboveM[2]);

    const midnightM = rule.match(/^before_midnight:(\d+)$/);
    if (midnightM) { const h = parseInt(midnightM[1]); return h > 0 && h < 24; }

    const countM = rule.match(/^exact_count:(\d+):(\d+)$/);
    if (countM) return parseInt(countM[1]) === parseInt(countM[2]);

    const subPosM = rule.match(/^subtract_positive:(-?\d+):(-?\d+)$/);
    if (subPosM) return parseInt(subPosM[1]) - parseInt(subPosM[2]) > 0;

    const tileM = rule.match(/^tile_color:(.+)$/);
    if (tileM) return true;

    const northM = rule.match(/^is_north:([a-z]+)$/);
    if (northM) return northM[1] === 'north';

    const pressM = rule.match(/^pressure_safe:(\d+):(\d+)$/);
    if (pressM) return parseInt(pressM[1]) < parseInt(pressM[2]);

    // ════════════════════════════════════════════════════
    // LOGIC RULES
    // ════════════════════════════════════════════════════
    if (rule === 'modus_tollens:no')     return false;
    if (rule === 'modus_ponens:yes')     return true;
    if (rule === 'deductive_chain:yes')  return true;
    if (rule === 'disjunction:yes')      return true;
    if (rule === 'contrapositive:no')    return false;
    if (rule === 'monty_hall:switch')    return true;
    if (rule === 'biconditional:true')   return true;
    if (rule === 'biconditional:false')  return false;
    if (rule.includes('uncertain') || rule.includes('not_necessarily')) return null;
    if (rule === 'syllogism:not_necessarily') return null;
    if (rule === 'riddle:live')  return true;
    if (rule === 'riddle:die')   return false;

    // ════════════════════════════════════════════════════
    // PATTERN RULES
    // ════════════════════════════════════════════════════
    const colorCycleM = rule.match(/^color_cycle:(\d+):([a-z]+)$/);
    if (colorCycleM) {
      const cycle = ['red','green','blue'];
      return cycle[(parseInt(colorCycleM[1]) - 1) % 3] === colorCycleM[2];
    }

    const shapeCycleM = rule.match(/^shape_cycle:(\d+):(.+)$/);
    if (shapeCycleM) {
      const cycle = ['▲','●','■'];
      return cycle[(parseInt(shapeCycleM[1]) - 1) % 3] === shapeCycleM[2];
    }

    const letterCycleM = rule.match(/^letter_cycle:(\d+):([a-z])$/);
    if (letterCycleM) {
      const cycle = ['a','b','c'];
      return cycle[(parseInt(letterCycleM[1]) - 1) % 3] === letterCycleM[2];
    }

    const arithSeqM = rule.match(/^arithmetic_sequence:(-?\d+):(-?\d+):(-?\d+):(-?\d+)$/);
    if (arithSeqM) {
      const [a, b, c, d] = arithSeqM.slice(1).map(Number);
      return d === c + (b - a);
    }

    const geoSeqM = rule.match(/^geometric_sequence:(\d+):(\d+):(\d+):(\d+)$/);
    if (geoSeqM) {
      const [a, b, c, d] = geoSeqM.slice(1).map(Number);
      if (a === 0) return false;
      const r = b / a;
      return Math.abs(c * r - d) < 0.001;
    }

    const parityAltM = rule.match(/^parity_alternation:(\d+):(\d+)$/);
    if (parityAltM) {
      const posOdd = parseInt(parityAltM[1]) % 2 !== 0;
      const valOdd = parseInt(parityAltM[2]) % 2 !== 0;
      return posOdd === valOdd;
    }

    const skipM = rule.match(/^skip_pattern:(\d+):(\d+):([a-z]+)$/);
    if (skipM) {
      const isSkipped = parseInt(skipM[2]) % parseInt(skipM[1]) === 0;
      return ['skipped','empty','blank'].includes(skipM[3]) === isSkipped;
    }

    // ════════════════════════════════════════════════════
    // SOUND-SPECIFIC RULES
    // ════════════════════════════════════════════════════
    // rhythm_pattern:{N}:{B} — 3-beat cycle LOUD-soft-soft
    const rhythmM = rule.match(/^rhythm_pattern:(\d+):(loud|soft)$/);
    if (rhythmM) {
      const pos = parseInt(rhythmM[1]);
      const beat = rhythmM[2];
      const expectedLoud = (pos - 1) % 3 === 0; // position 1,4,7... = loud
      return expectedLoud === (beat === 'loud');
    }

    // higher_pitch:{A}:{B} — is A the higher pitch (A > B)?
    const higherM = rule.match(/^higher_pitch:(\d+):(\d+)$/);
    if (higherM) return parseInt(higherM[1]) > parseInt(higherM[2]);

    // interval_count:{K}:{T}:{N} — does floor(T/K) equal N?
    const intervalM = rule.match(/^interval_count:(\d+):(\d+):(\d+)$/);
    if (intervalM) {
      const k = parseInt(intervalM[1]);
      const t = parseInt(intervalM[2]);
      const n = parseInt(intervalM[3]);
      return Math.floor(t / k) === n;
    }

    // ════════════════════════════════════════════════════
    // MATH RULES
    // ════════════════════════════════════════════════════
    // calc_even:{A}:{B}:{OP}:{R} — is A OP B even? (pre-calculated R)
    const calcEvenM = rule.match(/^calc_even:(-?\d+):(-?\d+):[+\-*]:(-?\d+)$/);
    if (calcEvenM) return parseInt(calcEvenM[3]) % 2 === 0;

    // calc_prime:{R}
    const calcPrimeM = rule.match(/^calc_prime:(-?\d+)$/);
    if (calcPrimeM) return isPrime(Math.abs(parseInt(calcPrimeM[1])));

    // calc_gt:{R}:{X} — is R > X? (accepts decimals from percentage calcs)
    const calcGtM = rule.match(/^calc_gt:(-?\d+\.?\d*):(-?\d+\.?\d*)$/);
    if (calcGtM) return parseFloat(calcGtM[1]) > parseFloat(calcGtM[2]);

    // calc_divisible:{R}:{D} — is R divisible by D?
    const calcDivM = rule.match(/^calc_divisible:(-?\d+):(\d+)$/);
    if (calcDivM) return Math.abs(parseInt(calcDivM[1])) % parseInt(calcDivM[2]) === 0;

    // calc_square:{R}
    const calcSqM = rule.match(/^calc_square:(-?\d+)$/);
    if (calcSqM) { const n = Math.abs(parseInt(calcSqM[1])); const s = Math.round(Math.sqrt(n)); return s * s === n; }

    // percentage_gt:{P}:{T}:{X} — is P% of T > X?
    const pctM = rule.match(/^percentage_gt:(\d+):(\d+):(\d+)$/);
    if (pctM) return (parseInt(pctM[1]) * parseInt(pctM[2]) / 100) > parseInt(pctM[3]);

    // ════════════════════════════════════════════════════
    // BINARY RULES
    // ════════════════════════════════════════════════════
    // binary_even:{B}
    const binEvenM = rule.match(/^binary_even:([01]+)$/);
    if (binEvenM) return binaryToDecimal(binEvenM[1]) % 2 === 0;

    // binary_prime:{B}
    const binPrimeM = rule.match(/^binary_prime:([01]+)$/);
    if (binPrimeM) return isPrime(binaryToDecimal(binPrimeM[1]));

    // binary_ones_even:{B}
    const binOnesEvenM = rule.match(/^binary_ones_even:([01]+)$/);
    if (binOnesEvenM) return countOnes(binOnesEvenM[1]) % 2 === 0;

    // binary_ones_gt:{X}:{B}
    const binOnesGtM = rule.match(/^binary_ones_gt:(\d+):([01]+)$/);
    if (binOnesGtM) return countOnes(binOnesGtM[2]) > parseInt(binOnesGtM[1]);

    // binary_decimal_gt:{X}:{B}
    const binDecGtM = rule.match(/^binary_decimal_gt:(\d+):([01]+)$/);
    if (binDecGtM) return binaryToDecimal(binDecGtM[2]) > parseInt(binDecGtM[1]);

    // binary_decimal_equals:{X}:{B}
    const binDecEqM = rule.match(/^binary_decimal_equals:(\d+):([01]+)$/);
    if (binDecEqM) return binaryToDecimal(binDecEqM[2]) === parseInt(binDecEqM[1]);

    // binary_and_gt:{A}:{B}:{X} — is (A AND B) > X?
    const binAndM = rule.match(/^binary_and_gt:([01]+):([01]+):(\d+)$/);
    if (binAndM) {
      const result = binaryToDecimal(binAndM[1]) & binaryToDecimal(binAndM[2]);
      return result > parseInt(binAndM[3]);
    }

    // binary_xor_even:{A}:{B}
    const binXorM = rule.match(/^binary_xor_even:([01]+):([01]+)$/);
    if (binXorM) {
      const result = binaryToDecimal(binXorM[1]) ^ binaryToDecimal(binXorM[2]);
      return result % 2 === 0;
    }

    // ════════════════════════════════════════════════════
    // CIPHER RULES
    // ════════════════════════════════════════════════════
    // caesar_starts_vowel:{K}:{W} — does W shifted by K start with a vowel?
    const caesarSvM = rule.match(/^caesar_starts_vowel:(\d+):([a-z]+)$/);
    if (caesarSvM) {
      const shifted = caesarShift(caesarSvM[2], parseInt(caesarSvM[1]));
      return 'AEIOU'.includes(shifted[0]);
    }

    // caesar_ends_vowel:{K}:{W}
    const caesarEvM = rule.match(/^caesar_ends_vowel:(\d+):([a-z]+)$/);
    if (caesarEvM) {
      const shifted = caesarShift(caesarEvM[2], parseInt(caesarEvM[1]));
      return 'AEIOU'.includes(shifted[shifted.length - 1]);
    }

    // caesar_palindrome:{K}:{W}
    const caesarPalM = rule.match(/^caesar_palindrome:(\d+):([a-z]+)$/);
    if (caesarPalM) {
      const shifted = caesarShift(caesarPalM[2], parseInt(caesarPalM[1]));
      return shifted === shifted.split('').reverse().join('');
    }

    // caesar_longer:{K}:{W}:{X} — is shifted W longer than X?
    const caesarLenM = rule.match(/^caesar_longer:(\d+):([a-z]+):(\d+)$/);
    if (caesarLenM) return caesarLenM[2].length > parseInt(caesarLenM[3]);

    // atbash_starts_vowel:{W}
    const atbashSvM = rule.match(/^atbash_starts_vowel:([a-z]+)$/);
    if (atbashSvM) {
      const atbash = atbashSvM[1].split('').map(c => String.fromCharCode(122 - c.charCodeAt(0) + 97)).join('');
      return 'aeiou'.includes(atbash[0]);
    }

    // rot13_palindrome:{W}
    const rot13M = rule.match(/^rot13_palindrome:([a-z]+)$/);
    if (rot13M) {
      const rot = rot13M[1].split('').map(c => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97)).join('');
      return rot === rot.split('').reverse().join('');
    }

    // ════════════════════════════════════════════════════
    // SPATIAL RULES
    // ════════════════════════════════════════════════════
    // sides_gt:{S}:{X} — does shape with S sides have > X sides?
    const sidesGtM = rule.match(/^sides_gt:(\d+):(\d+)$/);
    if (sidesGtM) return parseInt(sidesGtM[1]) > parseInt(sidesGtM[2]);

    // area_square_gt:{A}:{X} — is A² > X?
    const areaSqM = rule.match(/^area_square_gt:(\d+):(\d+)$/);
    if (areaSqM) return parseInt(areaSqM[1]) * parseInt(areaSqM[1]) > parseInt(areaSqM[2]);

    // perimeter_rect_even:{W}:{H} — is 2(W+H) even?
    const perimM = rule.match(/^perimeter_rect_even:(\d+):(\d+)$/);
    if (perimM) return (2 * (parseInt(perimM[1]) + parseInt(perimM[2]))) % 2 === 0;

    // faces_gt:{SHAPE}:{X}
    const facesM = rule.match(/^faces_gt:([a-z_]+):(\d+)$/);
    if (facesM) {
      const faceCount = {cube:6,tetrahedron:4,octahedron:8,dodecahedron:12,icosahedron:20,sphere:1,cylinder:3,cone:2,pyramid:5};
      return (faceCount[facesM[1]] || 0) > parseInt(facesM[2]);
    }

    // angle_sum_gt:{N}:{X} — is sum of interior angles of N-gon > X?
    const angleSumM = rule.match(/^angle_sum_gt:(\d+):(\d+)$/);
    if (angleSumM) return (parseInt(angleSumM[1]) - 2) * 180 > parseInt(angleSumM[2]);

    // ════════════════════════════════════════════════════
    // TIME RULES
    // ════════════════════════════════════════════════════
    // add_minutes_before:{H}:{M}:{T}:{LH} — is H:M + T minutes before LH:00?
    const addMinM = rule.match(/^add_minutes_before:(\d+):(\d+):(\d+):(\d+)$/);
    if (addMinM) {
      const totalMins = parseInt(addMinM[1]) * 60 + parseInt(addMinM[2]) + parseInt(addMinM[3]);
      const limitMins = parseInt(addMinM[4]) * 60;
      return totalMins % (24 * 60) < limitMins;
    }

    // duration_even:{H1}:{M1}:{H2}:{M2} — is duration in minutes even?
    const durEvenM = rule.match(/^duration_even:(\d+):(\d+):(\d+):(\d+)$/);
    if (durEvenM) {
      const start = parseInt(durEvenM[1]) * 60 + parseInt(durEvenM[2]);
      const end   = parseInt(durEvenM[3]) * 60 + parseInt(durEvenM[4]);
      const dur   = ((end - start) + 24 * 60) % (24 * 60);
      return dur % 2 === 0;
    }

    // hour_prime:{H}
    const hourPrimeM = rule.match(/^hour_prime:(\d+)$/);
    if (hourPrimeM) return isPrime(parseInt(hourPrimeM[1]));

    // minute_gt:{M}:{X}
    const minGtM = rule.match(/^minute_gt:(\d+):(\d+)$/);
    if (minGtM) return parseInt(minGtM[1]) > parseInt(minGtM[2]);

    // time_before:{H}:{M}:{LH}:{LM}
    const timeBeforeM = rule.match(/^time_before:(\d+):(\d+):(\d+):(\d+)$/);
    if (timeBeforeM) {
      const t   = parseInt(timeBeforeM[1]) * 60 + parseInt(timeBeforeM[2]);
      const lim = parseInt(timeBeforeM[3]) * 60 + parseInt(timeBeforeM[4]);
      return t < lim;
    }

    // ════════════════════════════════════════════════════
    // COLOR RULES
    // ════════════════════════════════════════════════════
    // is_warm:{C}
    const warmM = rule.match(/^is_warm:([a-z]+)$/);
    if (warmM) return WARM_COLORS.includes(warmM[1]);

    // is_cool:{C}
    const coolM = rule.match(/^is_cool:([a-z]+)$/);
    if (coolM) return COOL_COLORS.includes(coolM[1]);

    // is_primary:{C}
    const primaryM = rule.match(/^is_primary:([a-z]+)$/);
    if (primaryM) return PRIMARY_COLORS.includes(primaryM[1]);

    // is_secondary:{C}
    const secM = rule.match(/^is_secondary:([a-z]+)$/);
    if (secM) return SECONDARY_COLORS.includes(secM[1]);

    // spectrum_before:{C}:{REF}
    const specM = rule.match(/^spectrum_before:([a-z]+):([a-z]+)$/);
    if (specM) {
      const i1 = SPECTRUM.indexOf(specM[1]);
      const i2 = SPECTRUM.indexOf(specM[2]);
      return i1 !== -1 && i2 !== -1 && i1 < i2;
    }

    // rgb_sum_even:{R}:{G}:{B}
    const rgbM = rule.match(/^rgb_sum_even:(\d+):(\d+):(\d+)$/);
    if (rgbM) return (parseInt(rgbM[1]) + parseInt(rgbM[2]) + parseInt(rgbM[3])) % 2 === 0;

    // rgb_max_channel:{R}:{G}:{B}:{C} — is C the dominant channel?
    const rgbMaxM = rule.match(/^rgb_max_channel:(\d+):(\d+):(\d+):([rgb])$/);
    if (rgbMaxM) {
      const [r, g, b] = [parseInt(rgbMaxM[1]), parseInt(rgbMaxM[2]), parseInt(rgbMaxM[3])];
      const ch = rgbMaxM[4];
      if (ch === 'r') return r >= g && r >= b;
      if (ch === 'g') return g >= r && g >= b;
      return b >= r && b >= g;
    }

    // Fallback
    logger.warn(`Unknown answerRule: "${answerRule}" — defaulting LIVE`);
    return true;

  } catch (err) {
    logger.error(`evaluateAnswerRule error for "${answerRule}": ${err.message}`);
    return true;
  }
}

/**
 * Determine correct door from resolved answer rule
 */
function determineCorrectDoor(answerRule) {
  const result = evaluateAnswerRule(answerRule);
  if (result === null) return Math.random() > 0.5 ? 'LIVE' : 'DIE';
  return result ? 'LIVE' : 'DIE';
}

/**
 * Resolve all {VAR} placeholders in template and answerRule
 */
function resolveClue(clue, seed) {
  const resolvedVars = {};
  let text = clue.template;
  let answerRule = clue.answerRule;

  (clue.variables || []).forEach((variable, i) => {
    let value;
    const rand = seededRandom(seed + i * 137);

    if (variable.type === 'number') {
      value = Math.floor(rand * (variable.max - variable.min + 1)) + variable.min;
    } else if (variable.type === 'letter') {
      value = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(rand * 26)];
    } else if (variable.type === 'choice' || variable.type === 'word') {
      const opts = variable.options || [];
      value = opts.length > 0 ? opts[Math.floor(rand * opts.length)] : '?';
    } else if (variable.type === 'symbol') {
      value = ['★','▲','●','■','◆','✦','⬟','⬡'][Math.floor(rand * 8)];
    } else {
      value = '?';
    }

    resolvedVars[variable.name] = value;
    const pat = new RegExp(`\\{${variable.name}\\}`, 'g');
    text = text.replace(pat, value);
    answerRule = answerRule.replace(pat, String(value).toLowerCase());
  });

  // Auto-embed bare parity rules
  const bare = answerRule.trim().toLowerCase();
  if (bare === 'even' || bare === 'odd') {
    const numVar = (clue.variables || []).find(v => v.type === 'number');
    if (numVar && resolvedVars[numVar.name] !== undefined) {
      answerRule = `${bare}:${resolvedVars[numVar.name]}`;
    }
  }

  return { text, resolvedVars, answerRule };
}

/**
 * Get difficulty levels for rooms based on curve and room count
 */
function getDifficultyLevels(curve, roomCount) {
  const baseLevels = curve?.levels || [1,2,3,4,5,6,7,8,9,10];
  if (roomCount === baseLevels.length) return baseLevels;

  // Proportionally sample from the curve
  const result = [];
  for (let i = 0; i < roomCount; i++) {
    const idx = Math.floor((i / roomCount) * baseLevels.length);
    result.push(baseLevels[idx]);
  }
  return result;
}

/**
 * Generate a single room
 */
async function generateRoom(roomNumber, difficulty, excludeClueIds = []) {
  const seed = Date.now() + roomNumber * 7919;

  let clues = await Clue.find({
    isActive: true,
    difficulty,
    _id: { $nin: excludeClueIds },
  }).limit(30);

  if (clues.length === 0) {
    // Fallback: adjacent difficulty
    clues = await Clue.find({
      isActive: true,
      difficulty: { $gte: Math.max(1, difficulty - 1), $lte: Math.min(10, difficulty + 1) },
      _id: { $nin: excludeClueIds },
    }).limit(20);
  }

  if (clues.length === 0) {
    clues = await Clue.find({ isActive: true }).limit(10);
    if (!clues.length) throw new Error('No clues in database. Run npm run seed first.');
  }

  const clue = clues[Math.floor(seededRandom(seed) * clues.length)];
  const { text, resolvedVars, answerRule } = resolveClue(clue, seed);
  const correctDoor = determineCorrectDoor(answerRule);

  const environments = ['laboratory','library','server_room','bunker','observatory','greenhouse','archive','control_room','vault','chapel'];
  const environment = environments[roomNumber % environments.length];

  return {
    roomId: uuidv4(),
    roomNumber,
    clueId: clue._id,
    clueCategory: clue.category,
    clueText: text,
    flavorText: clue.flavorText,
    hints: clue.hints || [],
    resolvedVars,       // server-side only
    answerRule,         // server-side only
    correctDoor,        // server-side only — NEVER sent to client until reveal
    difficulty,
    environment,
    ambientObjects: generateAmbientObjects(environment, seed),
    timerSeconds: 30,
    doorTimerSeconds: 30,
  };
}

function generateAmbientObjects(environment, seed) {
  const sets = {
    laboratory:   ['beakers with numbered labels','periodic table poster','test tube rack','digital counter'],
    library:      ['books with numbered spines','alphabetical index cards','reading lamp','manuscript scroll'],
    server_room:  ['blinking server racks','binary display panel','cooling fan array','network diagram'],
    bunker:       ['military code charts','Morse code manual','survival guide','encrypted radio'],
    observatory:  ['star charts','constellation maps','telescope with inscriptions','cosmic calendar'],
    greenhouse:   ['labeled plant specimens','growth charts','soil pH meters','botanical sketches'],
    archive:      ['filing cabinets with codes','classified folders','pattern charts','cipher wheels'],
    control_room: ['monitoring screens','status indicators','alarm panels','operation manuals'],
    vault:        ['combination locks','pattern keypads','encrypted manifests','security cameras'],
    chapel:       ['stained glass patterns','symbolic inscriptions','ritual objects','ancient texts'],
  };
  const objs = sets[environment] || sets.laboratory;
  const count = 2 + Math.floor(seededRandom(seed + 456) * 2);
  return [...objs].sort(() => seededRandom(seed) - 0.5).slice(0, count);
}

/**
 * Generate full room sequence using admin difficulty curve
 */
async function generateRoomSequence(playerCount, excludeClueIds = [], curveConfig = null) {
  const settings = await GameSettings.getSingleton();
  const roomCount = settings.roomsPerPlayerCount?.get(String(playerCount)) || Math.min(10, Math.max(5, playerCount + 2));

  // Find active curve
  let curve = null;
  if (curveConfig) {
    curve = settings.difficultyCurves.find(c => c.name === curveConfig);
  }
  if (!curve) {
    curve = settings.difficultyCurves.find(c => c.isDefault) || settings.difficultyCurves[0];
  }

  const difficultyLevels = getDifficultyLevels(curve, roomCount);
  const rooms = [];

  for (let i = 0; i < roomCount; i++) {
    const room = await generateRoom(i + 1, difficultyLevels[i] || 1, excludeClueIds);
    rooms.push(room);
  }

  return rooms;
}

function validateDoorChoice(room, chosenDoor) {
  return chosenDoor === room.correctDoor;
}

module.exports = {
  generateRoom,
  generateRoomSequence,
  validateDoorChoice,
  resolveClue,
  evaluateAnswerRule,
  determineCorrectDoor,
};
