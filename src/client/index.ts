import type { Moderation } from "../server/moderation/base";
import { ENV } from "../share/env";

// bench.js
const url = `http://${ENV.HOST}:${ENV.PORT}/moderation`;
const ruleUrl = `${url}/rule`;
const embedUrl = `${url}/embed`;
const llmUrl = `${url}/llm`;

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

async function loadData() {
  const testData = Bun.file("dataset/clean/test_short.jsonl");
  const lines = (await testData.text()).split("\n").filter(Boolean);
  const data: Moderation[] = [];
  lines.forEach((line, i) => {
    data.push(JSON.parse(line));
  });
  return data;
}

let completed = 0;
async function start() {
  // Load data to memory
  const messages = await loadData();

  console.time("Benchmarking");
  const total = messages.length;
  // const total = 5000;
  const responses = messages.map((message, i) => {
    if (i >= total) return;
    console.log(`Posting ${i + 1}/${total}`);
    return postMessage(message.message, total);
  });
}

function postMessage(message: string, total: number): Promise<Moderation> {
  return fetch(ruleUrl, {
    method: "POST",
    body: message,
  }).then(async (response) => {
    completed++;
    if (completed === total) {
      console.timeEnd("Benchmarking");
      console.log("Done");
    }
    return response.json();
  });
}

start();
