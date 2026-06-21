import { getLocaleConfig } from "@/lib/locales";
import type { SongLyricLine } from "@/types/song";

type Rng = { next(): number; nextInt(max: number): number };

interface WordBank {
  adjectives: string[];
  nouns: string[];
  verbs: string[];
}

function pick(rng: Rng, arr: string[]): string {
  return arr[rng.nextInt(arr.length)];
}

function fillLyricTemplate(template: string, rng: Rng, wordBank: WordBank): string {
  return template
    .replace(/\{adjective2\}/g, pick(rng, wordBank.adjectives))
    .replace(/\{adjective\}/g, pick(rng, wordBank.adjectives))
    .replace(/\{noun2\}/g, pick(rng, wordBank.nouns))
    .replace(/\{noun\}/g, pick(rng, wordBank.nouns))
    .replace(/\{verb\}/g, pick(rng, wordBank.verbs));
}

/**
 * Generates one short, locale-aware lyric line per cue time. Words come
 * from the locale's own wordBank, not faker — see ASSUMPTIONS.md #21.
 */
export function generateLyrics(rng: Rng, localeCode: string, cueTimes: number[]): SongLyricLine[] {
  const localeConfig = getLocaleConfig(localeCode);

  return cueTimes.map((startSeconds) => {
    const template = localeConfig.lyricTemplates[rng.nextInt(localeConfig.lyricTemplates.length)];
    return { text: fillLyricTemplate(template, rng, localeConfig.wordBank), startSeconds };
  });
}