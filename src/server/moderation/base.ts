export interface Moderation {
  hate: boolean;
  violence: boolean;
  spam: boolean;
  profanity: boolean;
  message: string;
}
export const defaultModeration: Moderation = {
  hate: false,
  violence: false,
  spam: false,
  profanity: false,
  message: "",
};

export abstract class ModerationService {
  abstract moderate(message: string): Moderation;
}
