import { z } from "zod";
const envSchema = z.object({
  PORT: z.coerce.number().default(16113),
  HOST: z.string().default("localhost"),
});

// Validate process.env
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(`Invalid .env`, z.treeifyError(parsed.error).properties);
  process.exit(1);
}

export const ENV = parsed.data;
