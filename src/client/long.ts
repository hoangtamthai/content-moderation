import { DataSize, embedUrl, llmUrl, ruleUrl, start } from ".";

start(DataSize.long, ruleUrl);
start(DataSize.long, embedUrl);
start(DataSize.long, llmUrl);
