/**
 * The retained studies: six exact, reproducible recipes the generator plots.
 *
 * Every field below is derived from the recipe itself and checked against what
 * the worker actually draws for it, not from an impression of the output.
 * `blurb` and `alt` only describe behavior that
 * public/worker/color-mapper.js actually implements for these parameters:
 *   - trace mode strokes the traversal curve as one polyline and advances color
 *     along it (sampleTraceColor); with gradientMap "none" it sweeps hue 0->320.
 *   - snapTraceGrid rounds traceDensity to a grid the curve can tile:
 *     hilbert/morton -> powers of two, peano -> powers of three, spiral and
 *     randomwalk -> the value itself.
 *   - fill mode fills every pixel along the curve order, then remaps color
 *     through GRADIENT_PALETTES and mirrors it with getSymmetryCoords.
 *
 * Home page cards and the gallery study list both read this file, so a recipe
 * change stays in one place.
 */

export type StudyParams = {
  seed: number;
  seedShape: string;
  branchingFactor: number;
  growthRate: number;
  colorSampleSize: number;
  distanceRandomness: number;
  dithering: boolean;
  antiAliasing: boolean;
  allRGBMode: boolean;
  renderMode: "fill" | "trace";
  traceStroke: number;
  traceDensity: number;
  curveType: string;
  gradientMap: string;
  growthMode: string;
  symmetryMode: string;
  colorProgression: string;
  randomness: number;
  previewSize: number;
  patternSize: number;
};

export type Study = {
  id: string;
  /** Unique title for the piece. */
  name: string;
  /** Which render mode made it. */
  mode: "Trace" | "Field";
  /** Short mono caption on the home cards. */
  sub: string;
  /** One to two sentences: what it looks like and how it is made. */
  blurb: string;
  /** Accessible description of the rendered image. */
  alt: string;
  /** The exact settings, as shown on the page. */
  recipe: { label: string; value: string }[];
  params: StudyParams;
};

const COMMON = {
  seed: 1,
  seedShape: "point",
  branchingFactor: 0.5,
  growthRate: 1,
  colorSampleSize: 100,
  distanceRandomness: 10,
  dithering: false,
  antiAliasing: false,
  allRGBMode: false,
};

// Trace recipes render fast at 256 (no color-match); fill recipes stay at 128
// because the color-field engine's match is O(pixels^2). Canvas size ==
// previewSize so each thumbnail is exactly what plotting the recipe produces.
const TRACE_BASE = {
  ...COMMON,
  renderMode: "trace" as const,
  traceStroke: 1,
  traceDensity: 32,
  curveType: "hilbert",
  gradientMap: "none",
  growthMode: "crystal",
  symmetryMode: "none",
  colorProgression: "sequential",
  randomness: 10,
  previewSize: 256,
  patternSize: 256,
};

const FILL_BASE = {
  ...COMMON,
  renderMode: "fill" as const,
  traceStroke: 1,
  traceDensity: 32,
  curveType: "hilbert",
  gradientMap: "none",
  growthMode: "crystal",
  symmetryMode: "none",
  colorProgression: "sequential",
  randomness: 3,
  previewSize: 128,
  patternSize: 128,
};

