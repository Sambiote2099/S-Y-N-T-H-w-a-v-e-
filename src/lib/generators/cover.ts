import path from "path";
import { createCanvas, loadImage, registerFont } from "canvas";
import type { CanvasRenderingContext2D } from "canvas";
import { createSplitmix64 } from "@/lib/rng";

// Vercel's serverless environment has no system fonts installed — locally,
// "Helvetica Neue"/Arial render fine because your machine happens to have
// them, which is exactly why this bug didn't show up until deployment.
// Registering a bundled font explicitly makes rendering consistent
// everywhere. Noto Sans specifically covers Cyrillic, needed for Ukrainian.
registerFont(path.join(process.cwd(), "assets/fonts/NotoSans-Regular.ttf"), {
  family: "Noto Sans",
  weight: "normal",
});
registerFont(path.join(process.cwd(), "assets/fonts/NotoSans-Bold.ttf"), {
  family: "Noto Sans",
  weight: "bold",
});

type Rng = { next(): number };
interface CoverInput {
  title: string;
  artist: string;
  genre: string;
  genreIndex: number;
}

const SIZE = 500;
type Ctx = CanvasRenderingContext2D;

function rngBetween(rng: Rng, min: number, max: number): number {
  return min + rng.next() * (max - min);
}
function rngInt(rng: Rng, min: number, max: number): number {
  return Math.floor(rngBetween(rng, min, max + 1));
}
function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[rngInt(rng, 0, arr.length - 1)];
}
function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

// ============================================================
// AI prompt vocabulary (unchanged in spirit from the previous version —
// mined from the cover-art brief).
// ============================================================

const VISUAL_STYLES = [
  "portrait photography", "street photography", "documentary photography", "fashion photography",
  "nature photography", "travel photography", "architecture photography", "aerial photography",
  "film photography", "polaroid style photography", "vintage photography", "cinematic photography",
  "digital painting", "ink drawing", "watercolor illustration", "pencil sketch illustration",
  "comic illustration", "graphic novel style illustration", "editorial illustration", "surreal illustration",
  "oil painting", "acrylic painting", "impressionist painting", "expressionist painting",
  "cubist art", "abstract art", "contemporary gallery art",
  "swiss design poster", "brutalist design", "minimalist design", "maximalist design",
  "bauhaus design", "modernist design", "postmodern design",
  "synthwave art", "vaporwave art", "cyberpunk art", "glitch art", "holographic design",
  "vinyl sleeve design", "cassette cover design", "underground label design",
];
const COMPOSITION_WORDS = [
  "centered composition", "rule of thirds composition", "symmetrical layout", "asymmetrical layout",
  "collage composition", "multi-panel layout", "grid system layout", "negative space composition",
  "full-bleed artwork", "framed artwork", "layered imagery",
];
const SUBJECT_WORDS = [
  "an empty city street", "a desert landscape", "a dense forest", "distant mountains", "an open ocean",
  "an abandoned interior", "a rooftop skyline", "a subway platform", "a quiet small town",
  "a vintage car", "a musical instrument", "wild flowers", "old technology", "a glowing neon sign",
  "vintage objects", "an abstract sculpture", "a human silhouette", "a sense of isolation",
  "a sense of nostalgia", "passing time", "quiet decay", "growth and renewal", "motion blur", "serenity",
];
const AGING_EFFECT_WORDS = [
  "subtle film grain", "vinyl wear texture", "light dust and scratches", "soft light leaks",
  "print imperfections", "paper texture", "fold marks", "offset printing texture",
];

type GenreArchetype = "bright" | "intense" | "digital" | "smooth" | "introspective" | "classic";
const ARCHETYPE_LIST: GenreArchetype[] = ["bright", "intense", "digital", "smooth", "introspective", "classic"];

// Index-aligned with each locale's genres array — locale-independent by
// construction (position never changes, only the display string does).
const GENRE_ARCHETYPES: GenreArchetype[] = [
  "bright", "intense", "digital", "smooth", "classic", "smooth", "classic", "digital",
  "intense", "introspective", "introspective", "smooth", "bright", "smooth", "intense",
  "intense", "bright", "bright", "introspective", "introspective",
];

