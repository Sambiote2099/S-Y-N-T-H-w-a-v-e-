/**
 * The three independent generation parameters from the toolbar (spec:
 * "Parameter Independence" — region, seed, and likes never reset each other).
 */

/**
 * Locale codes are intentionally just `string` (e.g. "en-US", "de-DE") and
 * are never enumerated as a hardcoded union here — the spec requires that
 * locales be addable via config alone (see lib/locales). The set of valid
 * values is validated at runtime against that config, not by the type
 * system.
 */
export type LocaleCode = string;

/**
 * Transport representation of the user's seed. Kept as a numeric string
 * rather than `number` because the spec calls for a 64-bit seed, which
 * exceeds JS's safe integer range (2^53) — see ASSUMPTIONS.md. Parsed to a
 * BigInt only inside lib/rng.
 */
export type SeedValue = string;

export interface GenerationParams {
  locale: LocaleCode;
  seed: SeedValue;
  /** Average likes per song, 0–10, fractional allowed. */
  likesAvg: number;
}

export type ViewMode = "table" | "gallery";

/**
 * A request for one "page" of data. Per the spec, a Gallery "batch" is just
 * a page under a different name, so Table and Gallery share this shape.
 */
export interface SongsPageRequest extends GenerationParams {
  page: number;
  pageSize: number;
}