export const studies: Study[] = [
  {
    id: "hilbert-bloom",
    name: "Hilbert Bloom",
    mode: "Trace",
    sub: "Hilbert · spectrum",
    blurb:
      "One unbroken Hilbert curve folded across a 32 by 32 grid and drawn as a single stroke instead of a filled field. Color advances with the path, so the hue runs red and orange at the start, through yellow, green and cyan, and lands on violet and magenta at the end.",
    alt: "Hilbert Bloom: one continuous Hilbert curve traced across a 32 by 32 grid, its color running from red and orange through yellow, green and cyan to violet and magenta as the path folds through the square.",
    recipe: [
      { label: "Render mode", value: "Line trace" },
      { label: "Curve", value: "Hilbert" },
      { label: "Seed", value: "1" },
      { label: "Color", value: "Spectrum hue sweep" },
      { label: "Detail", value: "32 cells per side (1,024 cells)" },
      { label: "Line weight", value: "1.0" },
    ],
    params: { ...TRACE_BASE, curveType: "hilbert", gradientMap: "none", traceDensity: 32 },
  },
  {
    id: "magma-field",
    name: "Magma Field",
    mode: "Field",
    sub: "Hilbert · magma",
    blurb:
      "Crystal growth from the center, ordered by a Hilbert curve and set to eight-fold radial symmetry. The magma palette puts a dark purple, almost black mass in the middle and brightens out to orange at the edges, grainy at pixel scale because the color is sorted by brightness.",
    alt: "Magma Field: a grainy color field with a dark purple, near-black mass at the center that brightens outward to orange, colored through a magma palette.",
    recipe: [
      { label: "Render mode", value: "Color field" },
      { label: "Curve", value: "Hilbert" },
      { label: "Seed", value: "1337" },
      { label: "Color", value: "Magma gradient map" },
      { label: "Color progression", value: "Brightness" },
      { label: "Growth mode", value: "Crystal" },
      { label: "Symmetry", value: "Radial, 8-fold" },
      { label: "Pattern size", value: "128" },
    ],
    params: {
      ...FILL_BASE,
      curveType: "hilbert",
      gradientMap: "magma",
      symmetryMode: "radial",
      colorProgression: "brightness",
      randomness: 2,
      seed: 1337,
    },
  },
  {
    id: "tide-spiral",
    name: "Tide Spiral",
    mode: "Trace",
    sub: "Spiral · ocean",
    blurb:
      "A square spiral walked from the center outward on a 26 cell grid, stroked a little heavier than the other line studies. The ocean ramp puts deep navy on the tight inner turns and fades to pale blue on the outer ones, so the last few rings nearly drop out against the paper.",
    alt: "Tide Spiral: a square spiral line winding out from the center, deep navy on the inner turns and fading to pale, almost white blue on the outer turns.",
    recipe: [
      { label: "Render mode", value: "Line trace" },
      { label: "Curve", value: "Spiral" },
      { label: "Seed", value: "1" },
      { label: "Color", value: "Ocean gradient" },
      { label: "Detail", value: "26 cells per side" },
      { label: "Line weight", value: "1.1" },
    ],
    params: {
      ...TRACE_BASE,
      curveType: "spiral",
      gradientMap: "ocean",
      traceDensity: 26,
      traceStroke: 1.1,
    },
  },
  {
    id: "nebula",
    name: "Nebula",
    mode: "Field",
    sub: "Morton · ocean",
    blurb:
      "Morton Z-order assigns color in quadrant-sized blocks instead of smooth runs, and nebula growth picks its next cell almost at random. At 128 pixels that combination reads as fine blue static, with the darker ocean blues gathered near the center and lighter ones out at the edges.",
    alt: "Nebula: a field of fine blue static, dark ocean blues gathered toward the center and lighter blues out at the edges.",
    recipe: [
      { label: "Render mode", value: "Color field" },
      { label: "Curve", value: "Morton, Z-order" },
      { label: "Seed", value: "88" },
      { label: "Color", value: "Ocean gradient map" },
      { label: "Color progression", value: "Sequential" },
      { label: "Growth mode", value: "Nebula" },
      { label: "Symmetry", value: "Quadrantal" },
      { label: "Pattern size", value: "128" },
    ],
    params: {
      ...FILL_BASE,
      curveType: "morton",
      gradientMap: "ocean",
      growthMode: "nebula",
      symmetryMode: "quadrantal",
      colorProgression: "sequential",
      randomness: 4,
      seed: 88,
    },
  },
  {
    id: "drift-walk",
    name: "Drift Walk",
    mode: "Trace",
    sub: "Random walk · neon",
    blurb:
      "A constrained random walk on a 34 cell grid, drawn only where the walk steps to a neighbor, so it reads as a maze of short orthogonal runs with gaps where the path jumped. Color follows the walk order rather than position, which scatters the neon palette across the square instead of laying down a gradient.",
    alt: "Drift Walk: a maze of short orthogonal line runs from a constrained random walk, scattered across the square in neon greens, pinks, cyans, and oranges.",
    recipe: [
      { label: "Render mode", value: "Line trace" },
      { label: "Curve", value: "Random walk" },
      { label: "Seed", value: "7" },
      { label: "Color", value: "Neon gradient" },
      { label: "Detail", value: "34 cells per side" },
      { label: "Line weight", value: "1.0" },
    ],
    params: {
      ...TRACE_BASE,
      curveType: "randomwalk",
      gradientMap: "neon",
      traceDensity: 34,
      seed: 7,
    },
  },
  {
    id: "understory",
    name: "Understory",
    mode: "Field",
    sub: "Peano · forest",
    blurb:
      "A Peano-ordered field grown along a flow field and mirrored down the center axis. Mapped to forest, it reads as fine green static with a darker mass near the middle and near-black flecks scattered through the lighter greens.",
    alt: "Understory: a field of fine green static with a darker mass near the middle and near-black flecks scattered through lighter greens.",
    recipe: [
      { label: "Render mode", value: "Color field" },
      { label: "Curve", value: "Peano" },
      { label: "Seed", value: "256" },
      { label: "Color", value: "Forest gradient map" },
      { label: "Color progression", value: "Base distance" },
      { label: "Growth mode", value: "Flow" },
      { label: "Symmetry", value: "Bilateral" },
      { label: "Pattern size", value: "128" },
    ],
    params: {
      ...FILL_BASE,
      curveType: "peano",
      gradientMap: "forest",
      growthMode: "flow",
      symmetryMode: "bilateral",
      colorProgression: "base-distance",
      randomness: 3,
      seed: 256,
    },
  },
];
