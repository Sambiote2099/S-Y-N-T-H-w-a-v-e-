import { getLocaleConfig } from "@/lib/locales";

type Rng = { next(): number; nextInt(max: number): number };

interface SongTextFields {
  title: string;
  artist: string;
  genre: string;
}

interface WordBank {
  adjectives: string[];
  nouns: string[];
  verbs: string[];
}

function pick(rng: Rng, arr: string[]): string {
  return arr[rng.nextInt(arr.length)];
}

function fillTemplate(template: string, rng: Rng, wordBank: WordBank, song: SongTextFields): string {
  return template
    .replace(/\{title\}/g, song.title)
    .replace(/\{artist\}/g, song.artist)
    .replace(/\{genre\}/g, song.genre)
    .replace(/\{adjective2\}/g, pick(rng, wordBank.adjectives))
    .replace(/\{adjective\}/g, pick(rng, wordBank.adjectives))
    .replace(/\{noun2\}/g, pick(rng, wordBank.nouns))
    .replace(/\{noun\}/g, pick(rng, wordBank.nouns))
    .replace(/\{verb\}/g, pick(rng, wordBank.verbs));
}

/**
 * Generates a short, locale-aware review blurb from two distinct templates
 * defined in that locale's config. Words come from the locale's own
 * wordBank, not faker — see ASSUMPTIONS.md #21 for why.
 */
export function generateReviewText(rng: Rng, localeCode: string, song: SongTextFields): string {
  const localeConfig = getLocaleConfig(localeCode);
  const templates = localeConfig.reviewTemplates;

  const firstIndex = rng.nextInt(templates.length);
  let secondIndex = rng.nextInt(templates.length);
  if (templates.length > 1) {
    while (secondIndex === firstIndex) secondIndex = rng.nextInt(templates.length);
  }

  const sentence1 = fillTemplate(templates[firstIndex], rng, localeConfig.wordBank, song);
  const sentence2 = fillTemplate(templates[secondIndex], rng, localeConfig.wordBank, song);
  return `${sentence1} ${sentence2}`;
}