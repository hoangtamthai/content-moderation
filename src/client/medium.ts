import { DataSize, embedUrl, llmUrl, ruleUrl, start } from ".";

start(DataSize.medium, ruleUrl);
start(DataSize.medium, embedUrl);
start(DataSize.medium, llmUrl);
