import {
  defaultLabel,
  type Moderation,
  type ModerationLabel,
} from "../server/moderation/base";
import { readQaParquet } from "./read_parquet";

export interface ModerationEntry {
  text: string;
  result: {
    categories: {
      harassment: boolean;
      "harassment-threatening": boolean;
      hate: boolean;
      "hate-threatening": boolean;
      "self-harm": boolean;
      "self-harm-instructions": boolean;
      "self-harm-intent": boolean;
      sexual: boolean;
      "sexual-minors": boolean;
      violence: boolean;
      "violence-graphic": boolean;
    };
  };
}
export interface SampleEntry {
  prompt: string;
  S: number; // suicide
  H: number; // hate
  V: number; // violence
  HR: number; // harassment
  SH: number; // self harm
  S3: number; // sexual
  H2: number; // hate
  V2: number; // violence
}

console.log("Preprocessing...");
// MODERATION 70k Dataset
const moderation70k = Bun.file("dataset/original/moderation_70k.jsonl");
const moderationsLines = (await moderation70k.text())
  .split("\n")
  .filter((l) => l.trim());
const moderationEntries = moderationsLines.map((line, i) => {
  console.log(`Preprocessing ${i + 1}/${moderationsLines.length}`);
  const label: ModerationLabel = defaultLabel;
  const moderationData: ModerationEntry = JSON.parse(line);
  const categories = moderationData.result.categories;
  label.hate = categories.hate || categories["hate-threatening"];
  label.selfharm =
    categories["self-harm"] ||
    categories["self-harm-instructions"] ||
    categories["self-harm-intent"];
  label.violence =
    categories.violence ||
    categories["violence-graphic"] ||
    categories.harassment ||
    categories["harassment-threatening"];
  label.sexual = categories.sexual || categories["sexual-minors"];
  const moderation: Moderation = {
    message: moderationData.text,
    ...label,
  };
  return moderation;
});

// SAMPLE 1680 Dataset
const sample1680 = Bun.file("dataset/original/samples-1680.jsonl");
const sampleLines = (await sample1680.text())
  .split("\n")
  .filter((l) => l.trim());
const sampleEntries = sampleLines.map((line, i) => {
  console.log(`Preprocessing ${i + 1}/${sampleLines.length}`);
  const label: ModerationLabel = defaultLabel;
  const sample: SampleEntry = JSON.parse(line);
  label.selfharm = sample.S === 1 || sample.SH === 1;
  label.hate = sample.H === 1 || sample.H2 === 1;
  label.violence = sample.V === 1 || sample.V2 === 1 || sample.HR === 1;
  label.sexual = sample.S3 === 1;
  const moderation: Moderation = {
    message: sample.prompt,
    ...label,
  };
  return moderation;
});

// SCAM Dataset
const scam = Bun.file("dataset/original/scam/Scam-Data.csv");
const scamLines = (await scam.text()).split("\n").filter((l) => l.trim());
const scamEntries = scamLines
  .map((line, i) => {
    console.log(`Preprocessing ${i + 1}/${scamLines.length}`);
    const [id, text, label] = line.split(",");
    const moderationLabel = defaultLabel;
    if (text && label) {
      moderationLabel.scam = label === "1";
      const moderation: Moderation = {
        message: text || "",
        ...moderationLabel,
      };
      return moderation;
    }
    return;
  })
  .filter((entry) => entry != undefined);

// SPAM Dataset
const spam = Bun.file("dataset/original/scam/spam.csv");
const spamLines = (await spam.text()).split("\n").filter((l) => l.trim());
const spamEntries = spamLines
  .map((line, i) => {
    console.log(`Preprocessing ${i + 1}/${spamLines.length}`);
    const [label, text] = line.split(",");
    const moderationLabel = defaultLabel;
    if (text && label) {
      moderationLabel.scam = label === "spam";
      const moderation: Moderation = {
        message: text || "",
        ...moderationLabel,
      };
      return moderation;
    }
    return;
  })
  .filter((entry) => entry != undefined);

const qaEntries = readQaParquet();
const entries = [
  ...moderationEntries,
  ...sampleEntries,
  ...scamEntries,
  ...spamEntries,
  ...qaEntries,
];
const jsonl =
  entries
    .filter((row) => row != undefined)
    .map((row) => JSON.stringify(row))
    .join("\n") + "\n";
await Bun.write("dataset/clean/full_sample.jsonl", jsonl);
