import { DataSize, embedUrl, llmUrl, ruleUrl, start } from ".";

await start(DataSize.long, ruleUrl);
await start(DataSize.long, embedUrl);
await start(DataSize.long, llmUrl);
