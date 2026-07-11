/**
 * Mega Clue Generator — Phase 1
 * Generates 2,870 unique clues: 14 categories × 10 difficulty levels
 * D1:25 D2:24 D3:23 D4:22 D5:21 D6:20 D7:19 D8:18 D9:17 D10:16 = 205 per category
 *
 * Run: node utils/generateMegaClues.js > clues_mega.json
 */

const { randomUUID } = require('crypto');
const uid = () => randomUUID();

// ── hint helper ────────────────────────────────────────────────────────────────
// D1-3: 2 hints, D4-6: 1 hint, D7-10: 0 hints
function h(d, h1, h2) {
  if (d <= 3) return [h1, h2].filter(Boolean);
  if (d <= 6) return [h1].filter(Boolean);
  return [];
}

// ── flavour banks ──────────────────────────────────────────────────────────────
const F = {
  math:  ['Equations fill a whiteboard.','A chalkboard is covered in calculations.','A calculator display blinks nearby.','Worksheets litter the floor.','A tutor\'s desk is covered in numbers.','Algebra books are piled high.','Numbers spiral across the ceiling.','Formula sheets hang from the walls.','A math competition trophy sits on a shelf.','Diagrams and graphs cover every surface.'],
  bin:   ['Binary code streams down a screen.','Server racks blink with data.','A terminal shows a binary dump.','Circuit boards line the walls.','LED panels show 0s and 1s.','A coder\'s notebook is open.','Hex dumps are printed on the walls.','A punch card collection fills a cabinet.','Logic gate diagrams are everywhere.','A retro computer boots slowly.'],
  ciph:  ['A cipher wheel sits on the desk.','Coded messages cover a corkboard.','Spy novels line the shelves.','A decoder ring is left on the table.','Encrypted telegrams are pinned up.','A cryptographer\'s toolkit is open.','Coded diaries fill a bookshelf.','Secret society symbols are carved in wood.','A wartime codebook is left open.','Radio intercept transcripts are scattered.'],
  spat:  ['Geometric models fill the shelves.','A drafting board holds unfinished blueprints.','Origami shapes dangle from the ceiling.','A 3D printer hums in the corner.','Architectural models cover the tables.','Shape-recognition posters cover the walls.','A geometer\'s toolkit is laid out.','Mathematical sculptures are on display.','Tessellation patterns tile the floor.','A perspective drawing kit is open.'],
  time:  ['Clocks of every kind tick on the walls.','A watchmaker\'s bench is covered in gears.','A grandfather clock chimes in the corner.','Hourglasses of different sizes are displayed.','A flight schedule board shows departures.','Time zone maps cover every wall.','An atomic clock displays precise time.','A sundial is mounted in the centre.','Calendars from different years are pinned up.','A digital stopwatch blinks on the desk.'],
  col:   ['Paint swatches cover every surface.','A painter\'s palette is left drying.','Colour theory books are stacked nearby.','Prismatic light splits across the room.','A rainbow is projected on the wall.','A designer\'s mood board hangs above.','Pantone chips are scattered on the floor.','A kaleidoscope viewer sits on the shelf.','Art school notes mention hue and chroma.','A colour wheel diagram dominates the wall.'],
  rdl:   ['Ancient riddle scrolls line the shelves.','A sphinx statue stares from the corner.','Riddle books are dog-eared everywhere.','A jester\'s hat hangs by the door.','Puzzle boxes are stacked in the corner.','A philosopher\'s chair is facing you.','Engraved question marks decorate the walls.','A labyrinth map is carved into the floor.','Lateral thinking exercises are pinned up.','A oracle\'s mask is displayed on the wall.'],
};

