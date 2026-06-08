import { ENV } from "../share/env";
import { embedModeration } from "./moderation/embed";
import { llmModeration } from "./moderation/llm";
import { ruleModeration } from "./moderation/rule";

Bun.serve({
  port: ENV.PORT,
  routes: {
    "/": {
      async GET(request) {
        return new Response("Content moderation server");
      },
    },
    "/moderation/rule": {
      async POST(request) {
        const message = await request.text();
        const moderation = await ruleModeration.moderate(message);
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
        const moderation = await llmModeration.moderate(message);
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
        const moderation = await embedModeration.moderate(message);
        return new Response(JSON.stringify(moderation), {
          headers: {
            "Content-Type": "application/json",
          },
        });
      },
    },
  },
});

console.log(`Moderation server started at 0.0.0.0:${ENV.PORT}`);
