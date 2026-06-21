import { Faker, en_US, en, de, uk, type LocaleDefinition } from "@faker-js/faker";

import enUS from "./en-US.json";
import deDE from "./de-DE.json";
import ukUA from "./uk-UA.json";

export interface LocaleConfig {
  displayName: string;
  fakerLocale: string;
  genres: string[];
  reviewTemplates: string[];
  lyricTemplates: string[];
  wordBank: {
    adjectives: string[];
    nouns: string[];
    verbs: string[];
    adverbs: string[];
  };
}

/** All supported locales. Add new ones here (+ a matching JSON file). */
const LOCALE_CONFIGS: Record<string, LocaleConfig> = {
  "en-US": enUS,
  "de-DE": deDE,
  "uk-UA": ukUA,
};

/** Maps the fakerLocale string from the JSON to the actual faker locale object. */
const FAKER_LOCALE_MAP: Record<string, LocaleDefinition[]> = {
  en_US: [en_US, en],
  de:    [de, en],
  uk:    [uk, en],
};

export function getSupportedLocales(): { code: string; displayName: string }[] {
  return Object.entries(LOCALE_CONFIGS).map(([code, cfg]) => ({
    code,
    displayName: cfg.displayName,
  }));
}

export function getLocaleConfig(localeCode: string): LocaleConfig {
  const config = LOCALE_CONFIGS[localeCode];
  if (!config) throw new Error(`Unsupported locale: ${localeCode}`);
  return config;
}

/**
 * Creates a Faker instance for the given locale, driven by our own RNG.
 * Passing `randomizer` means faker never calls Math.random() — it uses our
 * splitmix64 stream instead, so all faker output is deterministic from our seed.
 */
export function createFaker(localeCode: string, rngNext: () => number): Faker {
  const config = getLocaleConfig(localeCode);
  const locales = FAKER_LOCALE_MAP[config.fakerLocale];
  if (!locales) throw new Error(`No faker locale mapping for: ${config.fakerLocale}`);

  return new Faker({
    locale: locales,
    randomizer: {
      next: rngNext,
      seed: () => {}, // no-op — we control the seed externally via splitmix64
    },
  });
}