interface ArchetypeProfile {
  moodWords: string[];
  colorMoodWords: string[];
}
const ARCHETYPE_PROFILES: Record<GenreArchetype, ArchetypeProfile> = {
  bright: { moodWords: ["vibrant", "joyful", "energetic", "playful", "warm"], colorMoodWords: ["warm sunset palette", "rich jewel tones", "pastel palette", "high contrast neon palette", "sun-bleached high-key palette", "candy-colored palette"] },
  intense: { moodWords: ["raw", "dramatic", "aggressive", "dark", "intense"], colorMoodWords: ["high contrast neon palette", "monochrome palette", "dark atmospheric palette", "black and white", "inky black palette", "blood-red high-contrast palette"] },
  digital: { moodWords: ["futuristic", "experimental", "sleek", "electric"], colorMoodWords: ["high contrast neon palette", "cool cinematic palette", "holographic color palette", "stark white minimal palette", "acid-bright color palette"] },
  smooth: { moodWords: ["sophisticated", "timeless", "elegant", "moody"], colorMoodWords: ["muted earth tones", "dark atmospheric palette", "rich jewel tones", "film-inspired color grading", "warm ivory and cream palette"] },
  introspective: { moodWords: ["emotional", "personal", "atmospheric", "dreamlike", "minimal"], colorMoodWords: ["muted earth tones", "pastel palette", "vintage faded palette", "cool cinematic palette", "soft overexposed light palette", "dim candlelit palette"] },
  classic: { moodWords: ["refined", "cinematic", "orchestral", "nostalgic"], colorMoodWords: ["vintage faded palette", "rich jewel tones", "muted earth tones", "black and white", "antique parchment palette", "deep midnight palette"] },
};

/**
 * Genre strongly biases (65%) the chosen archetype but doesn't lock it —
 * the remaining 35% picks any archetype, so even within one genre there's
 * real cross-pollination of moods/palettes.
 */
function rollArchetype(rng: Rng, genreIndex: number): GenreArchetype {
  const home = GENRE_ARCHETYPES[genreIndex] ?? "bright";
  return rng.next() < 0.65 ? home : pick(rng, ARCHETYPE_LIST);
}

// ============================================================
// Lighting key — a second, independent axis from genre archetype.
// Archetype decides the *mood* (intense, smooth, digital...); lighting
// key decides where that mood sits on the brightness/colorfulness scale.
// A "dark" intense metal cover and a "light" intense metal cover should
// both read as intense, just inverted in value — this is what stops
// every cover from defaulting to the same moody-dark-background look.
// ============================================================

type LightingKey = "dark" | "midtone" | "light" | "vivid";
const LIGHTING_KEYS: LightingKey[] = ["dark", "midtone", "light", "vivid"];

/**
 * Weighted so moody-dark covers (still the most common look across real
 * release art) remain the single biggest bucket, while light, midtone,
 * and saturated/colorful covers each get frequent, genuine presence
 * rather than being rare exceptions.
 */
function rollLightingKey(rng: Rng): LightingKey {
  const roll = rng.next();
  if (roll < 0.4) return "dark";
  if (roll < 0.65) return "midtone";
  if (roll < 0.85) return "light";
  return "vivid";
}

function buildPrompt(rng: Rng, genre: string, genreIndex: number): { prompt: string; imageSeed: number } {
  const archetype = rollArchetype(rng, genreIndex);
  const profile = ARCHETYPE_PROFILES[archetype];

  const style = pick(rng, VISUAL_STYLES);
  const mood = pick(rng, profile.moodWords);
  const composition = pick(rng, COMPOSITION_WORDS);
  const subject = pick(rng, SUBJECT_WORDS);
  const colorMood = pick(rng, profile.colorMoodWords);
  const agingPhrase = rng.next() < 0.35 ? `, ${pick(rng, AGING_EFFECT_WORDS)}` : "";
  const imageSeed = rngInt(rng, 0, 2_147_483_647);

  const prompt = `${mood} ${style} album cover art, ${composition}, featuring ${subject}, ${colorMood}${agingPhrase}, for a ${genre} song, professional record label artwork, high detail, no text, no words, no letters, no watermark`;
  return { prompt, imageSeed };
}

