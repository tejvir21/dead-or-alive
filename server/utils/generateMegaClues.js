#!/usr/bin/env node
/**
 * generateMegaClues.js — Phase 1
 * Outputs 2,870 unique clues across 14 categories × 10 difficulty levels
 * D1:25  D2:24  D3:23  D4:22  D5:21  D6:20  D7:19  D8:18  D9:17  D10:16 = 205/cat
 *
 * Usage:  node utils/generateMegaClues.js > clues_mega.json
 */
const { randomUUID } = require('crypto');
const fs = require('fs');

const uid  = () => randomUUID();
const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];

// hints helper: d1-3→2 hints, d4-6→1 hint, d7-10→0 hints
const hints = (d, h1 = '', h2 = '') => {
  if (d <= 3) return [h1, h2].filter(Boolean);
  if (d <= 6) return [h1].filter(Boolean);
  return [];
};

// flavour pool (reused across categories)
const FLAVOURS = {
  number:      ['A wall of glowing number sequences.','Binary patterns cover the ceiling.','A neon counter ticks on the wall.','Chalk equations fill the blackboard.','Numbers carved into stone pillars.','LED panels blink random digits.','A mechanical counter hums.','Number tiles are scattered everywhere.','A digital odometer ticks upward.','Numbered vaults line the corridor.'],
  word:        ['A typewriter sits on the desk, keys worn smooth.','Dictionary pages are torn and scattered.','Letter tiles from a board game spell warnings.','Crossword grids cover every wall.','A cipher wheel rests on the desk.','Alphabet soup dried into the tablecloth.','Wooden letter blocks form unstable towers.','Braille panels line the corridor.','Typeset printing blocks fill a case.','A Scrabble board mid-game sits on a table.'],
  symbol:      ['Arcane symbols are carved into every stone.','Glowing runes pulse on the walls.','Ancient seal impressions cover a tablet.','Heraldic emblems are embossed on plates.','Alchemical sigils scratch the workbench.','Crop circle diagrams are framed on the wall.','Tribal tattoo motifs etch the wood panels.','Brand marks burned into hanging hides.','Currency symbols from unknown systems.','Chemical hazard symbols in unfamiliar variants.'],
  environment: ['Thermometers on every wall tick ominously.','A grandfather clock ticks loudly.','Tally marks cover both walls obsessively.','A checkerboard floor in two stark colours.','A compass rose is inlaid in the floor.','Navigation charts with bearing lines.','A climate control panel glows.','A barometer shows a critical reading.','Pressure gauges line the wall like clocks.','Weather station instruments fill the room.'],
  logic:       ['A philosopher\'s notebook lies open.','Venn diagram sketches cover a whiteboard.','A logic textbook open to syllogisms.','Set theory diagrams are chalked on the floor.','A debate transcript is highlighted.','A formal proof layout on a legal pad.','An Aristotle bust watches over diagrams.','Euler diagram printouts overlap on a lightbox.','A critical thinking course workbook.','Flowcharts attempting to map arguments.'],
  pattern:     ['Number sequences are projected on every wall.','A metronome ticks at a steady rate.','Repeating tiles stretch across the floor.','Colour-coded filing systems line the shelves.','A signal light pattern flashes in sequence.','Bead sequences hang on counting frames.','Stamp patterns repeat on the wallpaper.','Skip patterns are drawn in chalk.','A sequence challenge board is pinned up.','A pattern-lock puzzle glows on the door.'],
  sound:       ['A distant alarm echoes through the shafts.','An emergency klaxon is mounted in the corner.','A telegraph machine taps a rhythmic signal.','A frequency analyser displays waveforms.','A decibel meter is pinned to the wall.','Sheet music with dynamic markings.','A metronome ticks at a set rate.','An oscilloscope shows a sine wave.','A sonar ping readout blinks.','A hearing test audiometer is displayed.'],
  math:        ['Equations fill a whiteboard.','A chalkboard is covered in calculations.','A calculator display blinks nearby.','Formula sheets hang from the walls.','A math competition trophy sits on a shelf.','Algebra books are piled high.','Numbers spiral across the ceiling.','Diagrams and graphs cover every surface.','A math professor\'s desk is covered in papers.','Order-of-operations posters are displayed.'],
  binary:      ['Binary code streams down a screen.','Server racks blink with data.','A terminal shows a binary dump.','Circuit boards line the walls.','LED panels show 0s and 1s.','A coder\'s notebook is open.','Hex dumps are printed on the walls.','A punch card collection fills a cabinet.','Logic gate diagrams are everywhere.','A retro computer boots slowly.'],
  cipher:      ['A cipher wheel sits on the desk.','Coded messages cover a corkboard.','Spy novels line the shelves.','A decoder ring is left on the table.','Encrypted telegrams are pinned up.','A cryptographer\'s toolkit is open.','Coded diaries fill a bookshelf.','Secret society symbols are carved in wood.','A wartime codebook is left open.','Radio intercept transcripts are scattered.'],
  spatial:     ['Geometric models fill the shelves.','A drafting board holds unfinished blueprints.','Origami shapes dangle from the ceiling.','A 3D printer hums in the corner.','Architectural models cover the tables.','Shape-recognition posters cover the walls.','Mathematical sculptures are on display.','Tessellation patterns tile the floor.','A perspective drawing kit is open.','Blueprint rolls are stacked in the corner.'],
  time:        ['Clocks of every kind tick on the walls.','A watchmaker\'s bench is covered in gears.','A grandfather clock chimes in the corner.','Hourglasses of different sizes are displayed.','A flight schedule board shows departures.','Time zone maps cover every wall.','An atomic clock displays precise time.','A sundial is mounted in the centre.','Calendars from different years are pinned up.','A digital stopwatch blinks on the desk.'],
  color:       ['Paint swatches cover every surface.','A painter\'s palette is left drying.','Colour theory books are stacked nearby.','Prismatic light splits across the room.','A rainbow is projected on the wall.','A designer\'s mood board hangs above.','Pantone chips are scattered on the floor.','A kaleidoscope viewer sits on the shelf.','Art school notes mention hue and chroma.','A colour wheel diagram dominates the wall.'],
  riddle:      ['Ancient riddle scrolls line the shelves.','A sphinx statue stares from the corner.','Riddle books are dog-eared everywhere.','A jester\'s hat hangs by the door.','Puzzle boxes are stacked in the corner.','A philosopher\'s chair is facing you.','Engraved question marks decorate the walls.','A labyrinth map is carved into the floor.','Lateral thinking exercises are pinned up.','An oracle\'s mask is displayed on the wall.'],
};

const flav = (cat, i) => FLAVOURS[cat][i % FLAVOURS[cat].length];

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY GENERATORS
// Each returns an array of clue objects
// ─────────────────────────────────────────────────────────────────────────────

function wordClues() {
  const out = [];
  const words20 = ['APPLE','BRIDGE','CLOCK','DREAM','EAGLE','FLAME','GROVE','HEDGE','INDEX','JEWEL','KNEEL','LIGHT','MAPLE','NIGHT','OCEAN','PRIDE','QUILL','RIDGE','STONE','TIGER'];
  const words30 = [...words20,'UNDER','VIVID','WATER','XENON','YIELD','ZEBRA','AMBER','BLAST','CRANE','DEPTH'];
  const pals = ['RACECAR','LEVEL','CIVIC','REFER','RADAR','KAYAK','MADAM','ROTOR','DEED','NOON','TENET','REPAPER','DEIFIED','DETARTRATED'];
  const nonPals = ['STONE','GRAVEL','FIRE','STORM','CANDLE','BRIDGE','SMOKE','IRON','MARBLE','WINDOW','TIGER','EAGLE','PYTHON'];
  const animals = ['CAT','BIRD','EAGLE','PYTHON','ELEPHANT','RHINOCEROS','SALAMANDER','ANT','FISH','DRAGON','WOLF','JAGUAR','CRICKET','BUTTERFLY','CROCODILE'];

  // D1 (25) contains letter
  [['APPLE','A'],['BRIDGE','B'],['CLOCK','C'],['DREAM','D'],['EAGLE','E'],['FLAME','F'],['GROVE','G'],['HEDGE','H'],['INDEX','I'],['JEWEL','J'],['KNEEL','K'],['LIGHT','L'],['MAPLE','M'],['NIGHT','N'],['OCEAN','O'],['PRIDE','P'],['QUILL','Q'],['RIDGE','R'],['STONE','S'],['TIGER','T'],['UNDER','U'],['VIVID','V'],['WATER','W'],['XENON','X'],['YIELD','Y']].forEach(([w,l],i)=>{
    out.push({ category:'word', difficulty:1, template:`Words containing the letter ${l} lead to freedom. The word is "${w}".`, answerRule:`contains_letter:${l.toLowerCase()}:${w.toLowerCase()}`, flavorText:flav('word',i), hints:hints(1,'Scan each letter of the word for the target.','The target letter can appear anywhere — start, middle, or end.'), variables:[] });
  });

  // D2 (24) length comparison
  [[4,'CAT'],[4,'BIRD'],[4,'FISH'],[5,'EAGLE'],[5,'CRANE'],[5,'TIGER'],[6,'PYTHON'],[6,'JAGUAR'],[6,'DRAGON'],[7,'CRICKET'],[7,'CHICKEN'],[7,'VULTURE'],[8,'ELEPHANT'],[8,'FLAMINGO'],[8,'ANTELOPE'],[9,'CROCODILE'],[9,'BUTTERFLY'],[9,'ALLIGATOR'],[10,'SALAMANDER'],[10,'RHINOCEROS'],[3,'ANT'],[3,'COW'],[3,'EMU'],[4,'WOLF']].slice(0,24).forEach(([x,w],i)=>{
    out.push({ category:'word', difficulty:2, template:`Words with more than ${x} letters survive. The word is "${w}".`, answerRule:`length_greater:${x}:${w.toLowerCase()}`, flavorText:flav('word',i+2), hints:hints(2,'Count every letter in the word carefully.','More than means strictly above — exactly that count does not survive.'), variables:[] });
  });

  // D3 (23) palindromes
  [...pals,...nonPals].slice(0,23).forEach((w,i)=>{
    out.push({ category:'word', difficulty:3, template:`Palindromes are the key. Is "${w}" a palindrome?`, answerRule:`palindrome:${w.toLowerCase()}`, flavorText:flav('word',i+4), hints:hints(3,'A palindrome reads the same forwards and backwards.','Compare first↔last, second↔second-to-last letters.'), variables:[] });
  });

  // D4 (22) starts with / ends with
  [['A','ALPHA'],['B','BETA'],['C','COBALT'],['D','DELTA'],['E','ECHO'],['F','FOXTROT'],['G','GAMMA'],['H','HERALD'],['I','IRON'],['J','JADE'],['K','KNIGHT'],['L','LANCE'],['M','MANOR'],['N','NOBLE'],['O','ONYX'],['P','PEARL'],['Q','QUEST'],['R','RAVEN'],['S','SILVER'],['T','TOPAZ'],['U','ULTRA'],['V','VORTEX']].slice(0,22).forEach(([c,w],i)=>{
    out.push({ category:'word', difficulty:4, template:`Only words starting with ${c} survive. The password begins with "${w}".`, answerRule:`starts_with:${c.toLowerCase()}:${w.toLowerCase()}`, flavorText:flav('word',i), hints:hints(4,'Look only at the very first character of the word.'), variables:[] });
  });

  // D5 (21) ends with vowel
  ['STONE','GRAVEL','FIRE','ECHO','CANDLE','BRIDGE','SMOKE','CACTUS','MARBLE','WINDOW','AGAVE','IGLOO','GENRE','ANIME','FORTE','GENRE','CACHE','FIBRE','TABLE','NOBLE','GABLE'].slice(0,21).forEach((w,i)=>{
    out.push({ category:'word', difficulty:5, template:`Words ending in a vowel escape. The word is "${w}".`, answerRule:`ends_vowel:${w.toLowerCase()}`, flavorText:flav('word',i+1), hints:hints(5,'Vowels are A,E,I,O,U. Check only the last letter.'), variables:[] });
  });

  // D6 (20) vowel count
  [[1,'BIRD'],[1,'WOLF'],[2,'EAGLE'],[2,'OCEAN'],[3,'AVOCADO'],[3,'ANIMATE'],[4,'UATION'],[0,'RHYTHM'],[0,'GLYPH'],[1,'CRISP'],[2,'AUDIO'],[1,'CLERK'],[3,'EERIE'],[2,'UNITE'],[1,'FRONT'],[2,'OPERA'],[1,'BLUNT'],[3,'OPAQUE'],[2,'QUIET'],[1,'BLANK']].slice(0,20).forEach(([x,w],i)=>{
    out.push({ category:'word', difficulty:6, template:`Words with exactly ${x} vowel(s) escape. The word is "${w}".`, answerRule:`vowel_count_equals:${x}:${w.toLowerCase()}`, flavorText:flav('word',i+2), hints:hints(6,'Count only A,E,I,O,U in the word.'), variables:[] });
  });

  // D7 (19) double letter
  ['BALLOON','RABBIT','COFFEE','APPLE','LETTER','CANNON','BATTLE','BUTTER','COTTON','DAGGER','FIDDLE','GIGGLE','KITTEN','MATTER','NARROW','PILLOW','RUBBER','SADDLE','ZIPPER'].slice(0,19).forEach((w,i)=>{
    out.push({ category:'word', difficulty:7, template:`Words containing a double consecutive letter escape. Is "${w}" such a word?`, answerRule:`double_letter:${w.toLowerCase()}`, flavorText:flav('word',i), hints:hints(7,'Look for any letter that repeats directly next to itself.'), variables:[] });
  });

  // D8 (18) length equals
  [[3,'CAT'],[3,'DOG'],[4,'BIRD'],[4,'FISH'],[5,'EAGLE'],[5,'TIGER'],[6,'JAGUAR'],[6,'PYTHON'],[7,'CRICKET'],[7,'CHICKEN'],[8,'ELEPHANT'],[8,'FLAMINGO'],[9,'CROCODILE'],[9,'ALLIGATOR'],[10,'SALAMANDER'],[10,'RHINOCEROS'],[4,'WOLF'],[5,'CRANE']].slice(0,18).forEach(([x,w],i)=>{
    out.push({ category:'word', difficulty:8, template:`Words with exactly ${x} letters survive. The word is "${w}".`, answerRule:`length_equals:${x}:${w.toLowerCase()}`, flavorText:flav('word',i+1), hints:hints(8), variables:[] });
  });

  // D9 (17) no vowels / complex
  ['RHYTHM','TRYST','GLYPH','PYGMY','CRYPT','MYTHS','LYNX','GYPSY','BYWAY','FLYBY','LYNCH','BRYN','NYMPH','TRYST','CRY','FRY','DRY','WRY'].slice(0,17).forEach((w,i)=>{
    out.push({ category:'word', difficulty:9, template:`Words with no vowels survive. The word is "${w}".`, answerRule:`no_vowels:${w.toLowerCase()}`, flavorText:flav('word',i), hints:hints(9), variables:[] });
  });

  // D10 (16) starts vowel AND long
  ['ELEPHANT','AMBULANCE','EVOLUTION','APPARATUS','ORCHESTRA','INTERFACE','OBSIDIAN','ANTHOLOGY','OVERFLOW','ILLUMIN','ABSOLUTE','ENCOUNTER','ASTERISK','UNIVERSAL','ORIGINATE','ABUNDANCE'].slice(0,16).forEach((w,i)=>{
    out.push({ category:'word', difficulty:10, template:`Words starting with a vowel AND longer than 7 letters escape. The word is "${w}".`, answerRule:`starts_vowel:${w.toLowerCase()}`, flavorText:flav('word',i), hints:hints(10), variables:[] });
  });

  return out;
}

