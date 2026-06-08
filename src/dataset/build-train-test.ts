import { mkdirSync } from "fs";
import { defaultLabel } from "../server/moderation/base";

const INPUT = "dataset/clean/full_sample.jsonl";
const OUT = "dataset/clean";
const TARGET = 5000;
const CONCAT_TARGET_LENGTH = 1100;

interface Entry {
  line: string;
  idx: number;
  obj: {
    message: string;
    hate: boolean;
    scam: boolean;
    sexual: boolean;
    selfharm: boolean;
    violence: boolean;
  };
}

const text = await Bun.file(INPUT).text();
const fullLines = text.trim().split("\n").filter(Boolean);
console.log(`Full sample: ${fullLines.length} entries`);

const short: Entry[] = [];
const medium: Entry[] = [];
const longArr: Entry[] = [];

for (let i = 0; i < fullLines.length; i++) {
  const obj = JSON.parse(fullLines[i]!);
  const len = (obj.message ?? "").length;
  const entry: Entry = { line: fullLines[i]!, idx: i, obj };
  if (len >= 10 && len <= 100) short.push(entry);
  else if (len > 100 && len <= 1000) medium.push(entry);
  else if (len > 1000) longArr.push(entry);
}

console.log(
  `Available: short=${short.length}, medium=${medium.length}, long=${longArr.length}`,
);

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i]!, a[j]!] = [a[j]!, a[i]!];
  }
  return a;
}

const usedIndices = new Set<number>();

// short
const pickedShort = shuffle(short).slice(0, TARGET);
for (const e of pickedShort) usedIndices.add(e.idx);
const testShortLines = pickedShort.map((e) => e.line);

// medium
const pickedMedium = shuffle(medium).slice(0, TARGET);
for (const e of pickedMedium) usedIndices.add(e.idx);
const testMediumLines = pickedMedium.map((e) => e.line);

// long
// Only get 10% of real long entries for test, keep the remaining for train
const pickedLong = shuffle(longArr).slice(0, Math.floor(longArr.length / 10));
for (const e of pickedLong) usedIndices.add(e.idx);
const testLongLines = pickedLong.map((e) => e.line);
const realLongCount = pickedLong.length;

// If not enough real long entries, concatenate from remaining pool
const needed = TARGET - testLongLines.length;
if (needed > 0) {
  const concatPool = shuffle([
    ...short.filter((e) => !usedIndices.has(e.idx)),
    ...medium.filter((e) => !usedIndices.has(e.idx)),
  ]);
  console.log(`Concat pool for long: ${concatPool.length} entries`);

  let poolIdx = 0;
  while (testLongLines.length < TARGET && poolIdx < concatPool.length) {
    const parts: string[] = [];
    const labels = defaultLabel; 
    let totalLen = 0;

    while (totalLen < CONCAT_TARGET_LENGTH && poolIdx < concatPool.length) {
      const entry = concatPool[poolIdx]!;
      usedIndices.add(entry.idx);
      poolIdx++;
      parts.push(entry.obj.message);
      totalLen += entry.obj.message.length;
      labels.hate ||= entry.obj.hate;
      labels.scam ||= entry.obj.scam;
      labels.sexual ||= entry.obj.sexual;
      labels.selfharm ||= entry.obj.selfharm;
      labels.violence ||= entry.obj.violence;
    }

    testLongLines.push(
      JSON.stringify({ message: parts.join("\n\n---\n\n"), ...labels }),
    );
  }
}

console.log(
  `  Test long: ${testLongLines.length} (${realLongCount} real + ${testLongLines.length - realLongCount} concatenated)`,
);

// Train = everything in full_sample not at a used index
const testContentSet = new Set([
  ...testShortLines,
  ...testMediumLines,
  ...testLongLines,
]);
const trainLines = fullLines.filter((line, i) => {
  if (usedIndices.has(i)) return false;
  if (testContentSet.has(line)) return false; // catch duplicate content
  return true;
});

// Write output
mkdirSync(OUT, { recursive: true });
await Bun.write(`${OUT}/train.jsonl`, trainLines.join("\n") + "\n");
await Bun.write(`${OUT}/test_short.jsonl`, testShortLines.join("\n") + "\n");
await Bun.write(`${OUT}/test_medium.jsonl`, testMediumLines.join("\n") + "\n");
await Bun.write(`${OUT}/test_long.jsonl`, testLongLines.join("\n") + "\n");
await Bun.write(`${OUT}/used_indices.json`, JSON.stringify([...usedIndices]));

console.log(`Wrote:`);
console.log(`- train.jsonl:          ${trainLines.length} entries`);
console.log(`- test_short.jsonl:     ${testShortLines.length} entries`);
console.log(`- test_medium.jsonl:    ${testMediumLines.length} entries`);
console.log(
  `- test_long.jsonl:      ${testLongLines.length} (${realLongCount} real + ${testLongLines.length - realLongCount} concat)`,
);
console.log(
  `- Total test:           ${testShortLines.length + testMediumLines.length + testLongLines.length}`,
);
console.log(
  `- Used lines / total:   ${usedIndices.size} / ${fullLines.length} (${((usedIndices.size / fullLines.length) * 100).toFixed(2)}%)`,
);
