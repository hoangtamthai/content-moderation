import { fileURLToPath } from "bun";
import { getLlama } from "node-llama-cpp";
import path from "path";
import type { Moderation, ModerationLabel } from "./server/moderation/base";

interface StoredEmbedding {
  prompt: string;
  embedding: number[];
  labels: ModerationLabel;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const nomicPath = path.join(
  projectRoot,
  "models/hf_nomic-ai_nomic-embed-text-v1.5.Q8_0.gguf",
);
const qwenPath = path.join(
  projectRoot,
  "models/hf_Qwen_Qwen3-Embedding-4B.Q4_K_M.gguf",
);
const qwen06Path = path.join(
  projectRoot,
  "models/hf_Qwen_Qwen3-Embedding-0.6B.Q8_0.gguf",
);
const bgePath = path.join(
  projectRoot,
  "models/hf_ggml-org_bge-small-en-v1.5-Q8_0.Q8_0.gguf",
);
const jsonlPath = path.join(projectRoot, "dataset/clean/train.jsonl");
const modelMetas = [
  {
    path: nomicPath,
    name: "nomic",
    outputPath: path.join(
      projectRoot,
      "dataset/embeddings/embeddings-nomic.json",
    ),
  },
  // {
  //   path: qwen06Path,
  //   name: "qwen06",
  //   outputPath: path.join(
  //     projectRoot,
  //     "dataset/embeddings/embeddings-qwen06.json",
  //   ),
  // },
  // {
  //   path: bgePath,
  //   name: "bge",
  //   outputPath: path.join(projectRoot, "dataset/embeddings/embeddings-bge.json"),
  // },
];

const llama = await getLlama({
  gpu: "cuda",
});
const models = await Promise.all(
  modelMetas.map(async (model) => {
    console.log("Model:", model.name);
    console.log("Input:", model.path);
    console.log("Output:", model.outputPath);
    const llamaModel = await llama.loadModel({ modelPath: model.path });
    const context = await llamaModel.createEmbeddingContext();
    return {
      ...model,
      context: context,
    };
  }),
);
// Check if embeddings already exist

const file = Bun.file(jsonlPath);
const lines = (await file.text()).split("\n").filter((l) => l.trim());

for (const model of models) {
  const outputFile = Bun.file(model.outputPath);
  if (await outputFile.exists()) {
    await outputFile.delete();
  }
  const writer = outputFile.writer();
  await writer.write("[");
  console.log(`Building embeddings for ${model.name}...`);
  let count = 0;
  for (const line of lines) {
    try {
      // if (count > 100) {
      //   break;
      // }
      const sample: Moderation = JSON.parse(line);
      const embeddingObj = await model.context.getEmbeddingFor(sample.message);
      count++;
      console.log(`Processed ${count} / ${lines.length} lines`);
      const embedding: StoredEmbedding = {
        prompt: sample.message,
        embedding: Array.from(embeddingObj.vector),
        labels: {
          hate: sample.hate,
          scam: sample.scam,
          sexual: sample.sexual,
          selfharm: sample.selfharm,
          violence: sample.violence,
        },
      };
      await writer.write(JSON.stringify(embedding));
      if (count < lines.length) {
        await writer.write(",");
      }
    } catch (e) {
      console.error("Error:", e);
    }
  }
  writer.write("\n]");
  await writer.end();
  console.log(`Saved ${count} embeddings`);
}

async function writeJson(path: string, data: StoredEmbedding[]) {
  console.log(`Saving ${data.length} embeddings...`);
  const writer = file.writer();
  writer.write("[");
  for (let i = 0; i < data.length; i++) {
    writer.write(JSON.stringify(data[i]));
    if (i < data.length - 1) {
      writer.write(",");
    }
  }
  writer.write("\n]");

  await writer.end();
  console.log(`Saved ${data.length} embeddings`);
}
