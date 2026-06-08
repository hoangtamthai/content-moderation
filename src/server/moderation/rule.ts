import { defaultModeration, ModerationService, type Moderation } from "./base";

const hateWords = [
  "hate",
  "hates",
  "hated",
  "haters",
  "hating",
  "subhuman",
  "death to",
  "go die",
];
const violenceWords = [
  "kill",
  "killed",
  "killing",
  "killer",
  "killers",
  "murder",
  "murdered",
  "murdering",
  "murderer",
  "murderers",
];
const sexualWords = [
  "sex",
  "sexual",
  "sexy",
  "nude",
  "naked",
  "porn",
  "porno",
  "horny",
  "slut",
  "sluts",
  "fuck",
  "fucked",
  "pussy",
  "pussies",
  "cock",
  "cocks",
  "cunt",
  "dick",
];
const scamWords = [
  "scam",
  "scams",
  "scammed",
  "scamming",
  "scammer",
  "scammers",
  "buy now",
  "click this link",
  "click here",
  "call now",
  "call here",
];
const selfharmWords = [
  "self destructive behaviour",
  "kill myself",
  "suicide",
  "end my life",
  "end my own life",
  "end myself",
  "hate myself",
];

const safePhrases = [
  "kill child process",
  "kill children process",
  "kill process",
  "kill processes",
  "delete child",
  "delete process",
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .trim();
}

class RuleModeration extends ModerationService {
  override moderate(message: string): Promise<Moderation> {
    console.log(`Rule: ${message}`);
    const moderation = { ...defaultModeration, message };
    const normalizedMessage = normalize(message);
    hateWords.forEach((word) => {
      if (normalizedMessage.includes(word)) {
        moderation.hate = true;
      }
    });
    violenceWords.forEach((word) => {
      if (normalizedMessage.includes(word)) {
        moderation.violence = true;
      }
    });
    sexualWords.forEach((word) => {
      if (normalizedMessage.includes(word)) {
        moderation.sexual = true;
      }
    });
    scamWords.forEach((word) => {
      if (normalizedMessage.includes(word)) {
        moderation.scam = true;
      }
    });
    selfharmWords.forEach((word) => {
      if (normalizedMessage.includes(word)) {
        moderation.selfharm = true;
      }
    });
    safePhrases.forEach((phrase) => {
      if (normalizedMessage.includes(phrase)) {
        moderation.sexual = false;
        moderation.scam = false;
        moderation.violence = false;
        moderation.hate = false;
      }
    });
    for (const word of scamWords) {
      if (normalizedMessage.includes(word)) {
        moderation.scam = true;
      }
    }
    return Promise.resolve(moderation);
  }
}

export const ruleModeration = new RuleModeration();
