import type { Moderation, ModerationLabel } from "../server/moderation/base";
import { ENV } from "../share/env";

const baseUrl = `http://${ENV.HOST}:${ENV.PORT}/moderation`;
export const ruleUrl = `${baseUrl}/rule`;
export const embedUrl = `${baseUrl}/embed`;
export const llmUrl = `${baseUrl}/llm`;

export enum DataSize {
  short = "dataset/clean/test_short.jsonl",
  medium = "dataset/clean/test_medium.jsonl",
  long = "dataset/clean/test_long.jsonl",
}

export async function loadData(dataSize: DataSize) {
  const testData = Bun.file(dataSize);
  const lines = (await testData.text()).split("\n").filter(Boolean);
  const data: Moderation[] = [];
  lines.forEach((line) => {
    data.push(JSON.parse(line));
  });
  return data;
}

async function postMessage(url: string, message: string): Promise<Moderation> {
  const response = await fetch(url, {
    method: "POST",
    body: message,
  });
  return response.json();
}

async function writeJsonl(
  rows: Record<string, string | number | boolean>[],
  filePath: string,
) {
  const lines = rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
  await Bun.write(filePath, lines);
}

export async function start(dataSize: DataSize, url: string) {
  const items = await loadData(dataSize);
  const total = Math.min(ENV.TEST_SIZE, items.length);
  const method = url.split("/").pop() || "unknown";
  const sizeLabel =
    dataSize.split("/").pop()?.replace(".jsonl", "") || "unknown";

  console.time(`Benchmarking ${url}`);

  const results = await Promise.all(
    items.slice(0, total).map(async (item) => {
      const startTime = performance.now();
      const prediction = await postMessage(url, item.message);
      const latencyMs = performance.now() - startTime;

      return {
        message: item.message,
        gt_hate: item.hate,
        gt_scam: item.scam,
        gt_sexual: item.sexual,
        gt_selfharm: item.selfharm,
        gt_violence: item.violence,
        pred_hate: prediction.hate,
        pred_scam: prediction.scam,
        pred_sexual: prediction.sexual,
        pred_selfharm: prediction.selfharm,
        pred_violence: prediction.violence,
        latency_ms: Math.round(latencyMs * 100) / 100,
        method,
        data_size: sizeLabel,
      };
    }),
  );

  console.timeEnd(`Benchmarking ${url}`);

  const outDir = "results";
  await Bun.spawn(["mkdir", "-p", outDir]).exited;
  const filePath = `${outDir}/${sizeLabel}_${method}.jsonl`;
  await writeJsonl(results, filePath);
  console.log("Results saved to", filePath);
}

// At least one of the label match is correct if there is some but if there is none, then all must not match
export function evaluateModeration(
  originalLabel: ModerationLabel,
  predictedLabel: ModerationLabel,
) {
  const isNotFlagged =
    originalLabel.hate === false &&
    originalLabel.scam === false &&
    originalLabel.sexual === false &&
    originalLabel.selfharm === false &&
    originalLabel.violence === false;
  if (isNotFlagged) {
    return predictedLabel.hate === false &&
      predictedLabel.scam === false &&
      predictedLabel.sexual === false &&
      predictedLabel.selfharm === false &&
      predictedLabel.violence === false;
  }

  switch (true) {
    case originalLabel.hate === true && predictedLabel.hate === true:
    case originalLabel.scam === true && predictedLabel.scam === true:
    case originalLabel.sexual === true && predictedLabel.sexual === true:
    case originalLabel.selfharm === true && predictedLabel.selfharm === true:
    case originalLabel.violence === true && predictedLabel.violence === true:
      return true;
  }
  return false;
}
