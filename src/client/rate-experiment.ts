import { DataSize, embedUrl, evaluateModeration, llmUrl, ruleUrl } from ".";
import type { Moderation, ModerationLabel } from "../server/moderation/base";
import { ENV } from "../share/env";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postMessage(url: string, message: string): Promise<Moderation> {
  const response = await fetch(url, {
    method: "POST",
    body: message,
  });
  return response.json();
}

function exponentialInterval(lambda: number): number {
  return -Math.log(Math.random()) / lambda;
}

async function writeJsonl(
  rows: Record<string, string | number | boolean | number[]>[],
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
    default:
      console.error("Invalid data size");
      process.exit(1);
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
  const data: Moderation[] = lines.map((line) => {
    return JSON.parse(line);
  });
  const labels: ModerationLabel[] = data.map((l) => l);
  const messages: string[] = data.map((l) => l.message);

  if (messages.length === 0) {
    console.error("No messages loaded from dataset");
    process.exit(1);
  }

  const totalRuns = warmup + count;

  const results: Record<string, string | number | boolean | number[]>[] = [];
  let requestIdx = 0;

  let warmupIndex = 0;
  for (let i = 0; i < totalRuns; i++) {
    const isWarmup = i < warmup;
    const index = isWarmup ? warmupIndex : i - warmup;
    const msg = messages[index]!;
    const interArrivalMs =
      i === 0 ? 0 : exponentialInterval(lambdaReqPerSec) * 1000;

    if (interArrivalMs > 0) {
      await sleep(interArrivalMs);
    }

    const arrivalTimestamp = performance.now();
    const prediction = await postMessage(url, msg);
    const responseTimestamp = performance.now();

    const serviceTimeMs = responseTimestamp - arrivalTimestamp;

    console.log(
      `[${isWarmup ? "WARMUP" : "SAMPLE"}] req=${i + 1}/${totalRuns} ` +
        `interArrival=${interArrivalMs.toFixed(1)}ms ` +
        `service=${serviceTimeMs.toFixed(1)}ms`,
    );

    if (!isWarmup) {
      results.push({
        request_id: requestIdx++,
        arrival_timestamp: arrivalTimestamp,
        latency_ms: Math.round(serviceTimeMs * 100) / 100,
        inter_arrival_ms: Math.round(interArrivalMs * 100) / 100,
        method,
        lambda: lambdaReqPerSec,
        correct: evaluateModeration(labels[index]!, prediction),
        // original: JSON.stringify(labels[index]!),
        // prediction: JSON.stringify(prediction),
      });
    }
    warmupIndex++;
  }

  const outDir = "results";
  await Bun.spawn(["mkdir", "-p", outDir]).exited;
  const filePath = `${outDir}/${datasetSize}/rate_${method}_${datasetSize}_l${lambdaReqPerSec}_${new Date().getTime()}.jsonl`;
  await writeJsonl(results, filePath);

  console.log(`\nDone. ${results.length} samples saved to ${filePath}`);

  const avgLatency =
    results.reduce((s, r) => s + (r.latency_ms as number), 0) / results.length;
  console.log(`Average latency: ${avgLatency.toFixed(2)}ms`);
  console.log(`Effective throughput: ${lambdaReqPerSec} req/s (target)`);
}

await main(ruleUrl, DataSize.medium, ENV.LAMBDA_RULE).catch(console.error);
// await main(embedUrl, DataSize.medium, ENV.LAMBDA_EMBED).catch(console.error);
// await main(llmUrl, DataSize.medium, ENV.LAMBDA_LLM).catch(console.error);
