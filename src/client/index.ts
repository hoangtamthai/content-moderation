import type { Moderation } from "../server/moderation/base";
import { ENV } from "../share/env";

// bench.js
const baseUrl = `http://${ENV.HOST}:${ENV.PORT}/moderation`;
export const ruleUrl = `${baseUrl}/rule`;
export const embedUrl = `${baseUrl}/embed`;
export const llmUrl = `${baseUrl}/llm`;

// export enum URL_PATH {
//   rule = `http://${ENV.HOST}`,
//   embed = embedUrl,
//   llm = llmUrl,
// }

const messages = [
  "I don't want to be here",
  "I hate you so much",
  "I'm so angry",
  "That shirt looks nice",
  "Why are you so violent",
  "That's a bad idea",
  "I'm so sad",
  "That's a terrible idea",
  "I'm so scared",
];
export enum DataSize {
  short = "dataset/clean/test_short.jsonl",
  medium = "dataset/clean/test_medium.jsonl",
  long = "dataset/clean/test_long.jsonl",
}

export async function loadData(dataSize: DataSize) {
  const testData = Bun.file(dataSize);
  const lines = (await testData.text()).split("\n").filter(Boolean);
  const data: Moderation[] = [];
  lines.forEach((line, i) => {
    data.push(JSON.parse(line));
  });
  return data;
}

export async function start(dataSize: DataSize, url: string) {
  // Load data to memory
  const messages = await loadData(dataSize);

  console.time(`Benchmarking ${url}`);
  // const total = messages.length;
  const total = ENV.TEST_SIZE;
  console.time(`Send ${url}`);
  const responses = messages.map((message, i) => {
    if (i >= total) {
      console.timeEnd(`Send ${url}`);
      return;
    }
    // console.log(`Posting ${i + 1}/${total}`);
    const start = performance.now();
    const response = postMessage(url, message.message, i + 1, total);
  });
}

function postMessage(
  url: string,
  message: string,
  current: number,
  total: number,
): Promise<Moderation> {
  return fetch(url, {
    method: "POST",
    body: message,
  }).then(async (response) => {
    current++;
    if (current === total) {
      console.timeEnd(`Benchmarking ${url}`);
      console.log("Done");
    }
    return response.json();
  });
}

// start(DataSize.short);
