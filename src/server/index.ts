import { ENV } from "../share/env";
import { EmbedModeration } from "./moderation/embed";
import { LlmModeration } from "./moderation/llm";
import { RuleModeration } from "./moderation/rule";

Bun.serve({
  port: ENV.PORT,
  routes: {
    "/moderation/rule": {
      async POST(request) {
        const message = await request.text();
        const service = new RuleModeration();
        const moderation = service.moderate(message);
        return new Response(JSON.stringify(moderation), {
          headers: {
            "Content-Type": "application/json",
          },
        });
      },
    },
    "/moderation/llm": {
      async POST(request) {
        const message = await request.text();
        const service = new LlmModeration();
        const moderation = service.moderate(message);
        return new Response(JSON.stringify(moderation), {
          headers: {
            "Content-Type": "application/json",
          },
        });
      },
    },
    "/moderation/embed": {
      async POST(request) {
        const message = await request.text();
        const service = new EmbedModeration();
        const moderation = service.moderate(message);
        return new Response(JSON.stringify(moderation), {
          headers: {
            "Content-Type": "application/json",
          },
        });
      },
    },
  },
  fetch(request) {
    return new Response("Hello from Bun!");
  },
});

console.log(`Moderation server started at 0.0.0.0:${ENV.PORT}`);
