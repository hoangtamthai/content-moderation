import { ENV } from "../share/env";

// bench.js
const url = `http://${ENV.HOST}:${ENV.PORT}/moderation`;
const ruleUrl = `${url}/rule`;
const requests = 10000;
let completed = 0;

const messages = ["Hello", "World", "Bun"];

console.time("Benchmarking");
for (let i = 0; i < requests; i++) {
  for (let j = 0; j < messages.length; j++) {
    const message = messages[j];
    if (message) sendMessage(message);
  }
}

function sendMessage(message: string) {
  fetch(ruleUrl, {
    method: "POST",
    body: message,
  }).then((response) => {
    completed++;
    if (completed === requests) {
      console.timeEnd("Benchmarking");
      console.log("Done");
    }
  });
}