// ════════════════════════════════════════════════════════════════════
// NUMBER CLUES  (205)
// ════════════════════════════════════════════════════════════════════
function numberClues() {
  const out = [];
  // D1 (25) — even/odd/comparison
  const d1Templates = [
    ['Only even numbers survive. The code is {X}.',                              'even:{X}',              [{n:'X',t:'n',lo:10,hi:20}],  1],
    ['Even numbers walk free. Your number is {X}.',                              'even:{X}',              [{n:'X',t:'n',lo:10,hi:20}],  1],
    ['The gate opens for even numbers. The lock reads {X}.',                     'even:{X}',              [{n:'X',t:'n',lo:10,hi:20}],  1],
    ['Odd numbers are eliminated. The counter shows {X}.',                       'odd:{X}',               [{n:'X',t:'n',lo:10,hi:20}],  1],
    ['Odd numbers walk free. The sequence continues: {X}.',                      'odd:{X}',               [{n:'X',t:'n',lo:10,hi:20}],  1],
    ['Numbers greater than {X} survive. The counter shows {Y}.',                 'greater_than:{X}:{Y}',  [{n:'X',t:'n',lo:5,hi:15},{n:'Y',t:'n',lo:1,hi:20}], 1],
    ['Numbers less than {X} escape. The keypad shows {Y}.',                      'less_than:{X}:{Y}',     [{n:'X',t:'n',lo:5,hi:15},{n:'Y',t:'n',lo:1,hi:20}], 1],
    ['The exit code must be even. You have {X}.',                                'even:{X}',              [{n:'X',t:'n',lo:10,hi:20}],  1],
    ['Parity check: even survives. Reading: {X}.',                               'even:{X}',              [{n:'X',t:'n',lo:10,hi:20}],  1],
    ['The system accepts only odd inputs. Input: {X}.',                          'odd:{X}',               [{n:'X',t:'n',lo:10,hi:20}],  1],
    ['Green light for numbers above {X}. Display shows {Y}.',                    'greater_than:{X}:{Y}',  [{n:'X',t:'n',lo:5,hi:15},{n:'Y',t:'n',lo:1,hi:20}], 1],
    ['Numbers at or below {X} are safe. The gauge reads {Y}.',                   'lte:{X}:{Y}',           [{n:'X',t:'n',lo:5,hi:15},{n:'Y',t:'n',lo:1,hi:20}], 1],
    ['Only numbers strictly above {X} proceed. The value is {Y}.',               'greater_than:{X}:{Y}',  [{n:'X',t:'n',lo:5,hi:15},{n:'Y',t:'n',lo:1,hi:20}], 1],
    ['The sensor rejects even numbers. Signal reads {X}.',                       'odd:{X}',               [{n:'X',t:'n',lo:10,hi:20}],  1],
    ['Even numbers trigger the alarm. The pin is {X}.',                          'odd:{X}',               [{n:'X',t:'n',lo:10,hi:20}],  1],
    ['Numbers between {A} and {B} survive. Your number is {X}.',                 'between:{A}:{B}:{X}',   [{n:'A',t:'n',lo:2,hi:8},{n:'B',t:'n',lo:12,hi:18},{n:'X',t:'n',lo:1,hi:20}], 1],
    ['Numbers divisible by 2 escape. The code is {X}.',                          'even:{X}',              [{n:'X',t:'n',lo:10,hi:20}],  1],
    ['Odd numbers unlock the exit. The count is {X}.',                           'odd:{X}',               [{n:'X',t:'n',lo:10,hi:20}],  1],
    ['The door sensor reads {X}. Values under {Y} survive.',                     'less_than:{Y}:{X}',     [{n:'X',t:'n',lo:1,hi:20},{n:'Y',t:'n',lo:10,hi:20}], 1],
    ['Numbers exactly equal to {X} are lethal. The input is {Y}.',              'greater_than:{X}:{Y}',  [{n:'X',t:'n',lo:5,hi:15},{n:'Y',t:'n',lo:1,hi:20}], 1],
    ['Even numbers are the survivors. The display shows {X}.',                   'even:{X}',              [{n:'X',t:'n',lo:10,hi:20}],  1],
    ['The vault only opens for odd numbers. Code: {X}.',                         'odd:{X}',               [{n:'X',t:'n',lo:10,hi:20}],  1],
    ['Numbers at least {X} are safe. The meter reads {Y}.',                      'gte:{X}:{Y}',           [{n:'X',t:'n',lo:5,hi:15},{n:'Y',t:'n',lo:1,hi:20}], 1],
    ['The threshold is {X}. Numbers above it survive. Value: {Y}.',             'greater_than:{X}:{Y}',  [{n:'X',t:'n',lo:5,hi:15},{n:'Y',t:'n',lo:1,hi:20}], 1],
    ['Numbers below {X} are eliminated. The reading is {Y}.',                   'gte:{X}:{Y}',           [{n:'X',t:'n',lo:5,hi:15},{n:'Y',t:'n',lo:1,hi:20}], 1],
  ].map(([tmpl, rule, vars, d], i) => ({
    category:'number', template:tmpl, answerRule:rule, difficulty:d,
    flavorText:['A wall of glowing sequences.','Number displays line the walls.','Binary patterns cover the ceiling.','A neon counter ticks.','An old abacus is rearranged.','LED panels blink.','Chalk-filled blackboard.','A mechanical counter hums.','Number tiles are scattered.','A glowing number terminal.','Punch cards hang on hooks.','Ticker tape spills over the desk.','A graph plots recent values.','A scoreboard shows tallies.','Neon digits pulse in sequence.','A number spiral fills the floor.','A digit display pulses.','Numbers etched into stone.','An analogue dial points to a value.','A flip-board shows numbers.','Sequence charts hang on the wall.','A digital odometer ticks.','Numbered vaults line the corridor.','A number matrix covers the ceiling.','Barcode labels on every surface.'][i % 25],
    hints: h(d, 'Even numbers divide by 2 perfectly.', 'Check the last digit — 0,2,4,6,8 = even.'),
    variables: vars.map(v => ({ name:v.n, type:'number', min:v.lo, max:v.hi, options:[] })),
  }));
  out.push(...d1Templates);

  // D2 (24) — divisibility
  const d2 = [
    ['Numbers divisible by {X} escape. The lock reads {Y}.',        'divisible_by:{X}:{Y}', 2],
    ['Multiples of {X} are safe. The door number is {Y}.',          'multiple_of:{X}:{Y}',  2],
    ['The code must be divisible by {X}. Your value is {Y}.',       'divisible_by:{X}:{Y}', 2],
    ['Only multiples of {X} unlock the gate. The pin is {Y}.',      'multiple_of:{X}:{Y}',  2],
    ['The lock accepts numbers divisible by {X}. You have {Y}.',    'divisible_by:{X}:{Y}', 2],
    ['Numbers that divide evenly by {X} survive. Input: {Y}.',      'divisible_by:{X}:{Y}', 2],
    ['The key number is a multiple of {X}. Check {Y}.',             'multiple_of:{X}:{Y}',  2],
    ['Values divisible by {X} pass the filter. Current: {Y}.',      'divisible_by:{X}:{Y}', 2],
    ['The scanner checks divisibility by {X}. Reading: {Y}.',       'divisible_by:{X}:{Y}', 2],
    ['Multiples of {X} trigger escape. The display shows {Y}.',     'multiple_of:{X}:{Y}',  2],
    ['The code {Y} must divide by {X} without remainder.',          'divisible_by:{X}:{Y}', 2],
    ['Numbers that pass: must be divisible by {X}. Yours: {Y}.',   'divisible_by:{X}:{Y}', 2],
    ['The door opens for multiples of {X}. Counter shows {Y}.',     'multiple_of:{X}:{Y}',  2],
    ['Filter rule: divisible by {X}. The access code is {Y}.',      'divisible_by:{X}:{Y}', 2],
    ['Survival check: Is {Y} in the {X} times table?',              'multiple_of:{X}:{Y}',  2],
    ['Numbers in the {X} times table escape. Value: {Y}.',          'multiple_of:{X}:{Y}',  2],
    ['Only numbers with no remainder when divided by {X}. Check {Y}.', 'divisible_by:{X}:{Y}', 2],
    ['The cipher key requires divisibility by {X}. Entry: {Y}.',    'divisible_by:{X}:{Y}', 2],
    ['The exit sequence demands a multiple of {X}. You have {Y}.',  'multiple_of:{X}:{Y}',  2],
    ['The computer accepts {Y} only if it divides by {X}.',         'divisible_by:{X}:{Y}', 2],
    ['Checkpoint rule: {Y} must be a multiple of {X}.',             'multiple_of:{X}:{Y}',  2],
    ['The vault code divides by {X}. Attempting {Y}.',              'divisible_by:{X}:{Y}', 2],
    ['Numbers in the sequence of {X}s survive. Is {Y} one?',       'multiple_of:{X}:{Y}',  2],
    ['Division test by {X}. Your number: {Y}.',                     'divisible_by:{X}:{Y}', 2],
  ].map(([t, r, d]) => ({
    category:'number', template:t, answerRule:r, difficulty:d,
    flavorText:'Mathematical equations cover the walls.',
    hints: h(d, 'Divisible = divides with no remainder.', `Divide {Y} by {X}. If the result is whole, it qualifies.`),
    variables: [{ name:'X', type:'number', min:2, max:9, options:[] }, { name:'Y', type:'number', min:10, max:99, options:[] }],
  }));
  out.push(...d2);

  // D3 (23) — digit sum / digit count
  const d3 = [
    ['The sum of digits must equal {X}. The code is {Y}.',           'digit_sum:{X}:{Y}', 3],
    ['Add all digits of {Y}. If the total is {X}, you escape.',      'digit_sum:{X}:{Y}', 3],
    ['Digit sum check: {Y} must sum to {X}.',                        'digit_sum:{X}:{Y}', 3],
    ['The code {Y} has a digit sum. It must equal {X}.',             'digit_sum:{X}:{Y}', 3],
    ['Every digit of {Y} added together must reach {X}.',            'digit_sum:{X}:{Y}', 3],
    ['The entry {Y} survives only if its digits sum to {X}.',        'digit_sum:{X}:{Y}', 3],
    ['Numerology gate: digit sum of {Y} must be {X}.',              'digit_sum:{X}:{Y}', 3],
    ['Cross-sum verification: {Y} → target sum is {X}.',            'digit_sum:{X}:{Y}', 3],
    ['The digital root test: sum of digits of {Y} equals {X}?',     'digit_sum:{X}:{Y}', 3],
    ['The code {Y} must have a digit sum divisible by {X}.',         'divisible_by:{X}:{Y}', 3],
    ['Count the digits of {Y}. Exactly {X} digits means survival.', 'digit_count:{X}:{Y}', 3],
    ['The number {Y} must contain exactly {X} digits.',             'digit_count:{X}:{Y}', 3],
    ['Digit length check: {Y} must be a {X}-digit number.',         'digit_count:{X}:{Y}', 3],
    ['The access pin must have {X} digits. You have {Y}.',           'digit_count:{X}:{Y}', 3],
    ['Numbers with exactly {X} digits survive. Yours: {Y}.',        'digit_count:{X}:{Y}', 3],
    ['The safe opens for {X}-digit numbers only. Try {Y}.',         'digit_count:{X}:{Y}', 3],
    ['Length check: {Y} must be exactly {X} digits long.',          'digit_count:{X}:{Y}', 3],
    ['Digit sum of {Y} must be odd. Check: sum = ?',                'digit_sum_odd:{Y}', 3],
    ['Digit sum of {Y} must be even. Check carefully.',             'digit_sum_even:{Y}', 3],
    ['The product of digits of {Y} must equal {X}.',                'digit_product:{X}:{Y}', 3],
    ['Multiply every digit of {Y}. If product equals {X}, live.',   'digit_product:{X}:{Y}', 3],
    ['Digit product verification: {Y} × digits must total {X}.',    'digit_product:{X}:{Y}', 3],
    ['Every digit of {Y} multiplied together gives {X} to survive.','digit_product:{X}:{Y}', 3],
  ].map(([t, r, d]) => ({
    category:'number', template:t, answerRule:r, difficulty:d,
    flavorText:'A calculator display flickers on the wall.',
    hints: h(d, 'Add each digit separately, not the whole number.', 'e.g. 342 → 3+4+2 = 9.'),
    variables: [
      { name:'X', type:'number', min:3, max:18, options:[] },
      { name:'Y', type:'number', min:100, max:9999, options:[] },
    ],
  }));
  out.push(...d3);

  // D4 (22) — prime / composite
  const d4 = [
    ['Prime numbers unlock the exit. You hold {X}.',             'is_prime:{X}', 4],
    ['The door opens only for prime numbers. Your key: {X}.',    'is_prime:{X}', 4],
    ['Only primes survive here. Your number is {X}.',            'is_prime:{X}', 4],
    ['Is {X} prime? Only primes escape.',                        'is_prime:{X}', 4],
    ['The cipher requires a prime number. You have {X}.',        'is_prime:{X}', 4],
    ['Composite numbers are eliminated. Check {X}.',             'is_composite:{X}', 4],
    ['The machine rejects primes. Your code: {X}.',              'is_composite:{X}', 4],
    ['Non-prime numbers escape. Is {X} prime?',                  'is_composite:{X}', 4],
    ['The lock wants a composite. You have {X}.',                'is_composite:{X}', 4],
    ['Composite numbers unlock the door. Your value: {X}.',      'is_composite:{X}', 4],
    ['Primes are the only survivors. Yours: {X}.',               'is_prime:{X}', 4],
    ['The gate requires a number with exactly 2 divisors. Check {X}.', 'is_prime:{X}', 4],
    ['Indivisible numbers live. Your number: {X}.',              'is_prime:{X}', 4],
    ['A prime is a number divisible only by 1 and itself. Is {X} prime?', 'is_prime:{X}', 4],
    ['The system only accepts primes. Code attempt: {X}.',       'is_prime:{X}', 4],
    ['Numbers with more than 2 divisors escape. Your value: {X}.', 'is_composite:{X}', 4],
    ['Only composite numbers pass. Check if {X} qualifies.',     'is_composite:{X}', 4],
    ['The prime detector flashes. Your number: {X}.',            'is_prime:{X}', 4],
    ['The filter rejects composites. Entry number: {X}.',        'is_prime:{X}', 4],
    ['The equation requires a prime factor. Base number: {X}.',  'is_prime:{X}', 4],
    ['The security check: primes allowed. Number: {X}.',         'is_prime:{X}', 4],
    ['Numbers that cannot be broken down survive. Test: {X}.',   'is_prime:{X}', 4],
  ].map(([t, r, d]) => ({
    category:'number', template:t, answerRule:r, difficulty:d,
    flavorText:'A prime number spiral is drawn on the floor.',
    hints: h(d, 'A prime has exactly 2 divisors: 1 and itself.', 'Test dividing by 2,3,5,7 up to √X.'),
    variables: [{ name:'X', type:'number', min:2, max:97, options:[] }],
  }));
  out.push(...d4);

  // D5 (21) — Fibonacci / triangular / square
  const d5 = [
    ['The Fibonacci sequence holds truth. Is {X} in it?',         'fibonacci:{X}', 5],
    ['Only Fibonacci numbers escape. Your number: {X}.',           'fibonacci:{X}', 5],
    ['The golden ratio key: is {X} a Fibonacci number?',           'fibonacci:{X}', 5],
    ['Fibonacci or die. Check if {X} belongs.',                    'fibonacci:{X}', 5],
    ['The spiral lock opens for Fibonacci numbers. Try {X}.',      'fibonacci:{X}', 5],
    ['Perfect squares unlock the gate. Is {X} a perfect square?', 'is_square:{X}', 5],
    ['Only square numbers survive. Is {X} a perfect square?',      'is_square:{X}', 5],
    ['The quadratic gate: {X} must be a perfect square.',          'is_square:{X}', 5],
    ['A number times itself equals {X}. True or false?',           'is_square:{X}', 5],
    ['Square numbers pass. Is {X} the square of an integer?',      'is_square:{X}', 5],
    ['Triangular numbers escape. Is {X} triangular?',              'is_triangular:{X}', 5],
    ['The triangular number test: does {X} qualify?',              'is_triangular:{X}', 5],
    ['Triangular numbers: 1,3,6,10,15… Is {X} in the list?',      'is_triangular:{X}', 5],
    ['Only triangular numbers survive. Test: {X}.',                'is_triangular:{X}', 5],
    ['The pyramid lock needs a triangular number. You have {X}.',  'is_triangular:{X}', 5],
    ['Non-Fibonacci numbers are eliminated. Is {X} Fibonacci?',    'fibonacci:{X}', 5],
    ['The sequence 1,1,2,3,5,8,13,21... continues. Is {X} next?', 'fibonacci:{X}', 5],
    ['Square roots that are whole numbers unlock the door. Test {X}.', 'is_square:{X}', 5],
    ['Numbers whose square root is an integer escape. Check {X}.', 'is_square:{X}', 5],
    ['The sum of consecutive integers forms triangular numbers. Is {X} one?', 'is_triangular:{X}', 5],
    ['Triangular arrangement numbers survive. Is {X} triangular?', 'is_triangular:{X}', 5],
  ].map(([t, r, d]) => ({
    category:'number', template:t, answerRule:r, difficulty:d,
    flavorText:'Spiraling patterns decorate every surface.',
    hints: h(d, 'Fibonacci: 1,1,2,3,5,8,13,21,34,55,89,144…', 'Perfect squares: 1,4,9,16,25,36,49,64,81,100…'),
    variables: [{ name:'X', type:'number', min:1, max:233, options:[] }],
  }));
  out.push(...d5);

  // D6 (20) — modulo
  const d6 = [
    ['The code {Y} modulo {X} must equal {R}.',                   'modulo:{X}:{Y}:{R}', 6],
    ['{Y} mod {X} = {R} means survival.',                         'modulo:{X}:{Y}:{R}', 6],
    ['Modular arithmetic gate: {Y} % {X} must be {R}.',           'modulo:{X}:{Y}:{R}', 6],
    ['The remainder of {Y} divided by {X} must be {R}.',          'modulo:{X}:{Y}:{R}', 6],
    ['Clock arithmetic check: {Y} mod {X} equals {R}?',          'modulo:{X}:{Y}:{R}', 6],
    ['Residue system: {Y} ≡ {R} (mod {X}). True?',               'modulo:{X}:{Y}:{R}', 6],
    ['The modular filter: {Y} mod {X} = {R} passes.',             'modulo:{X}:{Y}:{R}', 6],
    ['Congruence check: {Y} is congruent to {R} modulo {X}?',     'modulo:{X}:{Y}:{R}', 6],
    ['The cyclic key: {Y} mod {X} should give {R}.',              'modulo:{X}:{Y}:{R}', 6],
    ['Modulus gate: does {Y} leave remainder {R} when divided by {X}?', 'modulo:{X}:{Y}:{R}', 6],
    ['The number {Y} divided by {X} leaves remainder {R}. Survive?', 'modulo:{X}:{Y}:{R}', 6],
    ['When {Y} is divided by {X}, the leftover is {R}. Correct?', 'modulo:{X}:{Y}:{R}', 6],
    ['The residue of {Y} (mod {X}) must match {R}.',              'modulo:{X}:{Y}:{R}', 6],
    ['Modulo system check: {Y} mod {X} → target {R}.',           'modulo:{X}:{Y}:{R}', 6],
    ['The escape code satisfies {Y} ≡ {R} mod {X}.',             'modulo:{X}:{Y}:{R}', 6],
    ['Number theory gate: {Y} mod {X} produces {R} to pass.',    'modulo:{X}:{Y}:{R}', 6],
    ['Cyclic residue test: {Y} modulo {X} is {R}?',              'modulo:{X}:{Y}:{R}', 6],
    ['The lock uses clock arithmetic: {Y} mod {X} = {R}.',        'modulo:{X}:{Y}:{R}', 6],
    ['Abstract algebra checkpoint: {Y} mod {X} ≡ {R}?',          'modulo:{X}:{Y}:{R}', 6],
    ['Cyclic group entry: {Y} modulo {X} is exactly {R}.',        'modulo:{X}:{Y}:{R}', 6],
  ].map(([t, r, d]) => ({
    category:'number', template:t, answerRule:r, difficulty:d,
    flavorText:'Clock faces and circular diagrams cover the walls.',
    hints: h(d, 'Modulo means the remainder after dividing.', '14 mod 5 = 4 because 14 = 2×5 + 4.'),
    variables: [
      { name:'X', type:'number', min:2, max:9, options:[] },
      { name:'Y', type:'number', min:50, max:999, options:[] },
      { name:'R', type:'number', min:0, max:8, options:[] },
    ],
  }));
  out.push(...d6);

  // D7 (19) — GCD / sum conditions
  const d7 = [
    ['GCD({A},{B}) must be greater than {X} to escape.',           'gcd_gt:{A}:{B}:{X}', 7],
    ['The greatest common divisor of {A} and {B} exceeds {X}?',   'gcd_gt:{A}:{B}:{X}', 7],
    ['Shared factors: GCD of {A} and {B} must beat {X}.',          'gcd_gt:{A}:{B}:{X}', 7],
    ['The highest common factor of {A} and {B} is above {X}.',    'gcd_gt:{A}:{B}:{X}', 7],
    ['GCD check: find GCD({A},{B}). If > {X} you survive.',        'gcd_gt:{A}:{B}:{X}', 7],
    ['Sum test: {A} + {B} must be greater than {X}.',              'sum_gt:{A}:{B}:{X}', 7],
    ['The combined value of {A} and {B} must exceed {X}.',         'sum_gt:{A}:{B}:{X}', 7],
    ['Add {A} and {B}. If the result exceeds {X}, escape.',        'sum_gt:{A}:{B}:{X}', 7],
    ['Total gate: {A} plus {B} must be greater than {X}.',         'sum_gt:{A}:{B}:{X}', 7],
    ['Sum of {A} and {B} greater than {X} means survival.',        'sum_gt:{A}:{B}:{X}', 7],
    ['Product parity: {A} × {B} must be even to escape.',          'product_even:{A}:{B}', 7],
    ['The product of {A} and {B} must be an even number.',         'product_even:{A}:{B}', 7],
    ['Multiply {A} by {B}. An even product means survival.',       'product_even:{A}:{B}', 7],
    ['Even product gate: {A} × {B} must yield an even value.',     'product_even:{A}:{B}', 7],
    ['The multiplication result of {A} and {B} is even?',          'product_even:{A}:{B}', 7],
    ['Reverse digits of {X}. If the result > {Y}, survive.',       'reverse_greater:{X}:{Y}', 7],
    ['Mirror the number {X}. If it exceeds {Y}, escape.',          'reverse_greater:{X}:{Y}', 7],
    ['The reverse of {X} must be greater than {Y}.',               'reverse_greater:{X}:{Y}', 7],
    ['Digit reversal test: reverse {X}. Compare to {Y}.',          'reverse_greater:{X}:{Y}', 7],
  ].map(([t, r, d]) => ({
    category:'number', template:t, answerRule:r, difficulty:d,
    flavorText:'Number theory diagrams fill a chalkboard.',
    hints: h(d, 'GCD = largest number that divides both values exactly.'),
    variables: [
      { name:'A', type:'number', min:100, max:999, options:[] },
      { name:'B', type:'number', min:100, max:999, options:[] },
      { name:'X', type:'number', min:1, max:50, options:[] },
      { name:'Y', type:'number', min:100, max:999, options:[] },
    ],
  }));
  out.push(...d7);

  // D8 (18) — advanced conditions
  const d8 = [
    ['The number {X} must be prime AND greater than {Y}.',         'is_prime:{X}', 8],
    ['Is {X} both a prime and an odd number?',                     'is_prime:{X}', 8],
    ['Prime and above {Y}: {X} satisfies both or dies.',           'is_prime:{X}', 8],
    ['The square of {X} must be less than {Y}.',                   'calc_gt:{Y}:{X}', 8],
    ['Verify: is {X} simultaneously prime and between {A} and {B}?','is_prime:{X}', 8],
    ['The product {A}×{B} must be prime. Check.',                  'product_prime:{A}:{B}', 8],
    ['Only prime products escape. Is {A}×{B} prime?',              'product_prime:{A}:{B}', 8],
    ['The combined prime test: {A} times {B} must be prime.',      'product_prime:{A}:{B}', 8],
    ['Advanced gate: is the product of {A} and {B} a prime number?','product_prime:{A}:{B}', 8],
    ['Both {A} and {B} are factors. Their product must be prime.',  'product_prime:{A}:{B}', 8],
    ['The sum of digits of {Y} must itself be prime.',             'is_prime:{Y}', 8],
    ['Nested prime test: digit sum of {Y} must be prime.',         'is_prime:{Y}', 8],
    ['Add the digits of {Y}. If that sum is prime, escape.',       'is_prime:{Y}', 8],
    ['The digital root prime check: digit sum of {Y} prime?',      'is_prime:{Y}', 8],
    ['Sum all digits of {Y}. The total must be a prime number.',   'is_prime:{Y}', 8],
    ['Modulo chain: {Y} mod {X} must be prime.',                   'is_prime:{Y}', 8],
    ['The residue check: {Y} mod {X} itself must be prime.',       'is_prime:{Y}', 8],
    ['Double check: both {Y} and its digit sum must be odd.',      'odd:{Y}', 8],
  ].map(([t, r, d]) => ({
    category:'number', template:t, answerRule:r, difficulty:d,
    flavorText:'Complex number theory diagrams cover every wall.',
    hints: h(d),
    variables: [
      { name:'X', type:'number', min:100, max:9999, options:[] },
      { name:'Y', type:'number', min:100, max:9999, options:[] },
      { name:'A', type:'number', min:2, max:50, options:[] },
      { name:'B', type:'number', min:2, max:50, options:[] },
    ],
  }));
  out.push(...d8);

  // D9 (17) — expert
  const d9 = [
    ['The number {X} must be simultaneously Fibonacci and prime.',  'fibonacci:{X}', 9],
    ['Is {X} both a perfect square and a Fibonacci number?',       'fibonacci:{X}', 9],
    ['Check: {X} is prime, its digit sum is also prime.',          'is_prime:{X}', 9],
    ['The code {X} reversed must also be prime.',                  'is_prime:{X}', 9],
    ['Sum of first {X} primes must be odd. Compute and check.',    'odd:{X}', 9],
    ['GCD({A},{B}) must be prime to unlock the door.',             'is_prime:{A}', 9],
    ['The number {X} and its square root\'s floor must share a digit sum.', 'is_square:{X}', 9],
    ['{X} modulo every digit of {X} must be zero.',               'divisible_by:2:{X}', 9],
    ['Digit product of {X} must be a perfect square.',             'is_square:{X}', 9],
    ['The sum of all prime factors of {X} must be prime.',         'is_prime:{X}', 9],
    ['{X} must satisfy: {X} mod 3 = 0 AND {X} mod 5 ≠ 0.',       'divisible_by:3:{X}', 9],
    ['The number {X} must have an odd number of divisors.',        'is_square:{X}', 9],
    ['Is {X} a perfect number? (sum of proper divisors = {X})',   'is_prime:{X}', 9],
    ['Check if {X} is both triangular and a perfect square.',      'is_triangular:{X}', 9],
    ['The number {X} must be expressible as sum of two primes.',   'even:{X}', 9],
    ['Goldbach check: even number {X} as sum of two primes?',      'even:{X}', 9],
    ['The palindromic prime test: is {X} a palindrome AND prime?', 'is_prime:{X}', 9],
  ].map(([t, r, d]) => ({
    category:'number', template:t, answerRule:r, difficulty:d,
    flavorText:'Abstract mathematics fills every available surface.',
    hints: h(d),
    variables: [{ name:'X', type:'number', min:1000, max:99999, options:[] }, { name:'A', type:'number', min:100, max:9999, options:[] }, { name:'B', type:'number', min:100, max:9999, options:[] }],
  }));
  out.push(...d9);

  // D10 (16) — nightmare
  const d10 = [
    ['Multi-condition gate: {X} must be prime, Fibonacci, and odd.',   'is_prime:{X}', 10],
    ['The ultimate number test: {X} passes only if prime and square.', 'is_prime:{X}', 10],
    ['Combined filter: GCD({A},{B}) = 1 AND their sum is prime.',     'is_prime:{A}', 10],
    ['Number {X}: digit sum prime, digit product square, reverse odd.','is_prime:{X}', 10],
    ['The hardest gate: {X} mod every prime below 10 must vary.',     'is_prime:{X}', 10],
    ['Chain of three: {X} is prime, {X}+2 prime, {X}+6 prime.',       'is_prime:{X}', 10],
    ['Is {X} a Mersenne prime? (2^n − 1 for some n)',                 'is_prime:{X}', 10],
    ['Check {X}: it must be a happy number (digit-square sum→1).',    'is_square:{X}', 10],
    ['The four-condition gate: prime, odd, Fibonacci, > {Y}.',        'is_prime:{X}', 10],
    ['Sophie Germain prime: {X} is prime AND 2{X}+1 is prime.',      'is_prime:{X}', 10],
    ['The absolute hardest: {X} satisfies Wilson\'s theorem remainder.','is_prime:{X}', 10],
    ['Highly composite check: {X} has more divisors than any smaller number.','is_composite:{X}', 10],
    ['The number {X} must be simultaneously abundant and prime.',      'is_prime:{X}', 10],
    ['Check: {X} is prime AND its digit reversal is also prime.',     'is_prime:{X}', 10],
    ['Compute digit sum of {X} repeatedly until 1 digit. Must be prime.', 'is_prime:{X}', 10],
    ['The unholy gate: {X} prime, digit sum prime, reverse prime.',   'is_prime:{X}', 10],
  ].map(([t, r, d]) => ({
    category:'number', template:t, answerRule:r, difficulty:d,
    flavorText:'Impenetrable mathematical notation covers every surface.',
    hints: h(d),
    variables: [{ name:'X', type:'number', min:1000, max:99999, options:[] }, { name:'Y', type:'number', min:100, max:9999, options:[] }, { name:'A', type:'number', min:100, max:9999, options:[] }, { name:'B', type:'number', min:100, max:9999, options:[] }],
  }));
  out.push(...d10);

  return out;
}

module.exports = { numberClues, F, h, uid };
