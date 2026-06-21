import { SINGLE_LABEL, type SongSummary, type SongDetail, type SongAudio } from "@/types/song";
import type { SeedValue } from "@/types/params";
import { createRecordRngs } from "@/lib/rng";
import { getLocaleConfig, createFaker } from "@/lib/locales";
import { generateLyrics } from "./lyrics";
import { generateCoverDataUrl } from "./cover";
import { generateSongAudio } from "./music";
import { generateReviewText } from "./review";

export interface ExportSongData {
  index: number;
  title: string;
  artist: string;
  album: string;
  audio: SongAudio;
}

/**
 * Lightweight variant of generateSongDetail used only by the export
 * feature. Skips cover art (which calls a rate-limited external AI
 * service) and review text/lyrics entirely, since none of those belong in
 * an MP3 file — keeps bulk export fast and avoids hammering the free
 * cover-art API with a burst of requests.
 */
export function generateSongForExport(
  seed: SeedValue,
  locale: string,
  page: number,
  index: number,
  globalIndex: number
): ExportSongData {
  const { textFields, audioRng } = generateSongCore(seed, locale, page, index);
  const audio = generateSongAudio(audioRng);
  return { index: globalIndex, title: textFields.title, artist: textFields.artist, album: textFields.album, audio };
}

type Rng = ReturnType<typeof createRecordRngs>["contentRng"];

function generateLikes(likesRng: Rng, likesAvg: number): number {
  const floor = Math.floor(likesAvg);
  const fraction = likesAvg - floor;
  return floor + (likesRng.next() < fraction ? 1 : 0);
}

function capitalize(str: string): string {
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

interface SongCoreResult {
  textFields: Pick<SongSummary, "title" | "artist" | "album" | "genre">;
  genreIndex: number;
  contentRng: Rng;
  likesRng: Rng;
  audioRng: Rng;
}

/**
 * Generates the seed/locale-driven text fields and returns the *still-live*
 * contentRng alongside them. Called by both generateSong (list view) and
 * generateSongDetail (expanded row) — calling it with the same inputs
 * always replays the identical sequence of draws, which is what lets the
 * detail view continue drawing further values (for the cover) from exactly
 * where the summary view left off, without the two ever needing to share
 * actual runtime state.
 */
function generateSongCore(
  seed: SeedValue,
  locale: string,
  page: number,
  index: number
): SongCoreResult {
  const { contentRng, likesRng, audioRng } = createRecordRngs(seed, page, index);
  const faker = createFaker(locale, () => contentRng.next());
  const localeConfig = getLocaleConfig(locale);

  const { adjectives, nouns, verbs, adverbs } = localeConfig.wordBank;
const pickWord = (arr: string[]) => arr[Math.floor(contentRng.next() * arr.length)];

const isPersonalName = contentRng.next() < 0.6;
const artist = isPersonalName
  ? faker.person.fullName()
  : capitalize(`${pickWord(adjectives)} ${pickWord(nouns)}`);

const titlePatterns = [
  () => `${pickWord(adjectives)} ${pickWord(nouns)}`,
  () => `${pickWord(nouns)} ${pickWord(verbs)}`,
  () => `${pickWord(adverbs)} ${pickWord(verbs)}`,
  () => pickWord(nouns),
];
const titlePattern = titlePatterns[Math.floor(contentRng.next() * titlePatterns.length)];
const title = capitalize(titlePattern());

const isSingleFlag = contentRng.next() < 0.3;
const album = isSingleFlag
  ? SINGLE_LABEL
  : capitalize(`${pickWord(adjectives)} ${pickWord(nouns)}`);

  const genreIndex = Math.floor(contentRng.next() * localeConfig.genres.length);
const genre = localeConfig.genres[genreIndex];

  return { textFields: { title, artist, album, genre }, genreIndex, contentRng, likesRng, audioRng };
}

/** Generates a single SongSummary — used by the /api/songs list endpoint. */
export function generateSong(
  seed: SeedValue,
  locale: string,
  page: number,
  index: number,
  likesAvg: number,
  globalIndex: number
): SongSummary {
  const { textFields, likesRng } = generateSongCore(seed, locale, page, index);
  const likes = generateLikes(likesRng, likesAvg);
  return { index: globalIndex, ...textFields, likes };
}

/** Generates a full page of songs. Called by the list API route. */
export function generateSongsPage(
  seed: SeedValue,
  locale: string,
  page: number,
  pageSize: number,
  likesAvg: number
): SongSummary[] {
  return Array.from({ length: pageSize }, (_, i) => {
    const globalIndex = (page - 1) * pageSize + i + 1;
    return generateSong(seed, locale, page, i, likesAvg, globalIndex);
  });
}

/**
 * Generates the full SongDetail for one record — used when a Table row is
 * expanded. audio/reviewText are stubbed here; Phases 9 and 10 replace
 * them. Because cover generation happens strictly *after* the text fields
 * are already computed, nothing later in this function can ever change
 * title/artist/album/genre — preserving the independence guarantees.
 */
export async function generateSongDetail(
  seed: SeedValue,
  locale: string,
  page: number,
  index: number,
  likesAvg: number,
  globalIndex: number
): Promise<SongDetail> {
  const { textFields, genreIndex, contentRng, likesRng, audioRng } = generateSongCore(seed, locale, page, index);
  const likes = generateLikes(likesRng, likesAvg);

  const coverTitle = textFields.title;
  const coverImageUrl = await generateCoverDataUrl(contentRng, {
  title: coverTitle,
  artist: textFields.artist,
  genre: textFields.genre,
  genreIndex,
});

  const audio = generateSongAudio(audioRng);

  const reviewText = generateReviewText(contentRng, locale, {
  title: textFields.title,
  artist: textFields.artist,
  genre: textFields.genre,
});
const lyrics = generateLyrics(contentRng, locale, audio.lyricCueTimes);

  return { index: globalIndex, ...textFields, likes, coverImageUrl, audio, reviewText, lyrics };
}