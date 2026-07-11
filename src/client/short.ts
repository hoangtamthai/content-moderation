import { DataSize, embedUrl, llmUrl, ruleUrl, start } from ".";

await start(DataSize.short, ruleUrl);
await start(DataSize.short, embedUrl);
await start(DataSize.short, llmUrl);