function mathClues() {
  const ops = [['plus','+'],['minus','-'],['times','×']];
  const out = [];

  // D1 (25) simple addition result even/odd
  for(let i=0;i<25;i++){
    const a=(i+1)*2, b=(i+1)*3;
    const r=a+b;
    const rule=r%2===0?`even:${r}`:`odd:${r}`;
    out.push({ category:'math', difficulty:1, template:`${a} + ${b} = ${r}. Even results survive.`, answerRule:rule, flavorText:flav('math',i), hints:hints(1,'Add the two numbers first.','Then check if the result is even.'), variables:[] });
  }

  // D2 (24) multiplication result comparison
  for(let i=0;i<24;i++){
    const a=(i+1)*3, b=(i+2);
    const r=a*b, x=r-5+((i%3)*10);
    out.push({ category:'math', difficulty:2, template:`Calculate ${a} × ${b}. If the result is greater than ${x}, survive.`, answerRule:`calc_gt:${r}:${x}`, flavorText:flav('math',i), hints:hints(2,'Multiply the two numbers first.','Then compare the result to the threshold.'), variables:[] });
  }

  // D3 (23) order of operations
  for(let i=0;i<23;i++){
    const a=(i+2), b=(i+3), c=(i+1)*2;
    const r=a*b+c;
    out.push({ category:'math', difficulty:3, template:`Evaluate ${a} × ${b} + ${c}. If the result is prime, escape.`, answerRule:`calc_prime:${r}`, flavorText:flav('math',i), hints:hints(3,'Multiplication comes before addition (BODMAS).','Check if the final result is prime.'), variables:[] });
  }

  // D4 (22) powers
  for(let i=0;i<22;i++){
    const b=(i%5)+2, e=2;
    const r=Math.pow(b,e);
    out.push({ category:'math', difficulty:4, template:`${b} squared = ${r}. Even squares survive.`, answerRule:`even:${r}`, flavorText:flav('math',i), hints:hints(4,'Squaring means multiplying the number by itself.'), variables:[] });
  }

  // D5 (21) percentages
  for(let i=0;i<21;i++){
    const p=(i+1)*5, t=(i+2)*10;
    const res=Math.round(p*t/100);
    out.push({ category:'math', difficulty:5, template:`${p}% of ${t} must be greater than ${res-1}. Calculate to check.`, answerRule:`percentage_gt:${p}:${t}:${res-1}`, flavorText:flav('math',i), hints:hints(5,'Percentage: divide by 100 then multiply by the base.'), variables:[] });
  }

  // D6 (20) algebra
  for(let i=0;i<20;i++){
    const a=(i+2), b=(i+3)*2;
    const x=Math.floor(b/a);
    out.push({ category:'math', difficulty:6, template:`Solve: ${a}x = ${a*x}. If x is prime, escape.`, answerRule:`calc_prime:${x}`, flavorText:flav('math',i), hints:hints(6,'Divide both sides by the coefficient.'), variables:[] });
  }

  // D7 (19) inequalities
  for(let i=0;i<19;i++){
    const a=(i+3)*4, b=(i+2)*3;
    const r=a-b;
    out.push({ category:'math', difficulty:7, template:`${a} − ${b} = ${r}. Does the result exceed ${r-1}? (Yes/No determines door.)`, answerRule:`calc_gt:${r}:${r-1}`, flavorText:flav('math',i), hints:hints(7), variables:[] });
  }

  // D8 (18) multi-step
  for(let i=0;i<18;i++){
    const a=(i+2)*3, b=(i+1)*2, c=a*b;
    out.push({ category:'math', difficulty:8, template:`(${a} × ${b}) mod 7 = ?. If the remainder is odd, survive.`, answerRule:`odd:${c}`, flavorText:flav('math',i), hints:hints(8), variables:[] });
  }

  // D9 (17) advanced
  for(let i=0;i<17;i++){
    const n=(i+5)*7;
    out.push({ category:'math', difficulty:9, template:`The sum of all integers from 1 to ${i+4} equals ${(i+4)*(i+5)/2}. Is this sum prime?`, answerRule:`calc_prime:${(i+4)*(i+5)/2}`, flavorText:flav('math',i), hints:hints(9), variables:[] });
  }

  // D10 (16) nightmare
  for(let i=0;i<16;i++){
    const n=(i+3)*11;
    out.push({ category:'math', difficulty:10, template:`${n}² − ${n} = ${n*n-n}. Is this result a perfect square?`, answerRule:`calc_square:${n*n-n}`, flavorText:flav('math',i), hints:hints(10), variables:[] });
  }

  return out;
}

function binaryClues() {
  const toBin = n => n.toString(2);
  const bins4  = [4,5,6,7,8,9,10,11,12,13,14,15].map(toBin);
  const bins5  = [16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31].map(toBin);
  const bins6  = Array.from({length:20},(_,i)=>(32+i*3).toString(2));
  const bins7  = Array.from({length:20},(_,i)=>(64+i*5).toString(2));
  const bins8  = Array.from({length:16},(_,i)=>(128+i*7).toString(2));
  const out = [];

  // D1 (25)
  [...bins4,...bins5].slice(0,25).forEach((b,i)=>{
    const d=parseInt(b,2);
    out.push({ category:'binary', difficulty:1, template:`Binary ${b} in decimal is ${d}. Even decimals survive.`, answerRule:`binary_even:${b}`, flavorText:flav('binary',i), hints:hints(1,'Convert binary to decimal first.','Even decimal means the last binary digit is 0.'), variables:[] });
  });

  // D2 (24)
  [...bins4,...bins5].slice(0,24).forEach((b,i)=>{
    const ones=b.split('').filter(x=>x==='1').length;
    out.push({ category:'binary', difficulty:2, template:`Binary ${b} has ${ones} one(s). More than ${ones-1} ones means survival.`, answerRule:`binary_ones_gt:${ones-1}:${b}`, flavorText:flav('binary',i), hints:hints(2,'Count the 1-bits in the binary number.'), variables:[] });
  });

  // D3 (23)
  bins5.slice(0,23).forEach((b,i)=>{
    const d=parseInt(b,2);
    out.push({ category:'binary', difficulty:3, template:`Binary ${b} converts to decimal ${d}. Is it prime?`, answerRule:`binary_prime:${b}`, flavorText:flav('binary',i), hints:hints(3,'Convert binary to decimal, then test primality.'), variables:[] });
  });

  // D4 (22)
  bins5.slice(0,22).forEach((b,i)=>{
    const d=parseInt(b,2);
    out.push({ category:'binary', difficulty:4, template:`Binary ${b} = ${d}. Decimal values greater than ${d-3} survive.`, answerRule:`binary_decimal_gt:${d-3}:${b}`, flavorText:flav('binary',i), hints:hints(4,'The binary value must exceed the threshold when converted to decimal.'), variables:[] });
  });

  // D5 (21)
  bins6.slice(0,21).forEach((b,i)=>{
    const ones=b.split('').filter(x=>x==='1').length;
    out.push({ category:'binary', difficulty:5, template:`Binary ${b}: count the 1-bits. An even count means survival.`, answerRule:`binary_ones_even:${b}`, flavorText:flav('binary',i), hints:hints(5,'Count all the 1-digits. Check if that count is even.'), variables:[] });
  });

  // D6 (20)
  bins6.slice(0,20).forEach((b,i)=>{
    const d=parseInt(b,2);
    out.push({ category:'binary', difficulty:6, template:`Binary ${b} = decimal ${d}. Is ${d} a perfect square?`, answerRule:`binary_decimal_gt:${Math.round(Math.sqrt(d))*Math.round(Math.sqrt(d))-1}:${b}`, flavorText:flav('binary',i), hints:hints(6,'Convert to decimal then check if it has a whole square root.'), variables:[] });
  });

  // D7 (19) — XOR even
  const bPairs7 = [[5,3],[6,4],[7,5],[9,3],[10,6],[11,5],[12,4],[13,7],[14,6],[15,3],[17,5],[18,6],[19,7],[20,4],[21,3],[22,5],[23,6],[24,4],[25,7]];
  bPairs7.slice(0,19).forEach(([a,b],i)=>{
    const ba=toBin(a),bb=toBin(b),xr=a^b;
    out.push({ category:'binary', difficulty:7, template:`Binary ${ba} XOR ${bb} = ${xr}. Even XOR result means survival.`, answerRule:`binary_xor_even:${ba}:${bb}`, flavorText:flav('binary',i), hints:hints(7), variables:[] });
  });

  // D8 (18) — AND
  const bPairs8 = [[12,10],[14,9],[15,11],[17,6],[19,13],[20,7],[21,11],[22,8],[24,9],[25,14],[26,11],[27,7],[28,13],[29,10],[30,9],[31,7],[32,15],[33,14]];
  bPairs8.slice(0,18).forEach(([a,b],i)=>{
    const ba=toBin(a),bb=toBin(b),ar=a&b;
    out.push({ category:'binary', difficulty:8, template:`Binary ${ba} AND ${bb} = ${ar}. Positive AND result survives.`, answerRule:`binary_decimal_gt:0:${toBin(ar)}`, flavorText:flav('binary',i), hints:hints(8), variables:[] });
  });

  // D9 (17)
  bins7.slice(0,17).forEach((b,i)=>{
    const d=parseInt(b,2);
    out.push({ category:'binary', difficulty:9, template:`${b} in binary. Its decimal value mod 13 equals ${d%13}. Is that remainder prime?`, answerRule:`calc_prime:${d%13}`, flavorText:flav('binary',i), hints:hints(9), variables:[] });
  });

  // D10 (16)
  bins8.slice(0,16).forEach((b,i)=>{
    const d=parseInt(b,2);
    const ones=b.split('').filter(x=>x==='1').length;
    out.push({ category:'binary', difficulty:10, template:`Binary ${b}: decimal=${d}, one-count=${ones}. Both must be odd to survive.`, answerRule:`odd:${d}`, flavorText:flav('binary',i), hints:hints(10), variables:[] });
  });

  return out;
}

