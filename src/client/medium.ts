import { DataSize, embedUrl, llmUrl, ruleUrl, start } from ".";

await start(DataSize.medium, ruleUrl);
await start(DataSize.medium, embedUrl);
await start(DataSize.medium, llmUrl);