async function fetchAiBackground(prompt: string, imageSeed: number): Promise<Buffer | null> {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${SIZE}&height=${SIZE}&seed=${imageSeed}&model=flux&nologo=true`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================
// Procedural fallback. All randomness is decided in `planFallback`,
// BEFORE the AI fetch is attempted — see generateCoverDataUrl. Drawing
// functions consume only pre-stored seed numbers (spun up into their own
// local, throwaway RNG instances), never the outer shared rng — this is
// what keeps the outer rng's draw count fixed regardless of which branch
// actually ends up drawing. See ASSUMPTIONS.md #23.
// ============================================================

type CompositionKey =
  | "centered" | "ruleOfThirds" | "symmetrical" | "grid" | "negativeSpace"
  | "fullBleed" | "framed" | "diagonalSplit" | "concentricRings" | "stackedBands";
const COMPOSITION_KEYS: CompositionKey[] = [
  "centered", "ruleOfThirds", "symmetrical", "grid", "negativeSpace",
  "fullBleed", "framed", "diagonalSplit", "concentricRings", "stackedBands",
];

type SubjectMotifKey =
  | "mountains" | "cityskyline" | "wave" | "sunburst" | "moonCrescent" | "vinylRecord"
  | "flower" | "birds" | "figureSilhouette" | "polygonCluster" | "lightningBolt" | "starField" | "treeSilhouette";
const SUBJECT_MOTIF_KEYS: SubjectMotifKey[] = [
  "mountains", "cityskyline", "wave", "sunburst", "moonCrescent", "vinylRecord",
  "flower", "birds", "figureSilhouette", "polygonCluster", "lightningBolt", "starField", "treeSilhouette",
];

type TextPlacementKey = "bottomBand" | "topBand" | "cornerCard" | "verticalSide" | "minimalCorner";
const TEXT_PLACEMENTS: TextPlacementKey[] = ["bottomBand", "topBand", "cornerCard", "verticalSide", "minimalCorner"];

interface FallbackPlan {
  archetype: GenreArchetype;
  lightingKey: LightingKey;
  composition: CompositionKey;
  paletteSeed: number;
  compositionSeed: number;
  subjectMotif: SubjectMotifKey | null;
  subjectSeed: number;
  textureSeed: number;
  showScratches: boolean;
  showLightLeak: boolean;
  showHalftone: boolean;
  showScanlines: boolean;
}
interface TextPlacementPlan {
  placement: TextPlacementKey;
  seed: number;
}

function planFallback(rng: Rng, genreIndex: number): FallbackPlan {
  const archetype = rollArchetype(rng, genreIndex);
  const lightingKey = rollLightingKey(rng);
  return {
    archetype,
    lightingKey,
    composition: pick(rng, COMPOSITION_KEYS),
    paletteSeed: rngInt(rng, 0, 2_147_483_647),
    compositionSeed: rngInt(rng, 0, 2_147_483_647),
    subjectMotif: rng.next() < 0.8 ? pick(rng, SUBJECT_MOTIF_KEYS) : null,
    subjectSeed: rngInt(rng, 0, 2_147_483_647),
    textureSeed: rngInt(rng, 0, 2_147_483_647),
    showScratches: rng.next() < 0.35,
    showLightLeak: rng.next() < 0.3,
    showHalftone: rng.next() < 0.3,
    showScanlines: rng.next() < 0.25,
  };
}
function planTextPlacement(rng: Rng): TextPlacementPlan {
  return { placement: pick(rng, TEXT_PLACEMENTS), seed: rngInt(rng, 0, 2_147_483_647) };
}

// ---- Procedural palette: continuous HSL generation, not a fixed list ----

interface HueProfile { hueBands: [number, number][]; saturation: [number, number] }
const ARCHETYPE_HUE_PROFILES: Record<GenreArchetype, HueProfile> = {
  bright: { hueBands: [[0, 60], [300, 360]], saturation: [55, 85] },
  intense: { hueBands: [[330, 360], [0, 15], [260, 300]], saturation: [70, 95] },
  digital: { hueBands: [[170, 200], [280, 320]], saturation: [60, 95] },
  smooth: { hueBands: [[20, 50], [200, 230]], saturation: [25, 55] },
  introspective: { hueBands: [[180, 260], [330, 380]], saturation: [15, 45] },
  classic: { hueBands: [[20, 45], [350, 380]], saturation: [20, 45] },
};

function randomHueInProfile(rng: Rng, profile: HueProfile): number {
  const [lo, hi] = pick(rng, profile.hueBands);
  return rngBetween(rng, lo, hi) % 360;
}

interface LightingRange {
  bgL: [number, number];
  midL: [number, number];
  accentL: [number, number];
  satMul: number;
}
// Same three-color role (background / mid / accent) at every lighting
// key, just shifted along the value scale — and, for "light", the
// background and accent roles invert in contrast direction (dark accent
// pops *on* a light background instead of a light accent popping on a
// dark one).
const LIGHTING_RANGES: Record<LightingKey, LightingRange> = {
  dark: { bgL: [8, 20], midL: [26, 42], accentL: [50, 68], satMul: 1 },
  midtone: { bgL: [36, 52], midL: [48, 62], accentL: [64, 80], satMul: 0.9 },
  light: { bgL: [80, 95], midL: [58, 74], accentL: [20, 42], satMul: 0.65 },
  vivid: { bgL: [32, 54], midL: [46, 64], accentL: [62, 84], satMul: 1.35 },
};
function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) => Math.round(255 * x).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}
function randomPaletteForArchetype(rng: Rng, archetype: GenreArchetype, lightingKey: LightingKey): [string, string, string] {
  const profile = ARCHETYPE_HUE_PROFILES[archetype];
  const range = LIGHTING_RANGES[lightingKey];
  const baseHue = randomHueInProfile(rng, profile);
  const sat = Math.min(98, rngBetween(rng, profile.saturation[0], profile.saturation[1]) * range.satMul);
  // "vivid" reaches much further around the wheel for bold, colorful
  // contrast between bg/mid/accent; every other key stays within a
  // tighter, more analogous (coherent, single-mood) hue family.
  const [shiftLo, shiftHi] = lightingKey === "vivid" ? [50, 110] : [15, 45];
  const hueShift = rngBetween(rng, shiftLo, shiftHi) * (rng.next() < 0.5 ? 1 : -1);

  const bgSat = sat * (lightingKey === "light" ? 0.45 : 0.6);
  const bg = hslToHex(baseHue, bgSat, rngBetween(rng, range.bgL[0], range.bgL[1]));
  const mid = hslToHex((baseHue + hueShift + 360) % 360, sat, rngBetween(rng, range.midL[0], range.midL[1]));
  const accent = hslToHex((baseHue + hueShift * 2 + 360) % 360, Math.min(98, sat + 15), rngBetween(rng, range.accentL[0], range.accentL[1]));
  return [bg, mid, accent];
}

// ---- Composition renderers ----

function drawComposition(ctx: Ctx, rng: Rng, composition: CompositionKey, palette: [string, string, string]) {
  const [a, b, c] = palette;

  if (composition === "centered") {
    const grad = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE * 0.75);
    grad.addColorStop(0, b);
    grad.addColorStop(1, a);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, rngBetween(rng, 90, 150), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (composition === "ruleOfThirds") {
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, SIZE, SIZE);
    const fx = SIZE / 3 + rngBetween(rng, -20, 20);
    const fy = (SIZE / 3) * 2 + rngBetween(rng, -20, 20);
    const grad = ctx.createRadialGradient(fx, fy, 0, fx, fy, SIZE * 0.5);
    grad.addColorStop(0, c);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = b;
    ctx.beginPath();
    ctx.arc(fx, fy, rngBetween(rng, 40, 70), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (composition === "symmetrical") {
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, SIZE, SIZE);
    const stripes = 5 + rngInt(rng, 0, 4);
    const w = SIZE / stripes;
    for (let i = 0; i < stripes; i++) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = i % 2 === 0 ? b : c;
      ctx.fillRect(i * w, 0, w * 0.7, SIZE);
    }
    ctx.globalAlpha = 1;
  } else if (composition === "grid") {
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, SIZE, SIZE);
    const cols = 4 + rngInt(rng, 0, 2);
    const cell = SIZE / cols;
    for (let row = 0; row < cols; row++) {
      for (let col = 0; col < cols; col++) {
        if (rng.next() < 0.4) continue;
        ctx.globalAlpha = rngBetween(rng, 0.25, 0.6);
        ctx.fillStyle = rng.next() < 0.5 ? b : c;
        ctx.fillRect(col * cell, row * cell, cell * 0.9, cell * 0.9);
      }
    }
    ctx.globalAlpha = 1;
  } else if (composition === "negativeSpace") {
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, SIZE, SIZE);
    const r = rngBetween(rng, 50, 100);
    const cx = rngBetween(rng, SIZE * 0.2, SIZE * 0.8);
    const cy = rngBetween(rng, SIZE * 0.2, SIZE * 0.8);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, c);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.globalAlpha = 1;
  } else if (composition === "fullBleed") {
    const grad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    grad.addColorStop(0, a);
    grad.addColorStop(0.5, b);
    grad.addColorStop(1, c);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);
  } else if (composition === "framed") {
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, SIZE, SIZE);
    const margin = 36;
    ctx.fillStyle = b;
    ctx.fillRect(margin, margin, SIZE - margin * 2, SIZE - margin * 2);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = c;
    ctx.fillRect(margin + 14, margin + 14, SIZE - (margin + 14) * 2, SIZE - (margin + 14) * 2);
    ctx.globalAlpha = 1;
  } else if (composition === "diagonalSplit") {
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, SIZE, SIZE);
    const midX = SIZE * rngBetween(rng, 0.3, 0.7);
    const slant = rngBetween(rng, 60, 200) * (rng.next() < 0.5 ? 1 : -1);
    ctx.fillStyle = b;
    ctx.beginPath();
    ctx.moveTo(midX, 0);
    ctx.lineTo(SIZE, 0);
    ctx.lineTo(SIZE, SIZE);
    ctx.lineTo(midX + slant, SIZE);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(midX * 0.6, 0);
    ctx.lineTo(midX, 0);
    ctx.lineTo(midX + slant * 0.4, SIZE);
    ctx.lineTo(midX * 0.6 + slant * 0.4, SIZE);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (composition === "concentricRings") {
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, SIZE, SIZE);
    const cx = rngBetween(rng, SIZE * 0.3, SIZE * 0.7);
    const cy = rngBetween(rng, SIZE * 0.3, SIZE * 0.7);
    const ringWidth = rngBetween(rng, 30, 55);
    let r = ringWidth / 2;
    let toggle = 0;
    while (r < SIZE * 0.85) {
      ctx.strokeStyle = toggle % 2 === 0 ? b : c;
      ctx.lineWidth = ringWidth;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      r += ringWidth;
      toggle++;
    }
    ctx.globalAlpha = 1;
  } else {
    // stackedBands
    const bandCount = 4 + rngInt(rng, 0, 4);
    const bandH = SIZE / bandCount;
    for (let i = 0; i < bandCount; i++) {
      ctx.fillStyle = i % 2 === 0 ? a : b;
      ctx.fillRect(0, i * bandH, SIZE, bandH);
    }
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = c;
    ctx.fillRect(0, rngBetween(rng, 0, SIZE * 0.7), SIZE, rngBetween(rng, 40, 100));
    ctx.globalAlpha = 1;
  }
}

// ---- Subject motifs (silhouettes drawn on top of the composition) ----

function drawSubjectMotif(ctx: Ctx, rng: Rng, key: SubjectMotifKey, color: string) {
  ctx.save();
  ctx.globalAlpha = rngBetween(rng, 0.5, 0.85);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;

  if (key === "mountains") {
    const baseY = rngBetween(rng, SIZE * 0.55, SIZE * 0.7);
    const peaks = 4 + rngInt(rng, 0, 3);
    ctx.beginPath();
    ctx.moveTo(0, SIZE);
    ctx.lineTo(0, baseY);
    let x = 0;
    const stepW = SIZE / peaks;
    for (let i = 0; i < peaks; i++) {
      ctx.lineTo(x + stepW / 2, baseY - rngBetween(rng, 40, 130));
      x += stepW;
      ctx.lineTo(x, baseY + rngBetween(rng, -10, 10));
    }
    ctx.lineTo(SIZE, SIZE);
    ctx.closePath();
    ctx.fill();
  } else if (key === "cityskyline") {
    const baseY = SIZE * 0.78;
    let x = 0;
    while (x < SIZE) {
      const w = rngBetween(rng, 20, 55);
      const h = rngBetween(rng, 50, 220);
      ctx.fillRect(x, baseY - h, w, h);
      x += w + rngBetween(rng, 2, 10);
    }
  } else if (key === "wave") {
    const baseY = rngBetween(rng, SIZE * 0.55, SIZE * 0.7);
    const amp = rngBetween(rng, 20, 50);
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    const segments = 4;
    const segW = SIZE / segments;
    for (let i = 0; i < segments; i++) {
      const dir = i % 2 === 0 ? -1 : 1;
      ctx.quadraticCurveTo(i * segW + segW / 2, baseY + dir * amp, (i + 1) * segW, baseY);
    }
    ctx.lineTo(SIZE, SIZE);
    ctx.lineTo(0, SIZE);
    ctx.closePath();
    ctx.fill();
  } else if (key === "sunburst") {
    const cx = rngBetween(rng, SIZE * 0.3, SIZE * 0.7);
    const cy = rngBetween(rng, SIZE * 0.25, SIZE * 0.55);
    const r = rngBetween(rng, 40, 70);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    const rayCount = 8 + rngInt(rng, 0, 6);
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2;
      const len = rngBetween(rng, r * 1.3, r * 2.2);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * r * 1.1, cy + Math.sin(angle) * r * 1.1);
      ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
      ctx.lineWidth = rngBetween(rng, 2, 5);
      ctx.stroke();
    }
  } else if (key === "moonCrescent") {
    const cx = rngBetween(rng, SIZE * 0.25, SIZE * 0.75);
    const cy = rngBetween(rng, SIZE * 0.2, SIZE * 0.45);
    const r = rngBetween(rng, 35, 60);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(cx + r * 0.45, cy - r * 0.15, r * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  } else if (key === "vinylRecord") {
    const cx = SIZE / 2 + rngBetween(rng, -30, 30);
    const cy = SIZE / 2 + rngBetween(rng, -30, 30);
    [70, 50, 30].forEach((r, i) => {
      ctx.globalAlpha = i === 0 ? 0.8 : 0.5;
      ctx.lineWidth = i === 0 ? 4 : 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fill();
  } else if (key === "flower") {
    const cx = rngBetween(rng, SIZE * 0.3, SIZE * 0.7);
    const cy = rngBetween(rng, SIZE * 0.3, SIZE * 0.7);
    const petals = 5 + rngInt(rng, 0, 3);
    const petalLen = rngBetween(rng, 40, 70);
    for (let i = 0; i < petals; i++) {
      const angle = (i / petals) * Math.PI * 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.ellipse(0, -petalLen / 2, petalLen * 0.35, petalLen / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else if (key === "birds") {
    const count = 3 + rngInt(rng, 0, 4);
    for (let i = 0; i < count; i++) {
      const x = rngBetween(rng, SIZE * 0.1, SIZE * 0.9);
      const y = rngBetween(rng, SIZE * 0.1, SIZE * 0.4);
      const w = rngBetween(rng, 14, 26);
      ctx.beginPath();
      ctx.moveTo(x - w, y);
      ctx.quadraticCurveTo(x - w / 2, y - w / 2, x, y);
      ctx.quadraticCurveTo(x + w / 2, y - w / 2, x + w, y);
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  } else if (key === "figureSilhouette") {
    const cx = rngBetween(rng, SIZE * 0.3, SIZE * 0.7);
    const baseY = SIZE * 0.75;
    ctx.beginPath();
    ctx.arc(cx, baseY - 110, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 22, baseY);
    ctx.lineTo(cx - 14, baseY - 90);
    ctx.lineTo(cx + 14, baseY - 90);
    ctx.lineTo(cx + 22, baseY);
    ctx.closePath();
    ctx.fill();
  } else if (key === "polygonCluster") {
    const count = 5 + rngInt(rng, 0, 5);
    for (let i = 0; i < count; i++) {
      const cx = rngBetween(rng, 0, SIZE);
      const cy = rngBetween(rng, 0, SIZE);
      const r = rngBetween(rng, 20, 60);
      const sides = 3 + rngInt(rng, 0, 2);
      const rot = rngBetween(rng, 0, 360) * (Math.PI / 180);
      ctx.globalAlpha = rngBetween(rng, 0.3, 0.6);
      ctx.beginPath();
      for (let s = 0; s < sides; s++) {
        const angle = rot + (s / sides) * Math.PI * 2;
        const px = cx + Math.cos(angle) * r;
        const py = cy + Math.sin(angle) * r;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
  } else if (key === "lightningBolt") {
    const cx = rngBetween(rng, SIZE * 0.3, SIZE * 0.7);
    const cy = rngBetween(rng, SIZE * 0.3, SIZE * 0.6);
    const s = rngBetween(rng, 1, 1.6);
    const pts: [number, number][] = [
      [cx + 10 * s, cy - 50 * s], [cx - 18 * s, cy + 6 * s], [cx, cy + 6 * s],
      [cx - 10 * s, cy + 50 * s], [cx + 20 * s, cy - 10 * s], [cx + 2 * s, cy - 10 * s],
    ];
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
    ctx.closePath();
    ctx.fill();
  } else if (key === "starField") {
    const count = 20 + rngInt(rng, 0, 30);
    for (let i = 0; i < count; i++) {
      const x = rngBetween(rng, 0, SIZE);
      const y = rngBetween(rng, 0, SIZE * 0.6);
      const r = rngBetween(rng, 1, 3);
      ctx.globalAlpha = rngBetween(rng, 0.4, 0.9);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // treeSilhouette
    const cx = rngBetween(rng, SIZE * 0.2, SIZE * 0.8);
    const baseY = SIZE * 0.8;
    ctx.fillRect(cx - 6, baseY - 40, 12, 40);
    ctx.beginPath();
    ctx.arc(cx, baseY - 70, 45, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---- Texture/aging effects ----

function drawGrain(ctx: Ctx, rng: Rng) {
  ctx.globalCompositeOperation = "overlay";
  for (let i = 0; i < 400; i++) {
    const x = rngBetween(rng, 0, SIZE);
    const y = rngBetween(rng, 0, SIZE);
    const shade = rng.next() < 0.5 ? "255,255,255" : "0,0,0";
    ctx.fillStyle = `rgba(${shade},${rngBetween(rng, 0.04, 0.1).toFixed(2)})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  ctx.globalCompositeOperation = "source-over";
}
function drawScratches(ctx: Ctx, rng: Rng) {
  ctx.globalCompositeOperation = "overlay";
  const count = 4 + rngInt(rng, 0, 6);
  for (let i = 0; i < count; i++) {
    const x = rngBetween(rng, 0, SIZE);
    const len = rngBetween(rng, SIZE * 0.3, SIZE * 0.9);
    const angle = (rngBetween(rng, -10, 10) * Math.PI) / 180;
    ctx.save();
    ctx.translate(x, 0);
    ctx.rotate(angle);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = rngBetween(rng, 0.5, 1.5);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, len);
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalCompositeOperation = "source-over";
}
function drawLightLeak(ctx: Ctx, rng: Rng) {
  const corner = rngInt(rng, 0, 3);
  const cx = corner % 2 === 0 ? 0 : SIZE;
  const cy = corner < 2 ? 0 : SIZE;
  const r = rngBetween(rng, SIZE * 0.4, SIZE * 0.7);
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, "rgba(255,180,90,0.35)");
  grad.addColorStop(1, "rgba(255,180,90,0)");
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.globalCompositeOperation = "source-over";
}
function drawHalftoneDots(ctx: Ctx, rng: Rng, color: string) {
  const spacing = rngBetween(rng, 14, 22);
  ctx.fillStyle = color;
  for (let y = spacing / 2; y < SIZE; y += spacing) {
    for (let x = spacing / 2; x < SIZE; x += spacing) {
      if (rng.next() < 0.55) continue;
      const r = rngBetween(rng, 1, 3.5);
      ctx.globalAlpha = rngBetween(rng, 0.08, 0.2);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
function drawScanlines(ctx: Ctx, rng: Rng) {
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = "#000000";
  const gap = rngBetween(rng, 3, 6);
  for (let y = 0; y < SIZE; y += gap) ctx.fillRect(0, y, SIZE, 1);
  ctx.globalAlpha = 1;
}
function drawVignette(ctx: Ctx) {
  const radial = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.35, SIZE / 2, SIZE / 2, SIZE * 0.75);
  radial.addColorStop(0, "rgba(0,0,0,0)");
  radial.addColorStop(1, "rgba(0,0,0,0.4)");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, SIZE, SIZE);
}

function renderProceduralFallback(ctx: Ctx, plan: FallbackPlan) {
  const paletteRng = createSplitmix64(BigInt(plan.paletteSeed));
  const palette = randomPaletteForArchetype(paletteRng, plan.archetype, plan.lightingKey);

  const compRng = createSplitmix64(BigInt(plan.compositionSeed));
  drawComposition(ctx, compRng, plan.composition, palette);

  if (plan.subjectMotif) {
    const subjectRng = createSplitmix64(BigInt(plan.subjectSeed));
    drawSubjectMotif(ctx, subjectRng, plan.subjectMotif, palette[2]);
  }

  const textureRng = createSplitmix64(BigInt(plan.textureSeed));
  drawGrain(ctx, textureRng);
  if (plan.showScratches) drawScratches(ctx, textureRng);
  if (plan.showLightLeak) drawLightLeak(ctx, textureRng);
  if (plan.showHalftone) drawHalftoneDots(ctx, textureRng, palette[2]);
  if (plan.showScanlines) drawScanlines(ctx, textureRng);
}

// ---- Text overlay (5 placement styles, used in both AI-success and fallback paths) ----

function roundedRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
function wrapTextCanvas(ctx: Ctx, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
    if (lines.length === maxLines - 1) break;
  }
  if (current) lines.push(current);
  return lines;
}
function fitText(ctx: Ctx, text: string, maxWidth: number, maxLines: number, startSize = 42, minSize = 18) {
  let fontSize = startSize;
  let lines: string[] = [text];
  while (fontSize > minSize) {
    ctx.font = `bold ${fontSize}px "Noto Sans", sans-serif`;
    lines = wrapTextCanvas(ctx, text, maxWidth, maxLines);
    if (lines.every((l) => ctx.measureText(l).width <= maxWidth)) break;
    fontSize -= 3;
  }
  return { fontSize, lines };
}

