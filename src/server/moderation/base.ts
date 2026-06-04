export interface Moderation extends ModerationLabel {
  message: string;
}

export interface ModerationLabel {
  hate: boolean;
  scam: boolean;
  sexual: boolean;
  selfharm: boolean;
  violence: boolean;
}
export const defaultLabel: ModerationLabel = {
  hate: false,
  scam: false,
  sexual: false,
  selfharm: false,
  violence: false,
};

export const defaultModeration: Moderation = {
  ...defaultLabel,
  message: "",
};

export abstract class ModerationService {
  abstract moderate(message: string): Promise<Moderation>;
}
