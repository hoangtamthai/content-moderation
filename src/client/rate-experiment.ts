import { DataSize, embedUrl, evaluateModeration, llmUrl, ruleUrl } from ".";
import type { Moderation, ModerationLabel } from "../server/moderation/base";
import { ENV } from "../share/env";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function postMessage(url: string, message: string): Promise<Moderation> {
  return fetch(url, { method: "POST", body: message }).then((r) => r.json());
}

function exponentialInterval(lambda: number): number {
  return -Math.log(Math.random()) / lambda;
}

interface Completion {
  index: number;
  arrivalTimestamp: number;
  responseTimestamp: number;
  latencyMs: number;
  method: string;
  lambda: number;
  correct: boolean;
  interArrivalMs: number;
}

async function writeJsonl(
  rows: Record<string, string | number | boolean>[],
  filePath: string,
) {
  const lines = rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
  await Bun.write(filePath, lines);
}

async function main(url: string, dataSize: DataSize, lambdaReqPerSec: number) {
  const count = ENV.TEST_SIZE;
  const warmup = ENV.WARMUP;
  let datasetSize = "unknown";
  switch (dataSize) {
    case DataSize.short:
      datasetSize = "short";
      break;
    case DataSize.medium:
      datasetSize = "medium";
      break;
    case DataSize.long:
      datasetSize = "long";
      break;
  }
  const datasetPath = dataSize;

  console.log(`Rate experiment config:
  url:     ${url}
  lambda:  ${lambdaReqPerSec} req/s
  count:   ${count}
  warmup:  ${warmup}
  dataset: ${datasetPath}
`);

  const method = url.split("/").pop() || "unknown";

  const file = Bun.file(datasetPath);
  const lines = (await file.text()).split("\n").filter(Boolean);
  const data: Moderation[] = lines.map((l) => JSON.parse(l));
  const labels: ModerationLabel[] = data;
  const messages: string[] = data.map((l) => l.message);

  if (messages.length === 0) {
    console.error("No messages loaded from dataset");
    process.exit(1);
  }

  // Warmup phase: fire at target rate, then wait for all to complete
  console.log("Warmup...");
  const warmupPromises: Promise<Moderation>[] = [];
  for (let i = 0; i < warmup; i++) {
    if (i > 0) {
      await sleep(exponentialInterval(lambdaReqPerSec) * 1000);
    }
    console.log(`Warmup ${i + 1}/${warmup}`);
    warmupPromises.push(postMessage(url, messages[i]!));
  }
  await Promise.all(warmupPromises);
  console.log(`Warmup done (${warmup} requests)\n`);

  // Test phase: fire at target Poisson rate, non-blocking
  const completions: Promise<Completion>[] = [];
  const interArrivals: number[] = [];

  for (let i = 0; i < count; i++) {
    const interArrivalMs =
      i === 0 ? 0 : exponentialInterval(lambdaReqPerSec) * 1000;
    interArrivals.push(interArrivalMs);

    if (interArrivalMs > 0) {
      await sleep(interArrivalMs);
    }

    const arrivalTimestamp = performance.now();
    const msg = messages[i];
    const label = labels[i];

    const completion = postMessage(url, msg!).then((prediction) => {
      console.log(`Request ${i + 1}/${count}`);
      const responseTimestamp = performance.now();
      return {
        index: i,
        arrivalTimestamp,
        responseTimestamp,
        latencyMs: responseTimestamp - arrivalTimestamp,
        method,
        lambda: lambdaReqPerSec,
        correct: evaluateModeration(label!, prediction),
        interArrivalMs,
      };
    });

    completions.push(completion);
  }

  const allResults = await Promise.all(completions);
  allResults.sort((a, b) => a.index - b.index);

  // Log summary
  const latencies = allResults.map((r) => r.latencyMs);
  const avgLat = latencies.reduce((s, v) => s + v, 0) / latencies.length;
  const maxLat = Math.max(...latencies);
  const totalTimeMs =
    allResults[allResults.length - 1]?.responseTimestamp! -
      allResults[0]?.arrivalTimestamp! || 0;
  const throughput = (count / totalTimeMs) * 1000;

  console.log(`\nResults:
  Samples:      ${allResults.length}
  Avg latency:  ${avgLat.toFixed(1)}ms
  Max latency:  ${maxLat.toFixed(1)}ms
  Total time:   ${totalTimeMs.toFixed(1)}ms
  Throughput:   ${throughput.toFixed(2)} req/s
`);

  // Save
  const outDir = "results2";
  await Bun.spawn(["mkdir", "-p", outDir]).exited;
  const filePath = `${outDir}/${ENV.SIZE}/rate_${method}_l${lambdaReqPerSec}.jsonl`;

  const rows = allResults.map((r) => ({
    request_id: r.index,
    arrival_timestamp: Math.round(r.arrivalTimestamp * 1000) / 1000,
    latency_ms: Math.round(r.latencyMs * 100) / 100,
    inter_arrival_ms: Math.round(r.interArrivalMs * 100) / 100,
    method: r.method,
    lambda: r.lambda,
    correct: r.correct,
  }));

  await writeJsonl(rows, filePath);
  console.log(`Saved to ${filePath}`);
}

function getSize() {
  switch (ENV.SIZE) {
    case "short":
      return DataSize.short;
    case "medium":
      return DataSize.medium;
    case "long":
      return DataSize.long;
    default:
      return DataSize.short;
  }
}
const size = getSize();
await main(ruleUrl, size, ENV.LAMBDA_RULE).catch(console.error);
await main(embedUrl, size, ENV.LAMBDA_EMBED).catch(console.error);
await main(llmUrl, size, ENV.LAMBDA_LLM).catch(console.error);
