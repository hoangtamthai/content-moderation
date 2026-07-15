import { z } from "zod";
const envSchema = z.object({
  PORT: z.coerce.number().default(16113),
  HOST: z.string().default("localhost"),
  TEST_SIZE: z.coerce.number().default(50),
  LAMBDA_RULE: z.coerce.number().default(100),
  LAMBDA_EMBED: z.coerce.number().default(4),
  LAMBDA_LLM: z.coerce.number().default(1),
  WARMUP: z.coerce.number().default(10),
  SIZE: z.string().default("short"),
});

// Validate process.env
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(`Invalid .env`, z.treeifyError(parsed.error).properties);
  process.exit(1);
}

export const ENV = parsed.data;