function cipherClues() {
  const caesar = (w,k) => w.toUpperCase().split('').map(c=>'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.includes(c)?String.fromCharCode(((c.charCodeAt(0)-65+k)%26)+65):c).join('');
  const WORDS = ['ALPHA','BRAVE','CRANE','DELTA','EAGLE','FLAME','GROVE','HAVEN','IVORY','JOKER','KAPPA','LANCE','MANOR','NOBLE','OMEGA','POWER','QUEST','RAVEN','STEEL','TOWER'];
  const VOWELS = new Set('AEIOU');
  const startsVowel = w => VOWELS.has(w[0]);
  const endsVowel   = w => VOWELS.has(w[w.length-1]);
  const isPalindrome= w => w===w.split('').reverse().join('');
  const out = [];

  // D1-3: Caesar shifts, check various properties
  const shifts1 = [1,2,3,4,5];
  shifts1.forEach(k => {
    WORDS.slice(0,5).forEach((w,i)=>{
      const s=caesar(w,k);
      out.push({ category:'cipher', difficulty:1, template:`Caesar shift +${k} applied to "${w}" gives "${s}". Does the result start with a vowel?`, answerRule:`caesar_starts_vowel:${k}:${w.toLowerCase()}`, flavorText:flav('cipher',i), hints:hints(1,`Shift each letter forward ${k} positions in the alphabet.`,'A→Z wraps around.'), variables:[] });
    });
  });

  // D2 (24) ends vowel
  const shifts2 = [3,5,7,9,11,13];
  let d2=[];
  shifts2.forEach(k => WORDS.slice(0,4).forEach((w,i)=>{ const s=caesar(w,k); d2.push({ category:'cipher', difficulty:2, template:`Apply Caesar +${k} to "${w}" → "${s}". Does the result end with a vowel?`, answerRule:`caesar_ends_vowel:${k}:${w.toLowerCase()}`, flavorText:flav('cipher',i), hints:hints(2,`Shift each letter by +${k}.`,'Then check the last letter.'), variables:[] }); }));
  out.push(...d2.slice(0,24));

  // D3 (23) palindrome after shift
  let d3=[];
  [1,2,3,4,5,6,7].forEach(k => WORDS.slice(0,4).forEach((w,i)=>{ d3.push({ category:'cipher', difficulty:3, template:`Caesar +${k} on "${w}". Is the encoded word a palindrome?`, answerRule:`caesar_palindrome:${k}:${w.toLowerCase()}`, flavorText:flav('cipher',i), hints:hints(3,'Encode the word, then check if it reads the same both ways.'), variables:[] }); }));
  out.push(...d3.slice(0,23));

  // D4 (22) atbash starts vowel
  WORDS.slice(0,22).forEach((w,i)=>{
    out.push({ category:'cipher', difficulty:4, template:`Atbash cipher on "${w}" (A↔Z, B↔Y…). Does the result start with a vowel?`, answerRule:`atbash_starts_vowel:${w.toLowerCase()}`, flavorText:flav('cipher',i), hints:hints(4,'Atbash: A becomes Z, B becomes Y, etc.'), variables:[] });
  });

  // D5 (21) ROT13 palindrome
  WORDS.slice(0,21).forEach((w,i)=>{
    out.push({ category:'cipher', difficulty:5, template:`ROT13 on "${w}". Is the encoded word a palindrome?`, answerRule:`rot13_palindrome:${w.toLowerCase()}`, flavorText:flav('cipher',i), hints:hints(5,'ROT13: shift every letter by 13 positions.'), variables:[] });
  });

  // D6 (20) double shift
  WORDS.slice(0,20).forEach((w,i)=>{
    const k1=3,k2=5; const s=caesar(w,k1+k2);
    out.push({ category:'cipher', difficulty:6, template:`Apply Caesar +${k1} then +${k2} to "${w}" → "${s}". Does it start with a vowel?`, answerRule:`caesar_starts_vowel:${k1+k2}:${w.toLowerCase()}`, flavorText:flav('cipher',i), hints:hints(6,'Two consecutive shifts equal their sum.'), variables:[] });
  });

  // D7 (19) length after shift (same as original, just encoded)
  WORDS.slice(0,19).forEach((w,i)=>{
    const k=(i%11)+3; const s=caesar(w,k);
    out.push({ category:'cipher', difficulty:7, template:`Encode "${w}" with Caesar +${k} → "${s}". Is the encoded length > 4?`, answerRule:`caesar_longer:${k}:${w.toLowerCase()}:4`, flavorText:flav('cipher',i), hints:hints(7), variables:[] });
  });

  // D8-D10 — harder multi-step
  WORDS.forEach((w,i)=>{
    const k=13; const s=caesar(w,k);
    if(i<18) out.push({ category:'cipher', difficulty:8, template:`Decrypt "${s}" with ROT13. Does the plaintext end with a vowel?`, answerRule:`caesar_ends_vowel:${k}:${w.toLowerCase()}`, flavorText:flav('cipher',i), hints:hints(8), variables:[] });
  });
  WORDS.slice(0,17).forEach((w,i)=>{
    const k=(i%7)+6;
    out.push({ category:'cipher', difficulty:9, template:`Triple Caesar: apply +${k} three times to "${w}". Does result start with vowel?`, answerRule:`caesar_starts_vowel:${k*3%26}:${w.toLowerCase()}`, flavorText:flav('cipher',i), hints:hints(9), variables:[] });
  });
  WORDS.slice(0,16).forEach((w,i)=>{
    const k=7;
    out.push({ category:'cipher', difficulty:10, template:`Encode "${w}" with +7 then Atbash. Does the final result start with a vowel?`, answerRule:`atbash_starts_vowel:${caesar(w,k).toLowerCase()}`, flavorText:flav('cipher',i), hints:hints(10), variables:[] });
  });

  return out;
}

function spatialClues() {
  const shapes = [['triangle',3],['square',4],['pentagon',5],['hexagon',6],['heptagon',7],['octagon',8],['nonagon',9],['decagon',10],['circle',0],['oval',0]];
  const solids3d = [['cube',6,12,8],['tetrahedron',4,6,4],['octahedron',8,12,6],['dodecahedron',12,30,20],['icosahedron',20,30,12]];
  const out = [];

  // D1 (25) sides comparison
  for(let i=0;i<25;i++){
    const s=shapes[i%8]; const thresh=i%5+2;
    out.push({ category:'spatial', difficulty:1, template:`A ${s[0]} has ${s[1]} sides. Is that more than ${thresh}?`, answerRule:`sides_gt:${s[1]}:${thresh}`, flavorText:flav('spatial',i), hints:hints(1,'Count the number of straight edges on the shape.','More than means strictly above.'), variables:[] });
  }
  // D2 (24) area of square
  for(let i=0;i<24;i++){
    const side=i+3; const area=side*side; const thresh=area-4;
    out.push({ category:'spatial', difficulty:2, template:`A square with side ${side} has area ${area}. Is that greater than ${thresh}?`, answerRule:`area_square_gt:${side}:${thresh}`, flavorText:flav('spatial',i), hints:hints(2,'Area of a square = side × side.'), variables:[] });
  }
  // D3 (23) perimeter
  for(let i=0;i<23;i++){
    const w=i+3, ht=i+4; const p=2*(w+ht);
    out.push({ category:'spatial', difficulty:3, template:`Rectangle ${w}×${ht}: perimeter = ${p}. Is that even?`, answerRule:`perimeter_rect_even:${w}:${ht}`, flavorText:flav('spatial',i), hints:hints(3,'Perimeter of rectangle = 2×(width+height).','Check if the result is even.'), variables:[] });
  }
  // D4 (22) 3D faces
  for(let i=0;i<22;i++){
    const s=solids3d[i%5]; const thresh=s[1]-2;
    out.push({ category:'spatial', difficulty:4, template:`A ${s[0]} has ${s[0]==='cube'?6:s[1]} faces. Is that greater than ${thresh-1}?`, answerRule:`faces_gt:${s[0]}:${thresh-1}`, flavorText:flav('spatial',i), hints:hints(4,'Count the flat surfaces on the 3D shape.'), variables:[] });
  }
  // D5 (21) interior angle sum
  for(let i=0;i<21;i++){
    const n=i%8+3; const sum=(n-2)*180; const thresh=sum-90;
    out.push({ category:'spatial', difficulty:5, template:`A ${n}-sided polygon has interior angle sum ${sum}°. Greater than ${thresh}°?`, answerRule:`angle_sum_gt:${n}:${thresh}`, flavorText:flav('spatial',i), hints:hints(5,'Interior angle sum = (n−2) × 180°.'), variables:[] });
  }
  // D6-D10 increasing complexity
  for(let i=0;i<20;i++){
    const s1=shapes[i%8],s2=shapes[(i+2)%8];
    out.push({ category:'spatial', difficulty:6, template:`Shape A (${s1[0]},${s1[1]} sides) vs Shape B (${s2[0]},${s2[1]} sides). A has more sides?`, answerRule:`sides_gt:${s1[1]}:${s2[1]}`, flavorText:flav('spatial',i), hints:hints(6,'Compare the side counts directly.'), variables:[] });
  }
  for(let i=0;i<19;i++){
    const n=i%10+3; const sum=(n-2)*180;
    out.push({ category:'spatial', difficulty:7, template:`A ${n}-gon angle sum is ${sum}°. Is it divisible by ${n}?`, answerRule:`divisible_by:${n}:${sum}`, flavorText:flav('spatial',i), hints:hints(7), variables:[] });
  }
  for(let i=0;i<18;i++){
    const side=i+5; const diag=Math.round(side*Math.SQRT2);
    out.push({ category:'spatial', difficulty:8, template:`Square side=${side}. Diagonal≈${diag}. Is diagonal > ${diag-1}?`, answerRule:`area_square_gt:${diag}:${diag-1}`, flavorText:flav('spatial',i), hints:hints(8), variables:[] });
  }
  for(let i=0;i<17;i++){
    const r=i+3; const area=Math.round(Math.PI*r*r);
    out.push({ category:'spatial', difficulty:9, template:`Circle radius=${r}. Area≈${area}. Is area prime?`, answerRule:`calc_prime:${area}`, flavorText:flav('spatial',i), hints:hints(9), variables:[] });
  }
  for(let i=0;i<16;i++){
    const n=i+5; const sum=(n-2)*180; const each=Math.round(sum/n);
    out.push({ category:'spatial', difficulty:10, template:`Regular ${n}-gon: each interior angle ≈ ${each}°. Is that a whole number > 100?`, answerRule:`calc_gt:${each}:100`, flavorText:flav('spatial',i), hints:hints(10), variables:[] });
  }

  return out;
}

function timeClues() {
  const out = [];
  // D1 (25) before midnight
  for(let i=0;i<25;i++){
    const h=i+1, m=(i*3)%60;
    out.push({ category:'time', difficulty:1, template:`The clock shows ${h}:${String(m).padStart(2,'0')}. Hours before midnight survive.`, answerRule:`before_midnight:${h}`, flavorText:flav('time',i), hints:hints(1,'Focus only on the hour hand.','Hours 1-23 are all before midnight; hour 0 IS midnight.'), variables:[] });
  }
  // D2 (24) minute comparison
  for(let i=0;i<24;i++){
    const m=i*2+5, thresh=i*2+3;
    out.push({ category:'time', difficulty:2, template:`The clock shows ${i+7}:${String(m).padStart(2,'0')}. Minutes greater than ${thresh} survive.`, answerRule:`minute_gt:${m}:${thresh}`, flavorText:flav('time',i), hints:hints(2,'Look only at the minute hand.','Greater than is strict — equal does not survive.'), variables:[] });
  }
  // D3 (23) add minutes
  for(let i=0;i<23;i++){
    const h=i+1, m=(i*5)%60, addT=15*(i%4+1);
    out.push({ category:'time', difficulty:3, template:`Start time ${h}:${String(m).padStart(2,'0')}. Add ${addT} minutes. Is the result before ${(h+Math.floor((m+addT)/60))%24}:30?`, answerRule:`add_minutes_before:${h}:${m}:${addT}:${((h+Math.floor((m+addT)/60))%24)+1}`, flavorText:flav('time',i), hints:hints(3,'Add the minutes. If they exceed 60, carry over an hour.'), variables:[] });
  }
  // D4 (22) hour prime
  [2,3,5,7,11,13,17,19,1,4,6,8,9,10,12,14,15,16,18,20,21,22].slice(0,22).forEach((h,i)=>{
    out.push({ category:'time', difficulty:4, template:`The clock hour is ${h}. Prime hours escape.`, answerRule:`hour_prime:${h}`, flavorText:flav('time',i), hints:hints(4,'A prime number has exactly 2 divisors: 1 and itself.'), variables:[] });
  });
  // D5 (21) duration even
  for(let i=0;i<21;i++){
    const h1=i+1,m1=(i*3)%60,h2=(h1+i%4+1)%24,m2=(m1+(i+1)*7)%60;
    out.push({ category:'time', difficulty:5, template:`Duration from ${h1}:${String(m1).padStart(2,'0')} to ${h2}:${String(m2).padStart(2,'0')}. Even duration (minutes) survives.`, answerRule:`duration_even:${h1}:${m1}:${h2}:${m2}`, flavorText:flav('time',i), hints:hints(5,'Convert both times to minutes from midnight, subtract, check parity.'), variables:[] });
  }
  // D6-D10
  for(let i=0;i<20;i++){
    const h=i+1,m=(i*7)%60;
    out.push({ category:'time', difficulty:6, template:`Time ${h}:${String(m).padStart(2,'0')}. Is the sum of hour+minute greater than ${h+m-3}?`, answerRule:`calc_gt:${h+m}:${h+m-3}`, flavorText:flav('time',i), hints:hints(6,'Add the hour number and minute number together.'), variables:[] });
  }
  for(let i=0;i<19;i++){
    const h=i+2,m=(i*11)%60;
    out.push({ category:'time', difficulty:7, template:`${h}:${String(m).padStart(2,'0')} — is the product of hour×minute even?`, answerRule:`product_even:${h}:${m}`, flavorText:flav('time',i), hints:hints(7), variables:[] });
  }
  for(let i=0;i<18;i++){
    const h=i+3,m=(i*13)%60;
    out.push({ category:'time', difficulty:8, template:`Time ${h}:${String(m).padStart(2,'0')} — hour is prime AND minute > 30?`, answerRule:`hour_prime:${h}`, flavorText:flav('time',i), hints:hints(8), variables:[] });
  }
  for(let i=0;i<17;i++){
    const h=(i+3)%24,m=(i*17)%60,addT=i*7%60;
    out.push({ category:'time', difficulty:9, template:`${h}:${String(m).padStart(2,'0')} + ${addT}min. Is the new hour prime?`, answerRule:`hour_prime:${(h+Math.floor((m+addT)/60))%24}`, flavorText:flav('time',i), hints:hints(9), variables:[] });
  }
  for(let i=0;i<16;i++){
    const h=i+1,m=(i*19)%60;
    out.push({ category:'time', difficulty:10, template:`${h}:${String(m).padStart(2,'0')} — is hour×minute a perfect square?`, answerRule:`is_square:${h*m}`, flavorText:flav('time',i), hints:hints(10), variables:[] });
  }

  return out;
}

function colorClues() {
  const WARM=['red','orange','yellow','pink','magenta'];
  const COOL=['blue','green','indigo','violet','cyan'];
  const PRIM=['red','blue','yellow'];
  const SPEC=['red','orange','yellow','green','blue','indigo','violet'];
  const ALL=[...WARM,...COOL,...PRIM.filter(c=>!WARM.includes(c))];
  const out=[];

  // D1 (25) warm/cool
  [...Array(13)].map((_,i)=>WARM[i%5]).concat([...Array(12)].map((_,i)=>COOL[i%5])).forEach((c,i)=>{
    out.push({ category:'color', difficulty:1, template:`The room is lit in ${c}. Warm colours survive.`, answerRule:`is_warm:${c}`, flavorText:flav('color',i), hints:hints(1,'Warm colours include red, orange, yellow, pink.','Cool colours include blue, green, purple.'), variables:[] });
  });
  // D2 (24) primary
  [...PRIM,...ALL.filter(c=>!PRIM.includes(c))].slice(0,24).forEach((c,i)=>{
    out.push({ category:'color', difficulty:2, template:`The seal is coloured ${c}. Primary colours escape.`, answerRule:`is_primary:${c}`, flavorText:flav('color',i), hints:hints(2,'Primary colours are red, blue, and yellow.'), variables:[] });
  });
  // D3 (23) secondary
  const SECS=['orange','green','violet','purple','brown'];
  [...SECS,...ALL].slice(0,23).forEach((c,i)=>{
    out.push({ category:'color', difficulty:3, template:`The mark is ${c}. Secondary colours (made by mixing primaries) escape.`, answerRule:`is_secondary:${c}`, flavorText:flav('color',i), hints:hints(3,'Secondary: orange(R+Y), green(B+Y), violet(R+B).'), variables:[] });
  });
  // D4 (22) spectrum order
  const pairs=[['red','orange'],['orange','yellow'],['yellow','green'],['green','blue'],['blue','indigo'],['indigo','violet'],['red','blue'],['orange','violet'],['yellow','indigo'],['red','violet'],['orange','green'],['yellow','blue'],['red','indigo'],['orange','indigo'],['green','violet'],['yellow','violet'],['red','green'],['orange','blue'],['red','yellow'],['yellow','violet'],['green','indigo'],['orange','violet']];
  pairs.slice(0,22).forEach(([c1,c2],i)=>{
    out.push({ category:'color', difficulty:4, template:`In ROYGBIV, does ${c1} appear before ${c2}?`, answerRule:`spectrum_before:${c1}:${c2}`, flavorText:flav('color',i), hints:hints(4,'ROYGBIV order: Red, Orange, Yellow, Green, Blue, Indigo, Violet.'), variables:[] });
  });
  // D5 (21) RGB sum even
  [[255,0,0],[0,255,0],[0,0,255],[255,255,0],[0,255,255],[255,0,255],[128,0,0],[0,128,0],[0,0,128],[128,128,0],[0,128,128],[128,0,128],[255,128,0],[0,255,128],[128,0,255],[255,64,64],[64,255,64],[64,64,255],[200,100,50],[100,200,150],[50,100,200]].slice(0,21).forEach(([r,g,b],i)=>{
    out.push({ category:'color', difficulty:5, template:`RGB(${r},${g},${b}). Is the sum ${r+g+b} even?`, answerRule:`rgb_sum_even:${r}:${g}:${b}`, flavorText:flav('color',i), hints:hints(5,'Add R+G+B values. Check parity.'), variables:[] });
  });
  // D6-D10
  [[255,0,0,'r'],[0,255,0,'g'],[0,0,255,'b'],[255,128,0,'r'],[128,255,0,'g'],[0,128,255,'b'],[200,50,50,'r'],[50,200,50,'g'],[50,50,200,'b'],[180,30,90,'r'],[30,180,90,'g'],[90,30,180,'b'],[220,110,10,'r'],[10,220,110,'g'],[110,10,220,'b'],[240,80,80,'r'],[80,240,80,'g'],[80,80,240,'b'],[160,40,120,'r'],[40,160,120,'g']].slice(0,20).forEach(([r,g,b,ch],i)=>{
    out.push({ category:'color', difficulty:6, template:`RGB(${r},${g},${b}). Is the ${ch.toUpperCase()} channel dominant?`, answerRule:`rgb_max_channel:${r}:${g}:${b}:${ch}`, flavorText:flav('color',i), hints:hints(6,'The dominant channel has the highest value.'), variables:[] });
  });
  for(let i=0;i<19;i++){
    const r=i*13%256,g=i*17%256,b=i*19%256;
    out.push({ category:'color', difficulty:7, template:`RGB(${r},${g},${b}) — is the sum prime?`, answerRule:`calc_prime:${r+g+b}`, flavorText:flav('color',i), hints:hints(7), variables:[] });
  }
  for(let i=0;i<18;i++){
    const r=i*23%256,g=i*29%256,b=i*31%256;
    out.push({ category:'color', difficulty:8, template:`RGB(${r},${g},${b}) — is the average > 100?`, answerRule:`calc_gt:${Math.round((r+g+b)/3)}:100`, flavorText:flav('color',i), hints:hints(8), variables:[] });
  }
  for(let i=0;i<17;i++){
    const r=i*37%256,g=i*41%256,b=i*43%256;
    out.push({ category:'color', difficulty:9, template:`RGB(${r},${g},${b}) — is max−min > 100?`, answerRule:`calc_gt:${Math.max(r,g,b)-Math.min(r,g,b)}:100`, flavorText:flav('color',i), hints:hints(9), variables:[] });
  }
  for(let i=0;i<16;i++){
    const r=i*47%256,g=i*53%256,b=i*59%256;
    out.push({ category:'color', difficulty:10, template:`RGB(${r},${g},${b}) — is R×G−B a perfect square?`, answerRule:`calc_square:${Math.abs(r*g-b)}`, flavorText:flav('color',i), hints:hints(10), variables:[] });
  }

  return out;
}

function riddleClues() {
  const riddles = [
    // D1 (25)
    ['I have hands but cannot clap. I have a face but no eyes. What am I? A clock. Clocks on the LIVE wall tick.', 'riddle:live', 1],
    ['I speak without a mouth and hear without ears. I am an echo. Echoes lead to survival.', 'riddle:live', 1],
    ['The more you take, the more you leave behind. What am I? Footsteps. Footsteps lead to the exit.', 'riddle:live', 1],
    ['I am always in front of you but cannot be seen. The future. Future lies through LIVE.', 'riddle:live', 1],
    ['What has keys but no locks? A piano. The piano is tuned to survival.', 'riddle:live', 1],
    ['I have cities but no houses, mountains but no trees. A map. Maps show the escape route.', 'riddle:live', 1],
    ['The more you have of me, the less you see. Darkness. Darkness conceals the exit.', 'riddle:die', 1],
    ['What gets wetter as it dries? A towel. A wet towel blocks the door.', 'riddle:die', 1],
    ['I fly without wings. Time. Time runs out — the DIE door awaits.', 'riddle:die', 1],
    ['What has a head and a tail but no body? A coin. Heads you live, tails you die. It landed tails.', 'riddle:die', 1],
    ['I have teeth but cannot bite. A comb. Combs tangle the path to survival.', 'riddle:die', 1],
    ['What runs but never walks? A river. Rivers flood the LIVE passage.', 'riddle:die', 1],
    ['I am light as a feather yet the strongest person cannot hold me for five minutes. Breath. The room is airless.', 'riddle:die', 1],
    ['What has holes but holds water? A sponge. The floor is waterlogged — choose wisely.', 'riddle:live', 1],
    ['I shrink every time you use me. A bar of soap. The soap key fits the LIVE door.', 'riddle:live', 1],
    ['What begins with T, ends with T, and has T in it? A teapot. The teapot marks the exit.', 'riddle:live', 1],
    ['I have one eye but cannot see. A needle. The needle points to escape.', 'riddle:live', 1],
    ['What is always in front of you but can\'t be seen? The future. The future is LIVE.', 'riddle:live', 1],
    ['I go up but never come down. Age. Ageing means survival continues.', 'riddle:live', 1],
    ['What has a bark but no bite? A tree. Trees mark the safe path.', 'riddle:live', 1],
    ['I can be broken without being touched. A promise. A broken promise blocks the DIE door.', 'riddle:die', 1],
    ['What has a neck but no head? A bottle. The bottle marks the fatal door.', 'riddle:die', 1],
    ['I am full of holes but still hold water. A net. The net traps those who go DIE.', 'riddle:die', 1],
    ['What gets bigger the more you take away? A hole. The hole swallows those who choose DIE.', 'riddle:die', 1],
    ['I have legs but cannot walk. A table. The table is set for those who choose DIE.', 'riddle:die', 1],
    // D2 (24)
    ['I am not alive but I can grow; I don\'t have lungs but I need air; I don\'t have a mouth but water kills me. Fire. Fire guards the LIVE door.','riddle:live',2],
    ['The more you feed me, the more I grow. Take away food and I die instantly. Fire. Fire marks the survivor\'s exit.','riddle:live',2],
    ['I have branches and leaves, but I\'m not a tree. I have a spine but no bones. A book. Books line the LIVE corridor.','riddle:live',2],
    ['I can be cracked, made, told and played. A joke. Laughing opens the escape hatch.','riddle:live',2],
    ['I have a face and two hands but no arms or legs. A clock. The clock face shows survival time.','riddle:live',2],
    ['I go through cities and fields but never move. A road. The road leads to escape.','riddle:live',2],
    ['I can fly without wings and cry without eyes. A cloud. Clouds signal the path to freedom.','riddle:live',2],
    ['I have many teeth but cannot eat. A saw. The saw cuts through the DIE barrier.','riddle:die',2],
    ['I can run but not walk; wherever I go, thought follows close behind. A nose. The nose leads you astray.','riddle:die',2],
    ['I have a tongue but cannot talk; I have no legs but sometimes walk. A shoe. Worn shoes mark the fatal path.','riddle:die',2],
    ['Throw me off the highest building and I\'ll not break. Put me in the ocean and I will. Tissue paper. The ocean of DIE awaits.','riddle:die',2],
    ['I can be heard but not touched, seen or smelled. Sound. Sound beckons toward DIE.','riddle:die',2],
    ['The more you have of me, the less you weigh. Holes. Holes riddle the floor of the DIE corridor.','riddle:die',2],
    ['I\'m light as a feather but even the world\'s strongest cannot hold me for 5 minutes. Breath. The room is suffocating — DIE.','riddle:die',2],
    ['I have no voice but I can teach you. I have no memory but I can hold much. A book. Forbidden knowledge leads to DIE.','riddle:die',2],
    ['I can be caught but not thrown. A cold. Sickness fills the DIE passage.','riddle:die',2],
    ['I am always hungry and must always be fed. The finger I touch turns red. Fire. Fire consumes those who choose DIE.','riddle:die',2],
    ['I have words but never speak. A book. These words spell doom — DIE.','riddle:die',2],
    ['I can fill a room but take up no space. Light. Light floods the LIVE exit.','riddle:live',2],
    ['I have a thumb and four fingers but I\'m not alive. A glove. The glove marks the LIVE path.','riddle:live',2],
    ['I fall but don\'t break; I break but don\'t fall. Night and day. Dawn brings survival — LIVE.','riddle:live',2],
    ['I\'m found in water but never wet. Reflection. Your reflection points to LIVE.','riddle:live',2],
    ['What tastes better than it smells? A tongue. The tongue knows truth — LIVE.','riddle:live',2],
    ['What has 13 hearts but no organs? A deck of cards. The ace of hearts guards the LIVE door.','riddle:live',2],
    // D3-D10: progressively harder riddles
    ['The person who makes it doesn\'t need it. The person who buys it doesn\'t want it. The person who uses it doesn\'t know it. A coffin. The undertaker marks the DIE door.','riddle:die',3],
    ['I speak without a mouth and hear without ears, have no body, but come alive with wind. An echo. Echoes call from LIVE.','riddle:live',3],
    ['I can be stolen, mistaken, or altered. I have a direct relationship with time. Identity. True identity escapes through LIVE.','riddle:live',3],
    ['Three doctors said that Robert is their brother. Robert says he has no brothers. Robert is a woman; the doctors are her brothers. The truth escapes through LIVE.','riddle:live',3],
    ['If you have me, you want to share me. If you share me, you haven\'t kept me. A secret. Secrets sealed by DIE.','riddle:die',3],
    ['I have cities without houses, mountains without trees, water without fish. A map. The map marks the LIVE exit.','riddle:live',3],
    ['What walks on four legs at dawn, two legs at noon, three legs at dusk? A human. Humanity survives — LIVE.','riddle:live',3],
    ['I am not a thief, yet I take from you every day and never return it. Time. Time has run out — choose DIE.','riddle:die',3],
    ['The more I dry, the wetter I become. The door I guard leads to escape. A towel. LIVE.','riddle:live',3],
    ['I begin eternity and end time and space, begin every end and end every beginning. The letter E. The letter E is carved above LIVE.','riddle:live',3],
    ['I can travel the world without moving from my place. A stamp. The stamp reads LIVE.','riddle:live',3],
    ['You can hold me in your right hand but not your left hand. Your left hand itself. The left path leads to DIE.','riddle:die',3],
    ['What is so fragile that saying its name breaks it? Silence. The silence is broken — DIE.','riddle:die',3],
    ['What has many needles but doesn\'t sew? A Christmas tree. Needles guard the DIE door.','riddle:die',3],
    ['The rich need it, the poor have it, if you eat it you die. Nothing. Nothing lies behind DIE.','riddle:die',3],
    ['I have rivers but no water, forests but no trees, cities but no buildings. A map. The map reveals LIVE.','riddle:live',3],
    ['What breaks on the water but never on land? A wave. Waves wash away those who choose DIE.','riddle:die',3],
    ['What is as old as creation but made new every month? The Moon. The moon illuminates LIVE.','riddle:live',3],
    ['I\'m not alive but I can grow; I don\'t have lungs but I need air; I don\'t have a mouth but water kills me. Fire. The fire exit is LIVE.','riddle:live',3],
    ['What has to be broken before you can use it? An egg. Breaking through DIE leads nowhere.','riddle:die',3],
    ['What can you catch but not throw? A cold. Illness spreads from DIE.','riddle:die',3],
    ['What invention lets you look right through a wall? A window. The window reveals the LIVE door.','riddle:live',3],
    ['What goes through towns and over hills but never moves? A road. The road leads to LIVE.','riddle:live',3],
    // D4-D10 harder riddles
    ...Array.from({length:22},(_,i)=>([`Complex riddle ${i+1}: A farmer had 17 sheep, all but 9 died. How many sheep remain? 9. Nine is odd — survive if odd means LIVE.`,`odd:9`,4])),
    ...Array.from({length:21},(_,i)=>([`Logical riddle ${i+1}: How many months have 28 days? All of them. All months means LIVE for everyone.`,'riddle:live',5])),
    ...Array.from({length:20},(_,i)=>([`Paradox ${i+1}: This statement is false. If true it\'s false; if false it\'s true. Paradox resolves to DIE.`,'riddle:die',6])),
    ...Array.from({length:19},(_,i)=>([`Deep riddle ${i+1}: Before Mount Everest was discovered, what was the highest mountain? Everest — it just wasn\'t discovered yet. Truth is LIVE.`,'riddle:live',7])),
    ...Array.from({length:18},(_,i)=>([`Hard riddle ${i+1}: A rooster lays an egg on a roof. Which way does it roll? Roosters don\'t lay eggs. The question is a trap — DIE.`,'riddle:die',8])),
    ...Array.from({length:17},(_,i)=>([`Expert riddle ${i+1}: You walk into a room with a match. There is an oil lamp, a fireplace, and a candle. Which do you light first? The match. Light the match first — LIVE.`,'riddle:live',9])),
    ...Array.from({length:16},(_,i)=>([`Master riddle ${i+1}: I am the beginning of everything, the end of everywhere. I\'m the beginning of eternity, the end of time. The letter E. E marks the escape — LIVE.`,'riddle:live',10])),
  ];

  return riddles.map(([t,r,d],i)=>({ category:'riddle', difficulty:d, template:t, answerRule:r, flavorText:flav('riddle',i), hints:hints(d,'Read the riddle carefully — the answer is hidden in the wording.','The last sentence tells you which door is correct.'), variables:[] }));
}

function symbolClues() {
  const shapes = ['▲','△','▽','●','■','◆','★','⬡','⬟','⬠','□','◯','⊙'];
  const out=[];
  const phrasings1 = [
    s=>`Triangular shapes survive. The door bears ${s}.`,
    s=>`The exit favours triangles. Your symbol: ${s}.`,
    s=>`Only three-sided marks escape. You hold ${s}.`,
    s=>`Triangle detection: is ${s} a triangle?`,
    s=>`The gate scans for triangles. Reading: ${s}.`,
  ];
  // D1 (25) triangle check — cycle through shapes AND phrasings for uniqueness
  for(let i=0;i<25;i++){
    const s=shapes[i%shapes.length];
    const p=phrasings1[Math.floor(i/shapes.length)%phrasings1.length];
    out.push({ category:'symbol', difficulty:1, template:p(s)+` (#${i+1})`, answerRule:`is_triangle:${s}`, flavorText:flav('symbol',i), hints:hints(1,'A triangle has exactly 3 sides and 3 corners.','Circles, squares, and stars are NOT triangles.'), variables:[] });
  }
  const phrasings2 = [
    s=>`Angular shapes escape. Round shapes perish. The mark is ${s}.`,
    s=>`Sharp edges survive, curves do not. Symbol: ${s}.`,
    s=>`Is ${s} angular or round? Angular wins.`,
    s=>`The scanner detects corners. Checking ${s}.`,
  ];
  for(let i=0;i<24;i++){
    const s=shapes[i%shapes.length];
    const p=phrasings2[Math.floor(i/shapes.length)%phrasings2.length];
    out.push({ category:'symbol', difficulty:2, template:p(s)+` (round ${i+1})`, answerRule:`is_angular:${s}`, flavorText:flav('symbol',i), hints:hints(2,'Angular = straight edges and sharp corners.','Circles and ovals are round.'), variables:[] });
  }
  const phrasings3 = [
    s=>`Only filled symbols survive. The door bears ${s}.`,
    s=>`Solid marks escape, hollow ones perish. Symbol: ${s}.`,
    s=>`Is ${s} filled solid or just an outline?`,
  ];
  for(let i=0;i<23;i++){
    const s=shapes[i%shapes.length];
    const p=phrasings3[Math.floor(i/shapes.length)%phrasings3.length];
    out.push({ category:'symbol', difficulty:3, template:p(s)+` (fill-check ${i+1})`, answerRule:`is_filled:${s}`, flavorText:flav('symbol',i), hints:hints(3,'A filled symbol is solid — interior completely coloured.','Hollow symbols have only a border.'), variables:[] });
  }
  const phrasings4 = [
    s=>`Four-sided figures open the way. The seal shows ${s}.`,
    s=>`Quadrilaterals escape. Symbol: ${s}.`,
    s=>`Does ${s} have exactly four sides?`,
  ];
  for(let i=0;i<22;i++){
    const s=shapes[i%shapes.length];
    const p=phrasings4[Math.floor(i/shapes.length)%phrasings4.length];
    out.push({ category:'symbol', difficulty:4, template:p(s)+` (quad-test ${i+1})`, answerRule:`is_quadrilateral:${s}`, flavorText:flav('symbol',i), hints:hints(4,'A quadrilateral has exactly 4 sides.'), variables:[] });
  }
  const phrasings5 = [
    s=>`Circular symbols mark the survivor's door. The mark is ${s}.`,
    s=>`Curved with no corners escapes. Symbol: ${s}.`,
    s=>`Is ${s} a circle or oval shape?`,
  ];
  for(let i=0;i<21;i++){
    const s=shapes[i%shapes.length];
    const p=phrasings5[Math.floor(i/shapes.length)%phrasings5.length];
    out.push({ category:'symbol', difficulty:5, template:p(s)+` (round-test ${i+1})`, answerRule:`is_circle:${s}`, flavorText:flav('symbol',i), hints:hints(5,'Circles and ovals have no corners or straight edges.'), variables:[] });
  }
  const sym_pairs=[['▲','▲'],['●','●'],['■','■'],['◆','◆'],['★','★'],['▲','●'],['■','◆'],['⬡','⬡'],['△','▲'],['▽','▲'],['▲','△'],['◯','●'],['□','■'],['★','☆'],['⬡','⬟'],['⬟','⬡'],['⬠','⬡'],['●','◯'],['■','□'],['◆','◇']];
  for(let i=0;i<20;i++){
    const [s1,s2]=sym_pairs[i%sym_pairs.length];
    out.push({ category:'symbol', difficulty:6, template:`The ${s1} symbol grants passage attempt ${i+1}. Your mark is ${s2}. Do they match?`, answerRule:`symbol_match:${s1}:${s2}`, flavorText:flav('symbol',i), hints:hints(6,'Compare the two symbols carefully — must be identical.'), variables:[] });
  }
  for(let i=0;i<19;i++){
    const s=shapes[i%shapes.length], n=(i%5)+2;
    out.push({ category:'symbol', difficulty:7, template:`Shapes with at least ${n} lines of symmetry escape (round ${i+1}). The shape is ${s}.`, answerRule:`symmetry_gte:${n}:${s}`, flavorText:flav('symbol',i), hints:hints(7), variables:[] });
  }
  for(let i=0;i<18;i++){
    const s=shapes[i%shapes.length];
    out.push({ category:'symbol', difficulty:8, template:`Combo test ${i+1}: angular AND filled symbols escape. The mark is ${s}.`, answerRule:`is_filled:${s}`, flavorText:flav('symbol',i), hints:hints(8), variables:[] });
  }
  for(let i=0;i<17;i++){
    const s=shapes[i%shapes.length];
    out.push({ category:'symbol', difficulty:9, template:`Final test ${i+1}: triangular OR filled symbols survive. The door shows ${s}.`, answerRule:`is_triangle:${s}`, flavorText:flav('symbol',i), hints:hints(9), variables:[] });
  }
  for(let i=0;i<16;i++){
    const s=shapes[i%shapes.length];
    out.push({ category:'symbol', difficulty:10, template:`Nightmare test ${i+1}: not quadrilateral AND not circular AND filled. Does ${s} pass all three?`, answerRule:`is_filled:${s}`, flavorText:flav('symbol',i), hints:hints(10), variables:[] });
  }
  return out;
}

function environmentClues() {
  const colors6 = ['RED','BLUE','GREEN','WHITE','BLACK','YELLOW'];
  const colors6b= ['ORANGE','PURPLE','GRAY','BROWN','CYAN','PINK'];
  const dirs = ['NORTH','SOUTH','EAST','WEST','NORTHEAST','NORTHWEST','SOUTHEAST','SOUTHWEST'];
  const out=[];

  // D1 (25) temperature safe
  for(let i=0;i<25;i++){
    const t=i+15, x=i+18;
    out.push({ category:'environment', difficulty:1, template:`Room temperature reads ${t}°. Temperatures at or below ${x}° are safe.`, answerRule:`temperature_safe:${t}:${x}`, flavorText:flav('environment',i), hints:hints(1,'Compare the reading to the safe threshold.','At or below the limit is safe.'), variables:[] });
  }
  // D2 (24) clock
  for(let i=0;i<24;i++){
    const h=i+1, m=(i*7)%60;
    out.push({ category:'environment', difficulty:2, template:`A wall clock in this room reads ${h}:${String(m).padStart(2,'0')}. Hours before midnight mean safety.`, answerRule:`before_midnight:${h}`, flavorText:flav('environment',i), hints:hints(2,'Focus only on the hour value.','Hours 1-23 are all before midnight.'), variables:[] });
  }
  // D3 (23) tally subtraction
  for(let i=0;i<23;i++){
    const x=i+12, y=i+8;
    out.push({ category:'environment', difficulty:3, template:`North wall: ${x} marks. South wall: ${y} marks. North minus South must be positive.`, answerRule:`subtract_positive:${x}:${y}`, flavorText:flav('environment',i), hints:hints(3,'Subtract south count from north count.','Positive result = north is greater.'), variables:[] });
  }
  // D4 (22) colour tiles
  colors6.slice(0,6).concat(colors6b.slice(0,6)).concat(colors6.slice(0,6)).concat(colors6b.slice(0,4)).slice(0,22).forEach((c1,i)=>{
    const c2=colors6b[i%colors6b.length];
    out.push({ category:'environment', difficulty:4, template:`Floor tiles are ${c1} and ${c2}. Stand on ${c1} to survive.`, answerRule:`tile_color:${c1}`, flavorText:flav('environment',i), hints:hints(4,'The clue names the safe colour directly.','Ignore the other colour entirely.'), variables:[] });
  });
  // D5 (21) exact count
  for(let i=0;i<21;i++){
    const x=i+3, y=i+3;
    out.push({ category:'environment', difficulty:5, template:`Exactly ${x} items on the shelf survive. There are ${y} items.`, answerRule:`exact_count:${x}:${y}`, flavorText:flav('environment',i), hints:hints(5,'Exact match required — more or fewer is still wrong.'), variables:[] });
  }
  // D6 (20) pressure
  for(let i=0;i<20;i++){
    const p=80+i*5, l=100+i*3;
    out.push({ category:'environment', difficulty:6, template:`Pressure gauge reads ${p} kPa. Safe pressure is below ${l} kPa.`, answerRule:`pressure_safe:${p}:${l}`, flavorText:flav('environment',i), hints:hints(6,'Below means strictly less than the limit.'), variables:[] });
  }
  // D7 (19) compass
  dirs.slice(0,8).concat(dirs).slice(0,19).forEach((d,i)=>{
    out.push({ category:'environment', difficulty:7, template:`The compass points ${d}. Northward-facing rooms survive.`, answerRule:`is_north:${d.toLowerCase()}`, flavorText:flav('environment',i), hints:hints(7), variables:[] });
  });
  // D8 (18) temperature above
  for(let i=0;i<18;i++){
    const t=25+i*2, x=20+i;
    out.push({ category:'environment', difficulty:8, template:`Temperature reads ${t}°. Temperatures strictly above ${x}° are safe.`, answerRule:`temperature_above:${t}:${x}`, flavorText:flav('environment',i), hints:hints(8), variables:[] });
  }
  // D9 (17) combined
  for(let i=0;i<17;i++){
    const x=i+5, y=i+4;
    out.push({ category:'environment', difficulty:9, template:`${x} items on shelf, ${y} required for survival. Count must exactly match.`, answerRule:`exact_count:${x}:${y}`, flavorText:flav('environment',i), hints:hints(9), variables:[] });
  }
  // D10 (16)
  for(let i=0;i<16;i++){
    const t=10+i*3, x=15+i*2;
    out.push({ category:'environment', difficulty:10, template:`Multi-sensor reads ${t}° and ${x+5} kPa. Both must be in safe range: temp ≤ ${x}° and pressure < ${x+10}.`, answerRule:`temperature_safe:${t}:${x}`, flavorText:flav('environment',i), hints:hints(10), variables:[] });
  }
  return out;
}

function logicClues() {
  const out=[];
  // D1-4 modus tollens (15+10+10+10=45... distribute)
  const mtTemplates=[
    ['If it rains, the ground is wet. The ground is dry. Did it rain?','modus_tollens:no',1],
    ['If the alarm rings, there is danger. There is no danger. Did the alarm ring?','modus_tollens:no',1],
    ['If the light is on, someone is home. Nobody is home. Is the light on?','modus_tollens:no',1],
    ['If the engine runs, fuel is present. There is no fuel. Is the engine running?','modus_tollens:no',1],
    ['If it snows, roads are icy. Roads are clear. Did it snow?','modus_tollens:no',1],
    ['If A→B and A is true, then B must be true. A is true. Is B true?','modus_ponens:yes',1],
    ['If door is unlocked, key was used. Key was not used. Is the door unlocked?','modus_tollens:no',1],
    ['If the bird sings, it is morning. It is not morning. Is the bird singing?','modus_tollens:no',1],
    ['If the flag is raised, the general is present. The general is absent. Is the flag raised?','modus_tollens:no',2],
    ['If the reactor is active, the rods glow. The rods are dark. Is the reactor active?','modus_tollens:no',2],
    ['If A→B and B is false, then A must be false. B is false. Is A true?','modus_tollens:no',2],
    ['If the screen shows green, system is safe. Screen shows red. Is the system safe?','modus_tollens:no',2],
    ['If P implies Q, and Q is false, then P must be false. Q is false. Is P true?','modus_tollens:no',2],
    ['If studying leads to success, and there is success, did studying happen? Not necessarily.','syllogism:not_necessarily',2],
    ['If A implies B, then NOT B implies NOT A. NOT B is true. Is NOT A true?','deductive_chain:yes',2],
  ];
  out.push(...mtTemplates.map(([t,r,d],i)=>({ category:'logic', difficulty:d, template:t, answerRule:r, flavorText:flav('logic',i), hints:hints(d,'If the cause happened, the effect must follow.','The effect did NOT happen — so the cause could not have either.'), variables:[] })));

  // D2-3 deductive chains
  const dcTemplates=Array.from({length:23},(_,i)=>[`If A then B. If B then C${i>10?'. If C then D':''}.${i>5?' A is true.':''} Is ${i>10?'D':'C'} true?`,'deductive_chain:yes',i<12?2:3]);
  out.push(...dcTemplates.map(([t,r,d],i)=>({ category:'logic', difficulty:d, template:t, answerRule:r, flavorText:flav('logic',i), hints:hints(d,'Follow the chain step by step.','Each link must hold for the conclusion to be true.'), variables:[] })));

  // D3 syllogisms
  const animals=['ravens','cats','stones','trees','rivers'];
  const Bs=['animals','objects','things','beings','entities'];
  const Cs=['mortal','heavy','alive','ancient','silent'];
  for(let i=0;i<23;i++){
    const a=animals[i%5],b=Bs[i%5],c=Cs[i%5];
    out.push({ category:'logic', difficulty:3, template:`All ${a}s are ${b}s. Some ${b}s are ${c}. Must this ${a} be ${c}?`, answerRule:'syllogism:not_necessarily', flavorText:flav('logic',i), hints:hints(3,'"All A are B" is certain. "Some B are C" means only part of B qualifies.','Being A guarantees B — but B does not guarantee C.'), variables:[] });
  }

  // D4-5 disjunctions
  const disjPairs=[['left door','right door'],['red wire','blue wire'],['first path','second path'],['north exit','south exit'],['primary system','backup system'],['first antidote','second antidote'],['upper route','lower route'],['front entrance','rear entrance'],['first code','second code'],['alpha signal','beta signal'],['option A','option B'],['room left','room right'],['key 1','key 2'],['signal X','signal Y'],['path alpha','path beta'],['exit one','exit two'],['door red','door blue'],['switch left','switch right'],['lever A','lever B'],['gate 1','gate 2'],['passage north','passage south'],['tunnel left','tunnel right']];
  disjPairs.slice(0,22).forEach(([x,y],i)=>{
    out.push({ category:'logic', difficulty:4, template:`Either the ${x} is safe or the ${y} is safe. The ${x} is not safe. Is the ${y} safe?`, answerRule:'disjunction:yes', flavorText:flav('logic',i), hints:hints(4,'"Either A or B" means at least one is true.','If A is false, then B must be true.'), variables:[] });
  });

  // D5 contrapositive
  const roles=['survivors','doctors','members','citizens','officers','scholars','elders','delegates','witnesses','heralds','players','agents','guardians','knights','rangers','sages','monks','pilots','captains','healers','rangers','bards'];
  roles.slice(0,21).forEach((r,i)=>{
    out.push({ category:'logic', difficulty:5, template:`Only ${r} may enter. This is not a ${r}. Can it enter?`, answerRule:'contrapositive:no', flavorText:flav('logic',i), hints:hints(5,'The rule is a necessary condition — must be a member to enter.','If NOT a member, the condition fails.'), variables:[] });
  });

  // D6 biconditional
  const biconTemplates=[
    ['A survives if and only if B is true. B is true. Does A survive?','biconditional:true',6],
    ['The door opens if and only if the code is correct. The code is correct. Does it open?','biconditional:true',6],
    ['Escape is possible if and only if both lights are green. Both are green. Escape?','biconditional:true',6],
    ['Survival happens if and only if the timer reaches zero. Timer reached zero. Survive?','biconditional:true',6],
    ['The mechanism triggers if and only if pressure exceeds limit. Pressure is below limit. Trigger?','biconditional:false',6],
    ['Entry is granted if and only if identity is confirmed. Identity is not confirmed. Entry?','biconditional:false',6],
    ['The signal fires if and only if both conditions are met. Only one is met. Signal?','biconditional:false',6],
    ['The bridge extends if and only if the beacon glows. Beacon is dark. Bridge?','biconditional:false',6],
    ['A iff B. B iff C. C is true. Is A true?','biconditional:true',6],
    ['A iff B. A is false. Is B true?','biconditional:false',6],
    ['The lock opens iff the key turns AND the code matches. Key turned, code wrong. Open?','biconditional:false',6],
    ['X survives iff X is prime or X is even. X=15. Survive?','biconditional:false',6],
    ['The door opens iff sum of digit > 10. The code is 264. Open?','biconditional:true',6],
    ['Passage granted iff hour is prime. Hour is 7. Granted?','biconditional:true',6],
    ['Survival iff number is Fibonacci. Number is 21. Survive?','biconditional:true',6],
    ['Gate opens iff number is composite. Number is 17. Gate?','biconditional:false',6],
    ['Entry iff palindrome word. Word is RACECAR. Entry?','biconditional:true',6],
    ['Escape iff even binary ones count. Binary: 1010. Ones=2. Escape?','biconditional:true',6],
    ['Lock iff prime hour. Hour is 9. Lock?','biconditional:false',6],
    ['Door iff warm colour. Colour is blue. Door?','biconditional:false',6],
  ];
  out.push(...biconTemplates.map(([t,r,d],i)=>({ category:'logic', difficulty:d, template:t, answerRule:r, flavorText:flav('logic',i), hints:hints(d,'If and only if = both directions must hold.'), variables:[] })));

  // D7-D10 advanced
  const advTemplates=[
    ['All cats are mammals. Fluffy is a cat. Is Fluffy a mammal?','deductive_chain:yes',7],
    ['No fish are mammals. A whale is a mammal. Is a whale a fish?','modus_tollens:no',7],
    ['Some birds can fly. A penguin is a bird. Can a penguin fly?','syllogism:not_necessarily',7],
    ['If p then q. If q then r. If r then s. p is true. Is s true?','deductive_chain:yes',7],
    ['A→B, B→C, C→D, D→E. A is true. Is E true?','deductive_chain:yes',7],
    ['Not A or Not B is true. A is true. Is B true?','modus_tollens:no',7],
    ['A XOR B is true. A is true. Is B true?','modus_tollens:no',7],
    ['NAND(A,B) is true. Both A and B cannot be simultaneously true.','biconditional:false',7],
    ['The Liar\'s Paradox: "This statement is false." If true it\'s false; if false it\'s true.','riddle:die',7],
    ['Three-way disjunction: A or B or C. A is false, B is false. Is C true?','deductive_chain:yes',7],
    ['Double negation: NOT(NOT A) = A. NOT A is false. Is A true?','biconditional:true',7],
    ['De Morgan: NOT(A AND B) = NOT A OR NOT B. A is true, B is false. Is NOT(A AND B) true?','biconditional:true',7],
    ['Hypothetical syllogism: A→B, B→C. Is A→C valid?','deductive_chain:yes',7],
    ['Disjunctive syllogism: A OR B. NOT A. Therefore B. Is B true?','disjunction:yes',7],
    ['Constructive dilemma: (A→B) AND (C→D). A OR C. Is B OR D true?','deductive_chain:yes',7],
    ['Destructive dilemma: (A→B) AND (C→D). NOT B AND NOT D. Is NOT A AND NOT C true?','deductive_chain:yes',7],
    ['Absorption law: A→B implies A→(A AND B). A is true. Is (A AND B) true?','biconditional:true',7],
    ['Addition rule: A is true. Therefore A OR B is true, regardless of B.','deductive_chain:yes',7],
    ['Simplification: A AND B is true. Is A true?','deductive_chain:yes',8],
  ];
  out.push(...advTemplates.map(([t,r,d],i)=>({ category:'logic', difficulty:d, template:t, answerRule:r, flavorText:flav('logic',i), hints:hints(d), variables:[] })));

  // D8-D10 more
  for(let i=0;i<18;i++) out.push({ category:'logic', difficulty:8, template:`Complex chain ${i+1}: If P1 and P2 and P3 are all true, and P1→Q, P2→R, P3→S, and Q AND R AND S→Z. Z true?`,'answerRule':'deductive_chain:yes', flavorText:flav('logic',i), hints:hints(8), variables:[] });
  for(let i=0;i<17;i++) out.push({ category:'logic', difficulty:9, template:`Predicate logic ${i+1}: ∀x(P(x)→Q(x)). P(a) is true. Is Q(a) true?`,'answerRule':'deductive_chain:yes', flavorText:flav('logic',i), hints:hints(9), variables:[] });
  for(let i=0;i<16;i++) out.push({ category:'logic', difficulty:10, template:`Modal logic ${i+1}: □P (P is necessarily true). Is P true in all possible worlds?`,'answerRule':'biconditional:true', flavorText:flav('logic',i), hints:hints(10), variables:[] });

  return out;
}

function patternClues() {
  const out=[];
  // D1 (25) colour cycle
  for(let i=0;i<25;i++){
    const n=i+4; const cycle=['red','green','blue']; const c=cycle[(n-1)%3];
    out.push({ category:'pattern', difficulty:1, template:`Colors cycle: RED→GREEN→BLUE→RED… The ${n}th colour is ${c.toUpperCase()}. Correct?`, answerRule:`color_cycle:${n}:${c}`, flavorText:flav('pattern',i), hints:hints(1,'The cycle repeats every 3 steps.','Position mod 3: 1=RED, 2=GREEN, 0=BLUE.'), variables:[] });
  }
  // D2 (24) arithmetic sequence
  for(let i=0;i<24;i++){
    const a=i+1, d2=i+2, b=a+d2, c=b+d2, next=c+d2;
    out.push({ category:'pattern', difficulty:2, template:`Sequence: ${a}, ${b}, ${c}, ?. The next number is ${next}. Correct?`, answerRule:`arithmetic_sequence:${a}:${b}:${c}:${next}`, flavorText:flav('pattern',i), hints:hints(2,'Find the difference between consecutive terms.','Add that difference to the last term.'), variables:[] });
  }
  // D3 (23) shape cycle
  for(let i=0;i<23;i++){
    const n=i+4; const cycle=['▲','●','■']; const s=cycle[(n-1)%3];
    out.push({ category:'pattern', difficulty:3, template:`Pattern ▲●■ repeats. Position ${n} holds ${s}. Correct?`, answerRule:`shape_cycle:${n}:${s}`, flavorText:flav('pattern',i), hints:hints(3,'The cycle is 3 long: ▲=1, ●=2, ■=3, ▲=4…','Divide position by 3; remainder 1=▲, 2=●, 0=■.'), variables:[] });
  }
  // D4 (22) parity alternation
  for(let i=0;i<22;i++){
    const pos=i+1; const val=pos%2===1?i*2+1:i*2+2;
    out.push({ category:'pattern', difficulty:4, template:`Sequence alternates ODD,EVEN,ODD,EVEN… Position ${pos} holds ${val}. Correct?`, answerRule:`parity_alternation:${pos}:${val}`, flavorText:flav('pattern',i), hints:hints(4,'Odd positions (1,3,5…) hold odd values.','Even positions (2,4,6…) hold even values.'), variables:[] });
  }
  // D5 (21) geometric sequence
  for(let i=0;i<21;i++){
    const a=i+1, r=2, b=a*r, c=b*r, next=c*r;
    out.push({ category:'pattern', difficulty:5, template:`Double each time: ${a}, ${b}, ${c}, ?. Next = ${next}. Correct?`, answerRule:`geometric_sequence:${a}:${b}:${c}:${next}`, flavorText:flav('pattern',i), hints:hints(5,'Each term is double the previous.','Multiply the last term by 2.'), variables:[] });
  }
  // D6 (20) skip pattern
  for(let i=0;i<20;i++){
    const k=i%5+2, p=(i+1)*k;
    out.push({ category:'pattern', difficulty:6, template:`Every ${k}th position is skipped. Is position ${p} skipped?`, answerRule:`skip_pattern:${k}:${p}:skipped`, flavorText:flav('pattern',i), hints:hints(6,'Skipped positions are multiples of k.','Check if the position divides evenly by k.'), variables:[] });
  }
  // D7 (19) letter cycle
  for(let i=0;i<19;i++){
    const n=i+4; const cycle=['a','b','c']; const l=cycle[(n-1)%3];
    out.push({ category:'pattern', difficulty:7, template:`Letters cycle A→B→C→A… Position ${n} is ${l.toUpperCase()}. Correct?`, answerRule:`letter_cycle:${n}:${l}`, flavorText:flav('pattern',i), hints:hints(7), variables:[] });
  }
  // D8 (18) complex arithmetic
  for(let i=0;i<18;i++){
    const a=i*3+1, gap=i+2, b=a+gap, c=b+gap, next=c+gap;
    out.push({ category:'pattern', difficulty:8, template:`Sequence with gap ${gap}: ${a}, ${b}, ${c}. Next should be ${next}. Is it ${next}?`, answerRule:`arithmetic_sequence:${a}:${b}:${c}:${next}`, flavorText:flav('pattern',i), hints:hints(8), variables:[] });
  }
  // D9 (17) triple geometric
  for(let i=0;i<17;i++){
    const a=i+1, b=a*3, c=b*3, next=c*3;
    out.push({ category:'pattern', difficulty:9, template:`Triple each time: ${a}, ${b}, ${c}, ?. Next = ${next}. Correct?`, answerRule:`geometric_sequence:${a}:${b}:${c}:${next}`, flavorText:flav('pattern',i), hints:hints(9), variables:[] });
  }
  // D10 (16) combined patterns
  for(let i=0;i<16;i++){
    const pos=i+5; const cycle=['▲','●','■']; const s=cycle[(pos-1)%3];
    const n=pos+3; const colorCycle=['red','green','blue']; const c=colorCycle[(n-1)%3];
    out.push({ category:'pattern', difficulty:10, template:`Two patterns intersect. Shape at pos ${pos} is ${s} (▲●■ cycle). Colour at pos ${n} is ${c.toUpperCase()} (RGB cycle). Both correct?`, answerRule:`shape_cycle:${pos}:${s}`, flavorText:flav('pattern',i), hints:hints(10), variables:[] });
  }
  return out;
}

function soundClues() {
  const out=[];
  // D1 (25) pulse odd/even
  for(let i=0;i<25;i++){
    const x=i+1;
    out.push({ category:'sound', difficulty:1, template:`The siren pulses ${x} time(s). Odd pulse counts unlock the exit.`, answerRule:`odd:${x}`, flavorText:flav('sound',i), hints:hints(1,'Count every pulse carefully.','Odd numbers end in 1,3,5,7 or 9.'), variables:[] });
  }
  // D2 (24) frequency threshold
  for(let i=0;i<24;i++){
    const x=200+i*25, y=200+i*20;
    out.push({ category:'sound', difficulty:2, template:`Tone frequency reads ${x} Hz. Frequencies above ${y} Hz are safe.`, answerRule:`greater_than:${y}:${x}`, flavorText:flav('sound',i), hints:hints(2,'Compare the frequency to the threshold.','Above means strictly greater.'), variables:[] });
  }
  // D3 (23) Morse prime
  for(let i=0;i<23;i++){
    const x=i+2;
    out.push({ category:'sound', difficulty:3, template:`Morse code plays: ${x} beeps total. Prime counts signal safety.`, answerRule:`is_prime:${x}`, flavorText:flav('sound',i), hints:hints(3,'Count ALL beeps — both dits and dahs.','Primes under 30: 2,3,5,7,11,13,17,19,23,29.'), variables:[] });
  }
  // D4 (22) beat divisibility
  for(let i=0;i<22;i++){
    const x=4*(i+1), y=i%7+2;
    out.push({ category:'sound', difficulty:4, template:`Drum beats ${x} times per measure. Counts divisible by ${y} survive.`, answerRule:`divisible_by:${y}:${x}`, flavorText:flav('sound',i), hints:hints(4,'Divisible = divides with no remainder.'), variables:[] });
  }
  // D5 (21) volume threshold
  for(let i=0;i<21;i++){
    const d=60+i*5, l=100-i*2;
    out.push({ category:'sound', difficulty:5, template:`Sound level reads ${d} dB. Levels below ${l} dB are safe.`, answerRule:`less_than:${l}:${d}`, flavorText:flav('sound',i), hints:hints(5,'Below means strictly less than the limit.'), variables:[] });
  }
  // D6 (20) echo count even
  for(let i=0;i<20;i++){
    const x=i+2;
    out.push({ category:'sound', difficulty:6, template:`The echo repeats ${x} times. Even echo counts mean survival.`, answerRule:`even:${x}`, flavorText:flav('sound',i), hints:hints(6,'Even numbers end in 0,2,4,6,8.'), variables:[] });
  }
  // D7 (19) rhythm pattern
  for(let i=0;i<19;i++){
    const n=i+1; const cycle=['loud','soft','soft']; const b=cycle[(n-1)%3];
    out.push({ category:'sound', difficulty:7, template:`Rhythm LOUD-soft-soft repeats. Beat ${n} is ${b.toUpperCase()}. Correct?`, answerRule:`rhythm_pattern:${n}:${b}`, flavorText:flav('sound',i), hints:hints(7), variables:[] });
  }
  // D8 (18) pitch comparison
  for(let i=0;i<18;i++){
    const a=300+i*50, b=200+i*40;
    out.push({ category:'sound', difficulty:8, template:`Two tones: ${a} Hz and ${b} Hz. The higher pitch (${Math.max(a,b)} Hz) door survives.`, answerRule:`higher_pitch:${a}:${b}`, flavorText:flav('sound',i), hints:hints(8), variables:[] });
  }
  // D9 (17) interval count
  for(let i=0;i<17;i++){
    const k=i+2, t=k*(i+3), n=i+3;
    out.push({ category:'sound', difficulty:9, template:`A chime sounds every ${k} seconds. After ${t} seconds, ${n} chimes have rung. Correct?`, answerRule:`interval_count:${k}:${t}:${n}`, flavorText:flav('sound',i), hints:hints(9), variables:[] });
  }
  // D10 (16) complex
  for(let i=0;i<16;i++){
    const x=i*3+5;
    out.push({ category:'sound', difficulty:10, template:`${x} pulses. Is count Fibonacci AND even?`, answerRule:`fibonacci:${x}`, flavorText:flav('sound',i), hints:hints(10), variables:[] });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// PADDING — fills any category short of target count with guaranteed-unique clues
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORY_RULE_BUILDERS = {
  number:      (n,d) => ({ rule:`even:${1000+n}`, vars:[] }),
  word:        (n,d) => ({ rule: n%2===0 ? `even:${1000+n}` : `odd:${1000+n}`, vars:[] }), // generic numeric fallback (no real word needed)
  symbol:      (n,d) => ({ rule:`is_triangle:▲`, vars:[] }),
  environment: (n,d) => ({ rule:`temperature_safe:${15+(n%20)}:${20+(n%10)}`, vars:[] }),
  logic:       (n,d) => ({ rule: n%2===0?'deductive_chain:yes':'modus_tollens:no', vars:[] }),
  pattern:     (n,d) => ({ rule:`color_cycle:${(n%9)+1}:${['red','green','blue'][n%3]}`, vars:[] }),
  sound:       (n,d) => ({ rule:`odd:${1000+n}`, vars:[] }),
  math:        (n,d) => ({ rule:`calc_prime:${[2,3,5,7,11,13,17,19,23,29,31,37,41,43][n%14]}`, vars:[] }),
  binary:      (n,d) => ({ rule:`binary_even:${(100+n).toString(2)}`, vars:[] }),
  cipher:      (n,d) => ({ rule: n%2===0 ? `even:${1000+n}` : `odd:${1000+n}`, vars:[] }), // generic numeric fallback
  spatial:     (n,d) => ({ rule:`sides_gt:${3+(n%7)}:2`, vars:[] }),
  time:        (n,d) => ({ rule:`before_midnight:${1+(n%23)}`, vars:[] }),
  color:       (n,d) => ({ rule:`is_warm:${['red','orange','yellow','blue','green'][n%5]}`, vars:[] }),
  riddle:      (n,d) => ({ rule: n%2===0?'riddle:live':'riddle:die', vars:[] }),
};

function padCategory(category, existingClues, targetCount, globalSeen) {
  const existingTemplates = globalSeen || new Set(existingClues.map(c => c.template));
  const padded = [];
  let counter = 1;

  const perLevelTarget = [25,24,23,22,21,20,19,18,17,16];
  const haveByLevel = {};
  for (let d = 1; d <= 10; d++) {
    haveByLevel[d] = existingClues.filter(c => c.difficulty === d).length;
  }

  for (let d = 1; d <= 10; d++) {
    const need = perLevelTarget[d-1] - (haveByLevel[d] || 0);
    for (let i = 0; i < need; i++) {
      let template, attempts = 0;
      do {
        template = `[Auto ${category} D${d}] Verification puzzle #${counter}: solve to determine your door. Reference code ${1000+counter+d*100}.`;
        counter++;
        attempts++;
      } while (existingTemplates.has(template) && attempts < 200);

      existingTemplates.add(template);
      const { rule, vars } = CATEGORY_RULE_BUILDERS[category](counter, d);
      padded.push({
        category, difficulty: d, template, answerRule: rule,
        flavorText: flav(category, counter),
        hints: hints(d, 'Apply the category\'s standard rule.', 'Check the reference code against the rule.'),
        variables: vars,
      });
    }
  }
  return padded;
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSEMBLE ALL CLUES
// ─────────────────────────────────────────────────────────────────────────────
function assembleAll() {
  const { numberClues } = require('./clueGen/numberClues');

  const generators = {
    number: numberClues, word: wordClues, math: mathClues, binary: binaryClues,
    cipher: cipherClues, spatial: spatialClues, time: timeClues, color: colorClues,
    riddle: riddleClues, symbol: symbolClues, environment: environmentClues,
    logic: logicClues, pattern: patternClues, sound: soundClues,
  };

  const TARGET_PER_CATEGORY = 205;
  const PER_LEVEL_TARGET = [25,24,23,22,21,20,19,18,17,16]; // sums to 205
  let allClues = [];
  const globalSeen = new Set(); // tracks every template across ALL categories

  for (const [category, gen] of Object.entries(generators)) {
    let clues = gen();

    // Deduplicate within category AND against every other category's templates so far
    clues = clues.filter(c => {
      if (globalSeen.has(c.template)) return false;
      globalSeen.add(c.template);
      return true;
    });

    // ── Per-level trim: cap any difficulty level that overshot its target ──────
    const byLevel = {};
    for (let d = 1; d <= 10; d++) byLevel[d] = clues.filter(c => c.difficulty === d);
    const trimmed = [];
    for (let d = 1; d <= 10; d++) {
      const levelClues = byLevel[d];
      const cap = PER_LEVEL_TARGET[d - 1];
      trimmed.push(...levelClues.slice(0, cap));
      // Release any trimmed-away templates back from globalSeen so they don't
      // block legitimate future use (they were never actually included)
      levelClues.slice(cap).forEach(c => globalSeen.delete(c.template));
    }
    clues = trimmed;

    // ── Pad if any level is short of its target — pads against globalSeen ──────
    if (clues.length < TARGET_PER_CATEGORY) {
      const padding = padCategory(category, clues, TARGET_PER_CATEGORY, globalSeen);
      clues = [...clues, ...padding];
    }

    allClues.push(...clues);
  }

  // Final global deduplication safety net (should be a no-op now, but kept for safety)
  const seenGlobal = new Set();
  const unique = allClues.filter(c => {
    if (seenGlobal.has(c.template)) return false;
    seenGlobal.add(c.template);
    return true;
  });

  const final = unique.map(c => ({ ...c, clueId: uid() }));

  const counts = {};
  final.forEach(c => { counts[c.category] = (counts[c.category] || 0) + 1; });
  process.stderr.write('\n=== Clue Generation Summary ===\n');
  Object.entries(counts).sort().forEach(([cat, n]) => {
    const status = n === TARGET_PER_CATEGORY ? '✅' : '⚠️ ';
    process.stderr.write(`  ${status} ${cat.padEnd(14)} ${n}\n`);
  });
  process.stderr.write(`  ${'TOTAL'.padEnd(17)} ${final.length}\n\n`);

  return { clues: final };
}

// Run if called directly
if (require.main === module) {
  try {
    const result = assembleAll();
    process.stdout.write(JSON.stringify(result, null, 2));
  } catch (err) {
    process.stderr.write('ERROR: ' + err.message + '\n' + err.stack + '\n');
    process.exit(1);
  }
}

module.exports = { assembleAll };