function drawTextOverlay(ctx: Ctx, title: string, artist: string, plan: TextPlacementPlan, isLight = false) {
  const localRng = createSplitmix64(BigInt(plan.seed));

  // On a "light" cover, title/artist switch from white-on-dark-shadow to
  // dark-ink-on-light-glow — otherwise white text on a pale background is
  // unreadable. Every other lighting key keeps the original light-on-dark
  // treatment, since the scrims/cards below already guarantee contrast.
  const ink = isLight ? "#1a1410" : "#ffffff";
  const inkSubtle = isLight ? "rgba(26,20,16,0.85)" : "rgba(255,255,255,0.9)";
  const inkFaint = isLight ? "rgba(26,20,16,0.85)" : "rgba(255,255,255,0.85)";
  const glow = isLight ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.7)";
  const glowSoft = isLight ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.8)";
  const scrimFar = isLight ? "rgba(255,255,255,0)" : "rgba(0,0,0,0)";
  const scrimNear = isLight ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.75)";
  const cardBg = isLight ? "rgba(255,255,255,0.78)" : "rgba(0,0,0,0.65)";
  const cardSubtitle = isLight ? "#3a322c" : "#e5e5e5";

  if (plan.placement === "bottomBand" || plan.placement === "topBand") {
    const atBottom = plan.placement === "bottomBand";
    const fade = ctx.createLinearGradient(0, atBottom ? SIZE * 0.55 : 0, 0, atBottom ? SIZE : SIZE * 0.45);
    fade.addColorStop(atBottom ? 0 : 1, scrimFar);
    fade.addColorStop(atBottom ? 1 : 0, scrimNear);
    ctx.fillStyle = fade;
    ctx.fillRect(0, atBottom ? SIZE * 0.55 : 0, SIZE, SIZE * 0.45);

    const { fontSize, lines } = fitText(ctx, title.toUpperCase(), SIZE - 64, 2);
    ctx.textAlign = "center";
    ctx.fillStyle = ink;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 12;
    const lineHeight = fontSize * 1.15;

    if (atBottom) {
      const bottomY = SIZE - 60;
      lines.forEach((line, i) => {
        ctx.font = `bold ${fontSize}px "Noto Sans", sans-serif`;
        ctx.fillText(line, SIZE / 2, bottomY - (lines.length - 1 - i) * lineHeight);
      });
      ctx.font = `600 20px "Noto Sans", sans-serif`;
      ctx.shadowBlur = 8;
      ctx.fillStyle = inkSubtle;
      ctx.fillText(truncate(artist, 28).toUpperCase(), SIZE / 2, SIZE - 26);
    } else {
      const topY = 46;
      lines.forEach((line, i) => {
        ctx.font = `bold ${fontSize}px "Noto Sans", sans-serif`;
        ctx.fillText(line, SIZE / 2, topY + i * lineHeight);
      });
      ctx.font = `600 20px "Noto Sans", sans-serif`;
      ctx.shadowBlur = 8;
      ctx.fillStyle = inkSubtle;
      ctx.fillText(truncate(artist, 28).toUpperCase(), SIZE / 2, topY + lines.length * lineHeight + 8);
    }
    ctx.shadowBlur = 0;
  } else if (plan.placement === "cornerCard") {
    const titleLines = wrapTextCanvas(ctx, title.toUpperCase(), 170, 2);
    ctx.font = `bold 19px "Noto Sans", sans-serif`;
    const cardW = 220;
    const cardH = 40 + titleLines.length * 24 + 22;
    const corner = rngInt(localRng, 0, 3);
    const margin = 22;
    const x = corner % 2 === 0 ? margin : SIZE - margin - cardW;
    const y = corner < 2 ? margin : SIZE - margin - cardH;
    const rotation = rngBetween(localRng, -6, 6) * (Math.PI / 180);

    ctx.save();
    ctx.translate(x + cardW / 2, y + cardH / 2);
    ctx.rotate(rotation);
    ctx.translate(-(x + cardW / 2), -(y + cardH / 2));
    ctx.fillStyle = cardBg;
    roundedRectPath(ctx, x, y, cardW, cardH, 10);
    ctx.fill();

    ctx.textAlign = "left";
    ctx.fillStyle = ink;
    titleLines.forEach((line, i) => {
      ctx.font = `bold 19px "Noto Sans", sans-serif`;
      ctx.fillText(line, x + 16, y + 28 + i * 24);
    });
    ctx.font = `600 14px "Noto Sans", sans-serif`;
    ctx.fillStyle = cardSubtitle;
    ctx.fillText(truncate(artist, 22).toUpperCase(), x + 16, y + cardH - 14);
    ctx.restore();
  } else if (plan.placement === "verticalSide") {
    const side = rngInt(localRng, 0, 1) === 0 ? "left" : "right";
    const x = side === "left" ? 36 : SIZE - 36;

    ctx.save();
    ctx.translate(x, SIZE / 2);
    ctx.rotate(side === "left" ? -Math.PI / 2 : Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillStyle = ink;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 10;
    ctx.font = `bold 28px "Noto Sans", sans-serif`;
    ctx.fillText(truncate(title, 24).toUpperCase(), 0, 0);
    ctx.restore();

    ctx.textAlign = side === "left" ? "left" : "right";
    ctx.font = `600 16px "Noto Sans", sans-serif`;
    ctx.fillStyle = inkFaint;
    ctx.shadowBlur = 6;
    ctx.fillText(truncate(artist, 24).toUpperCase(), side === "left" ? 16 : SIZE - 16, SIZE - 24);
    ctx.shadowBlur = 0;
  } else {
    const corner = rngInt(localRng, 0, 3);
    const x = corner % 2 === 0 ? 20 : SIZE - 20;
    const y = corner < 2 ? 30 : SIZE - 20;
    ctx.textAlign = corner % 2 === 0 ? "left" : "right";
    ctx.fillStyle = ink;
    ctx.shadowColor = glowSoft;
    ctx.shadowBlur = 8;
    ctx.font = `600 15px "Noto Sans", sans-serif`;
    ctx.fillText(truncate(title, 30).toUpperCase(), x, y);
    ctx.font = `400 12px "Noto Sans", sans-serif`;
    ctx.fillStyle = inkFaint;
    ctx.fillText(truncate(artist, 30).toUpperCase(), x, y + 18);
    ctx.shadowBlur = 0;
  }
}

export async function generateCoverDataUrl(rng: Rng, { title, artist, genre, genreIndex }: CoverInput): Promise<string> {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");

  // Every rng draw needed by EITHER branch happens here, unconditionally,
  // before the network call — this keeps the outer rng's total draw count
  // identical regardless of whether Pollinations succeeds or fails on any
  // given run, which is what keeps review text/lyrics (drawn afterward
  // from this same stream) genuinely reproducible. See ASSUMPTIONS.md #23.
  const { prompt, imageSeed } = buildPrompt(rng, genre, genreIndex);
  const fallbackPlan = planFallback(rng, genreIndex);
  const textPlan = planTextPlacement(rng);

  const imageBuffer = await fetchAiBackground(prompt, imageSeed);

  if (imageBuffer) {
    try {
     
      renderProceduralFallback(ctx, fallbackPlan);
    } catch {
       const img = await loadImage(imageBuffer);
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      drawVignette(ctx);
    }
  } else {
    renderProceduralFallback(ctx, fallbackPlan);
  }

  drawTextOverlay(ctx, title, artist, textPlan, fallbackPlan.lightingKey === "light");

  return `data:image/png;base64,${canvas.toBuffer("image/png").toString("base64")}`;
}