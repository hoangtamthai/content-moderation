import { defaultModeration, ModerationService, type Moderation } from "./base";

export class LlmModeration extends ModerationService {
  override moderate(message: string): Moderation {
    const moderation = defaultModeration;
    moderation.message = message;
    if (message.includes("hate")) {
      moderation.hate = true;
    }
    if (message.includes("violence")) {
      moderation.violence = true;
    }
    return moderation;
  }
}
