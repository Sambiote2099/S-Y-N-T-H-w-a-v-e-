import type { SeedValue } from "@/types/params";
import { createSplitmix64 } from "./splitmix64";

const MASK64 = 0xFFFFFFFFFFFFFFFFn;

// Two different salts so the content and likes streams never correlate,
// even when seeded from the same base value.
const CONTENT_SALT = 0x1234567890abcdefn;
const LIKES_SALT   = 0xfedcba0987654321n;
const AUDIO_SALT = 0xa5a5a5a5a5a5a5a5n;
/**
 * Combines the user's seed with the page number using a Multiply-Add (MAD)
 * operation, as suggested by the spec. The exact multiplier doesn't matter
 * much as long as it's odd and large — this is a well-known LCG constant.
 */
function derivePageSeed(seed: bigint, page: number): bigint {
  return (seed * 6364136223846793005n + BigInt(page)) & MASK64;
}

/**
 * Derives a per-record seed by further mixing in the record's sequence index.
 * The salt argument produces independent streams for content vs. likes.
 */
function deriveRecordSeed(pageSeed: bigint, index: number, salt: bigint): bigint {
  return (pageSeed * BigInt(index + 1) + salt) & MASK64;
}

/**
 * The public API for everything else in the app.
 *
 * Given the three generation inputs, returns two independent PRNG instances:
 * - `contentRng`  — drives title, artist, album, genre, cover, audio. 
 *                   Changes when seed or page changes. Unaffected by likes.
 * - `likesRng`    — drives only the likes count for this record.
 *                   Independent of contentRng so changing likesAvg never
 *                   perturbs content, and vice versa.
 */
export function createRecordRngs(
  seedStr: SeedValue,
  page: number,
  index: number
) {
  const seed = BigInt(seedStr);
  const pageSeed = derivePageSeed(seed, page);

  const contentSeed = deriveRecordSeed(pageSeed, index, CONTENT_SALT);
  const likesSeed   = deriveRecordSeed(pageSeed, index, LIKES_SALT);
  const audioSeed   = deriveRecordSeed(pageSeed, index, AUDIO_SALT);

  return {
    contentRng: createSplitmix64(contentSeed),
    likesRng:   createSplitmix64(likesSeed),
    audioRng:   createSplitmix64(audioSeed),
  };
}