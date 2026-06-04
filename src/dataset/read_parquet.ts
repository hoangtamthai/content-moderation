import { asyncBufferFromFile, parquetReadObjects } from "hyparquet";
import { defaultLabel, type Moderation } from "../server/moderation/base";

export interface QAModerationEntry {
  question: string;
  context: string;
  answers: {
    text: string;
    answer_start: number;
  };
  id: string;
}
const LabelNum: Record<number, string> = {
  0: "safe",
  1: "harassment",
  2: "hate",
  3: "threat",
  4: "profanity",
  5: "violence",
  7: "sexual",
  9: "self_harm",
  11: "illegal_weapons",
  13: "sexual_minor",
};
const LabelText: Record<string, string> = {
  safe: "safe",
  harassment: "harassment",
  hate: "hate",
  threat: "threat",
  profanity: "profanity",
  violence: "violence",
  pii_privacy: "pii_privacy",
  sexual: "sexual",
  self_harm: "self_harm",
  sexual_minor: "sexual_minor",
  criminal_planning: "criminal_planning",
  needs_caution: "needs_caution",
  controlled_substances: "controlled_substances",
  illegal_weapons: "illegal_weapons",
  other: "other",
};

const file = await asyncBufferFromFile(
  "dataset/original/qa_moderation/train.parquet",
);
const testFile = await asyncBufferFromFile(
  "dataset/original/qa_moderation/test.parquet",
);
const data = await parquetReadObjects({ file });
const testData = await parquetReadObjects({ file: testFile });

console.log("First 5 rows:");
export function readQaParquet() {
  console.log(`Total rows: ${data.length}\n`);
  const trainModeration = parseData(data);
  const testModeration = parseData(testData);
  return [...trainModeration, ...testModeration];
}

function parseData(data: Record<string, any>[]) {
  return data.map((entry, index) => {
    console.log(`Processing ${index + 1}/${data.length}`);
    const obj: QAModerationEntry = entry as QAModerationEntry;
    const message = obj.context.match(/Comment:\s*(.*)/)?.[1];
    if (!message) return;
    const match = obj.answers.text.match(/^(\d+): (.*),/);
    if (!match) return;
    const [, labelNum, labelText] = match;
    const label = LabelText[labelText!];
    if (!label) return;
    defaultLabel.hate = label === "hate" || label === "harassment";
    defaultLabel.selfharm = label === "self_harm";
    defaultLabel.violence =
      label === "violence" ||
      label === "threat" ||
      label === "illegal_weapons" ||
      label === "criminal_planning";
    defaultLabel.sexual = label === "sexual" || label === "sexual_minor";
    const moderation: Moderation = {
      message,
      ...defaultLabel,
    };
    return moderation;
  });
}
let a = 0;
for (let i = 0; i < testData.length; i++) {
  const entry = testData[i];
  if (entry === undefined) {
    console.log("undefined entry", entry);
    continue;
  }
  const obj: QAModerationEntry = entry as QAModerationEntry;
  const message = obj.context.match(/Comment:\s*(.*)/)?.[1];
  // console.log("question:", obj.question);
  // console.log("context", obj.context);
  // console.log(message);
  // console.log("answers", obj.answers.text);
  const match = obj.answers.text.match(/^(\d+):([^,]+)/);
  if (!match) {
    console.log("no match", match);
    continue;
  }
  const [, labelNum, labelText] = match;
  // console.log(labelNum);
  // console.log(labelText?.trim());
  const label = LabelText[labelText?.trim()!];
  if (!label) {
    console.log("no label", labelText);
    continue;
  }
  // console.log(label);
  a++;
  // console.log("---");
}
console.log(a, testData.length);

// Show row count
