import { getLlama } from "node-llama-cpp";

const nomicPath = "models/hf_nomic-ai_nomic-embed-text-v1.5.Q8_0.gguf";
const embeddingsPath = "dataset/embeddings/embeddings-nomic.json";

const llama = await getLlama();
const model = await llama.loadModel({ modelPath: nomicPath });
const context = await model.createEmbeddingContext();

export interface StoredEmbedding {
  prompt: string;
  embedding: number[];
  labels: ModerationLabel;
}

// Load cached embeddings
const storedData: StoredEmbedding[] = await Bun.file(embeddingsPath).json();
console.log(
  `Loaded ${storedData.length} embeddings (dim: ${storedData[0]?.embedding.length})`,
);

// Cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    const bi = b[i];
    if (ai && bi) {
      dot += ai * bi;
      normA += ai * ai;
      normB += bi * bi;
    }
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Find similar documents
function findSimilar(
  queryEmbedding: number[],
  topK: number = 5,
): StoredEmbedding[] {
  const similarities = storedData.map((entry, i) => ({
    i,
    sim: cosineSimilarity(queryEmbedding, entry.embedding),
  }));
  similarities.sort((a, b) => b.sim - a.sim);
  const similars = similarities.slice(0, topK).map((s) => storedData[s.i]);
  const filteredSimilars = similars.filter((s) => s !== undefined);
  return filteredSimilars;
}

import {
  defaultModeration,
  ModerationService,
  type Moderation,
  type ModerationLabel,
} from "./base";

export class EmbedModeration extends ModerationService {
  override async moderate(message: string): Promise<Moderation> {
    const queryEmbedding = await context.getEmbeddingFor(message);
    const queryVec = Array.from(queryEmbedding.vector);
    const similarSamples = findSimilar(queryVec, 5);
    const topMatch = similarSamples[0];
    let moderation = { ...defaultModeration };
    moderation.message = message;
    if (!topMatch) {
      return moderation;
    }
    moderation = { ...moderation, ...topMatch.labels };
    return moderation;
  }
}

export const embedModeration = new EmbedModeration();
