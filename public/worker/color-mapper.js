// color-mapper.js (Web Worker)
// Enhanced algorithmic art generation engine
// Supports Hilbert, Morton, Peano, Spiral, and RandomWalk traversal curves.
// Exposed growth modes: Crystal, Nebula, Rings, Flow.
// (Organic and Fractal branches remain below but are not selectable from the UI.)

// ─── Seeded PRNG (mulberry32) ───
function mulberry32(a) {
  return function () {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function seededShuffle(array, seed) {
  const rand = mulberry32(seed);
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return rand;
}

// ─── Binary Min-Heap PriorityQueue ───
// Replaces the old O(n) array scan with O(log n) push/pop.
class PriorityQueue {
  constructor() {
    this.heap = [];           // stores { item, priority }
    this._index = 0;          // tie-breaker for stable ordering
  }
  push(item, priority) {
    const node = { item, priority, seq: this._index++ };
    this.heap.push(node);
    this._siftUp(this.heap.length - 1);
  }
  pop() {
    if (this.heap.length === 0) return null;
    const top = this.heap[0].item;
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._siftDown(0);
    }
    return top;
  }
  get length() {
    return this.heap.length;
  }
  _siftUp(i) {
    const node = this.heap[i];
    while (i > 0) {
      const parent = (i - 1) >>> 1;
      if (this._compare(node, this.heap[parent]) >= 0) break;
      this.heap[i] = this.heap[parent];
      i = parent;
    }
    this.heap[i] = node;
  }
  _siftDown(i) {
    const len = this.heap.length;
    const node = this.heap[i];
    while (true) {
      let left = (i << 1) + 1;
      let right = left + 1;
      let smallest = i;
      if (left < len && this._compare(this.heap[left], this.heap[smallest]) < 0) smallest = left;
      if (right < len && this._compare(this.heap[right], this.heap[smallest]) < 0) smallest = right;
      if (smallest === i) break;
      this.heap[i] = this.heap[smallest];
      i = smallest;
    }
    this.heap[i] = node;
  }
  _compare(a, b) {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.seq - b.seq;
  }
}

// ─── Optimized Color Distance with Memoization ───
// Cache for color distance calculations to avoid redundant computations
// Key format: encodedColor1 << 32 | encodedColor2 (where each color is encoded as r<<16|g<<8|b)
const colorDistCache = new Map();
let cacheHits = 0;
let cacheMisses = 0;

// Helper function to encode a color [r, g, b] into a single integer
function encodeColor(color) {
  return (color[0] << 16) | (color[1] << 8) | color[2];
}

// Optimized color distance function with memoization
// Uses multiplication instead of exponentiation for better performance
// Supports early exit when distance exceeds threshold
function colorDistSq(a, b, threshold = Infinity) {
  // Early exit for identical colors (distance is 0)
  if (a[0] === b[0] && a[1] === b[1] && a[2] === b[2]) {
    return 0;
  }

  // Create cache key by encoding both colors
  const encodedA = encodeColor(a);
  const encodedB = encodeColor(b);
  // Ensure consistent ordering for cache key (smaller first to avoid duplicates)
  const key = encodedA < encodedB ? (encodedA << 32) | encodedB : (encodedB << 32) | encodedA;

  // Check cache first
  if (colorDistCache.has(key)) {
    cacheHits++;
    return colorDistCache.get(key);
  }

  cacheMisses++;

  // Calculate distance using multiplication instead of ** operator
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];

  // Early exit if we can determine distance exceeds threshold
  // This is useful when we only need to know if distance is below a certain value
  const dist = dr * dr + dg * dg + db * db;

  // Cache the result
  colorDistCache.set(key, dist);

  return dist;
}

// Function to clear the color distance cache (call between image generations)
function clearColorDistCache() {
  colorDistCache.clear();
  cacheHits = 0;
  cacheMisses = 0;
}

// ─── Improved color sampling ───
// Uses a seeded sampler to avoid bias from Math.random().
function pickClosestColorFromSample(palette, target, rand, sampleSize = 100) {
  let bestIdx = 0, bestDist = Infinity;
  const n = palette.length;
  if (n === 0) return -1;
  const size = Math.min(sampleSize, n);
  // Deterministic seeded sampling without replacement for small palettes
  if (n <= sampleSize * 2) {
    for (let j = 0; j < n; j++) {
      const dist = colorDistSq(palette[j], target);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = j;
      }
    }
    return bestIdx;
  }
  for (let s = 0; s < size; s++) {
    const j = Math.floor(rand() * n);
    const dist = colorDistSq(palette[j], target);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = j;
    }
  }
  return bestIdx;
}

function hsv2rgb(h, s, v) {
  let f = (n, k = (n + h / 60) % 6) => v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
  return [f(5) * 255, f(3) * 255, f(1) * 255];
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * (((b - r) / delta) + 2);
    else h = 60 * (((r - g) / delta) + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : delta / max;
  const v = max;
  return [h, s, v];
}

function applyColorProgression(colorList, colorProgression, seed) {
  if (!Array.isArray(colorList) || colorList.length === 0) return;
  switch (colorProgression) {
    case 'sequential':
      return;
    case 'shuffled':
      seededShuffle(colorList, seed);
      return;
    case 'base-distance': {
      const baseColor = colorList[Math.abs(seed) % colorList.length];
      colorList.sort((a, b) => colorDistSq(a, baseColor) - colorDistSq(b, baseColor));
      return;
    }
    case 'saturation':
      colorList.sort((a, b) => rgbToHsv(a[0], a[1], a[2])[1] - rgbToHsv(b[0], b[1], b[2])[1]);
      return;
    case 'brightness':
      colorList.sort((a, b) => rgbToHsv(a[0], a[1], a[2])[2] - rgbToHsv(b[0], b[1], b[2])[2]);
      return;
    default:
      seededShuffle(colorList, seed);
  }
}

function simpleHash(x, y, seed) {
  let h = x * 374761393 + y * 668265263 + seed * 982451653;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

// ─── Improved Radial Symmetry ───
// Avoids center artifacts by using integer center and clamping,
// plus deduplication of coordinates.
function getSymmetryCoords(x, y, width, height, symmetryMode) {
  if (symmetryMode === 'none') return [[x, y]];
  if (symmetryMode === 'bilateral') {
    const mx = width - 1 - x;
    return [[x, y], [mx, y]];
  }
  if (symmetryMode === 'quadrantal') {
    const mx = width - 1 - x, my = height - 1 - y;
    return [[x, y], [mx, y], [x, my], [mx, my]];
  }
  if (symmetryMode === 'radial') {
    const cx = (width / 2) | 0, cy = (height / 2) | 0;
    const dx = x - cx, dy = y - cy;
    const r = Math.hypot(dx, dy);
    // Handle exact center gracefully
    if (r < 0.5) return [[x, y]];
    const theta = Math.atan2(dy, dx);
    const n = 8; // 8-fold radial
    const coords = [];
    const seen = new Set();
    for (let i = 0; i < n; i++) {
      const angle = theta + (2 * Math.PI * i) / n;
      const rx = Math.round(cx + r * Math.cos(angle));
      const ry = Math.round(cy + r * Math.sin(angle));
      if (rx >= 0 && rx < width && ry >= 0 && ry < height) {
        const key = (ry << 16) | rx;
        if (!seen.has(key)) {
          seen.add(key);
          coords.push([rx, ry]);
        }
      }
    }
    return coords;
  }
  return [[x, y]];
}

// ─── Memory check ───
function checkMemory() {
  try {
    const testSize = 1024 * 1024 * 10;
    const testArray = new Uint8Array(testSize);
    testArray[0] = 1;
    testArray[testSize - 1] = 1;
    return true;
  } catch (e) {
    console.error("Memory test failed:", e);
    return false;
  }
}

// ─── Space-Filling Curves ───

// Hilbert curve: maps 2D coordinates to 1D distance
function xyToHilbert(x, y, order) {
  let rx, ry, d = 0;
  const n = 1 << order;
  x = Math.max(0, Math.min(n - 1, x));
  y = Math.max(0, Math.min(n - 1, y));
  for (let s = n / 2; s > 0; s = Math.floor(s / 2)) {
    rx = (x & s) > 0 ? 1 : 0;
    ry = (y & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    if (ry === 0) {
      if (rx === 1) {
        x = n - 1 - x;
        y = n - 1 - y;
      }
      [x, y] = [y, x];
    }
  }
  return d;
}

// Morton / Z-order curve
function mortonEncode(x, y) {
  x = Math.max(0, Math.floor(x));
  y = Math.max(0, Math.floor(y));
  let result = 0;
  for (let i = 0; i < 16; i++) {
    result |= ((x >> i) & 1) << (2 * i);
    result |= ((y >> i) & 1) << (2 * i + 1);
  }
  return result;
}

// ─── NEW: Peano Curve ───
// A 3-order space-filling curve. Recursively subdivides a 3x3 grid.
function xyToPeano(x, y, order) {
  const n = Math.pow(3, order);
  x = Math.max(0, Math.min(n - 1, x));
  y = Math.max(0, Math.min(n - 1, y));
  let d = 0;
  const peanoTable = [
    [0, 1, 2],
    [5, 4, 3],
    [6, 7, 8]
  ];
  // Iterative construction: process each ternary digit
  for (let s = n / 3; s >= 1; s /= 3) {
    const rx = Math.floor(x / s) % 3;
    const ry = Math.floor(y / s) % 3;
    // Mirror every other level for continuous curve
    d = d * 9 + peanoTable[ry][rx];
  }
  return d;
}

// ─── NEW: Spiral (Archimedean) Traversal ───
// Returns a 1D distance value for grid coordinate (x,y) based on
// Archimedean spiral ordering from the center.
function xyToSpiral(x, y, width, height) {
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const dx = x - cx;
  const dy = y - cy;
  const r = Math.hypot(dx, dy);
  let theta = Math.atan2(dy, dx);
  if (theta < 0) theta += 2 * Math.PI;
  // Combine radius and angle into a single scalar.
  // The spiral pitch is chosen so adjacent rings don't overlap in ordering.
  const pitch = Math.max(width, height) / (2 * Math.PI);
  return (r + pitch * theta);
}

// ─── NEW: Random Walk with Constraints ───
// Uses a deterministic pseudo-random walk seeded by (x,y) to generate
// a traversal order. Each cell gets a walk-step index for sorting.
function generateRandomWalkOrder(width, height, seed) {
  const total = width * height;
  const order = new Uint32Array(total);
  const visited = new Uint8Array(total);
  const rand = mulberry32(seed ^ 0x9e3779b9);

  // Start near center
  let cx = (width / 2) | 0;
  let cy = (height / 2) | 0;
  let idx = cy * width + cx;
  order[0] = idx;
  visited[idx] = 1;

  const dirs = [[1,0],[0,1],[-1,0],[0,-1]];
  for (let step = 1; step < total; step++) {
    // Gather unvisited neighbors
    const candidates = [];
    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const ni = ny * width + nx;
        if (!visited[ni]) candidates.push([nx, ny, ni]);
      }
    }
    if (candidates.length === 0) {
      // Jump to a random unvisited cell (keeps walk constrained but connected overall)
      let attempts = 0;
      while (attempts < 100) {
        const rx = Math.floor(rand() * width);
        const ry = Math.floor(rand() * height);
        const ri = ry * width + rx;
        if (!visited[ri]) {
          cx = rx; cy = ry; idx = ri;
          break;
        }
        attempts++;
      }
      if (attempts >= 100) {
        // Fallback: scan for any unvisited
        let found = false;
        for (let i = 0; i < total && !found; i++) {
          if (!visited[i]) {
            cx = i % width; cy = (i / width) | 0; idx = i;
            found = true;
          }
        }
        if (!found) break; // All visited
      }
    } else {
      // Weighted random pick: prefer cells with fewer unvisited neighbors (DLA-like constraint)
      const weights = candidates.map(([nx, ny, ni]) => {
        let free = 0;
        for (const [dx2, dy2] of dirs) {
          const nx2 = nx + dx2, ny2 = ny + dy2;
          if (nx2 >= 0 && nx2 < width && ny2 >= 0 && ny2 < height && !visited[ny2 * width + nx2]) free++;
        }
        return 1 + free; // Higher weight for more open cells (encourages exploration)
      });
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      let pick = rand() * totalWeight;
      let chosen = 0;
      for (let i = 0; i < weights.length; i++) {
        pick -= weights[i];
        if (pick <= 0) { chosen = i; break; }
      }
      [cx, cy, idx] = candidates[chosen];
    }
    order[step] = idx;
    visited[idx] = 1;
  }
  // Invert: for each cell index, store its step number (for sorting colors)
  const stepMap = new Uint32Array(total);
  for (let i = 0; i < total; i++) {
    stepMap[order[i]] = i;
  }
  return stepMap;
}

// ─── Gradient Map Palettes ───
// Predefined palettes for remapping generated colors.
const GRADIENT_PALETTES = {
  none: null,
  sunset: [
    [0xFF, 0x00, 0x55], [0xFF, 0x33, 0x00], [0xFF, 0x66, 0x00],
    [0xFF, 0x99, 0x00], [0xFF, 0xCC, 0x33], [0xFF, 0xFF, 0x66],
    [0xCC, 0x66, 0x99], [0x66, 0x33, 0x99]
  ],
  ocean: [
    [0x00, 0x1F, 0x3F], [0x00, 0x4D, 0x7A], [0x00, 0x7A, 0xCC],
    [0x33, 0x99, 0xFF], [0x66, 0xB2, 0xFF], [0x99, 0xCC, 0xFF],
    [0xCC, 0xE5, 0xFF], [0xE6, 0xF7, 0xFF]
  ],
  monochrome: [
    [0x00, 0x00, 0x00], [0x33, 0x33, 0x33], [0x66, 0x66, 0x66],
    [0x99, 0x99, 0x99], [0xCC, 0xCC, 0xCC], [0xE6, 0xE6, 0xE6],
    [0xF5, 0xF5, 0xF5], [0xFF, 0xFF, 0xFF]
  ],
  neon: [
    [0xFF, 0x00, 0xFF], [0x00, 0xFF, 0xFF], [0x00, 0xFF, 0x00],
    [0xFF, 0xFF, 0x00], [0xFF, 0x00, 0x55], [0xAA, 0x00, 0xFF],
    [0x00, 0x55, 0xFF], [0xFF, 0x55, 0x00]
  ],
  forest: [
    [0x0B, 0x1D, 0x0B], [0x1C, 0x4A, 0x1C], [0x2E, 0x7D, 0x32],
    [0x4C, 0xAF, 0x50], [0x81, 0xC7, 0x84], [0xC8, 0xE6, 0xC9]
  ],
  magma: [
    [0x00, 0x00, 0x04], [0x3B, 0x0F, 0x70], [0x8C, 0x29, 0x8B],
    [0xDE, 0x49, 0x66], [0xF9, 0x77, 0x43], [0xFC, 0xCB, 0x4A]
  ]
};

// Map a color to the nearest palette color by luminance index, then blend.
function applyGradientMap(r, g, b, palette) {
  if (!palette || palette.length === 0) return [r, g, b];
  // Compute relative luminance (0-1)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const idxF = lum * (palette.length - 1);
  const idx0 = Math.max(0, Math.min(palette.length - 1, Math.floor(idxF)));
  const idx1 = Math.min(palette.length - 1, idx0 + 1);
  const t = idxF - idx0;
  const c0 = palette[idx0];
  const c1 = palette[idx1];
  return [
    Math.round(c0[0] + (c1[0] - c0[0]) * t),
    Math.round(c0[1] + (c1[1] - c0[1]) * t),
    Math.round(c0[2] + (c1[2] - c0[2]) * t)
  ];
}

// ─── Dithering ───
// 4x4 Bayer matrix for ordered dithering
const BAYER_4X4 = [
  [ 0,  8,  2, 10],
  [12,  4, 14,  6],
  [ 3, 11,  1,  9],
  [15,  7, 13,  5]
];
function applyDithering(r, g, b, x, y, strength = 1.0) {
  const threshold = (BAYER_4X4[y % 4][x % 4] / 16 - 0.5) * strength * 32;
  return [
    Math.max(0, Math.min(255, Math.round(r + threshold))),
    Math.max(0, Math.min(255, Math.round(g + threshold))),
    Math.max(0, Math.min(255, Math.round(b + threshold)))
  ];
}

// ─── Flow Field Helper ───
// Simple deterministic flow field using overlapping sines (no external noise library).
function flowAngle(x, y, width, height, seed) {
  const scale = 0.008;
  const sx = x * scale + seed * 0.1;
  const sy = y * scale + seed * 0.2;
  return Math.sin(sx) * Math.cos(sy) * Math.PI * 2 +
         Math.sin(sx * 2.3 + sy * 1.7) * 0.5;
}

// ─── Anti-Aliasing Post-Process ───
// Single-pass edge-preserving smoothing. Blends pixels that differ significantly from neighbors.
function applyAntiAliasing(buffer, width, height, strength = 0.3) {
  const len = width * height;
  const out = new Uint8ClampedArray(buffer.length);
  out.set(buffer);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      const r = buffer[i], g = buffer[i + 1], b = buffer[i + 2];
      // Compute local average of filled neighbors
      let sumR = 0, sumG = 0, sumB = 0, count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ni = ((y + dy) * width + (x + dx)) * 4;
          if (buffer[ni + 3] > 0) { // filled
            sumR += buffer[ni];
            sumG += buffer[ni + 1];
            sumB += buffer[ni + 2];
            count++;
          }
        }
      }
      if (count === 0) continue;
      const avgR = sumR / count, avgG = sumG / count, avgB = sumB / count;
      const dist = Math.sqrt((r - avgR) ** 2 + (g - avgG) ** 2 + (b - avgB) ** 2);
      // Only blend strong edges
      if (dist > 40) {
        const blend = strength * Math.min(1, dist / 200);
        out[i] = Math.round(r + (avgR - r) * blend);
        out[i + 1] = Math.round(g + (avgG - g) * blend);
        out[i + 2] = Math.round(b + (avgB - b) * blend);
      }
    }
  }
  buffer.set(out);
}

// ─── Trace (line) renderer ───
// Strokes the chosen traversal curve as one continuous colored polyline —
// the clean "plotted line" aesthetic, as real, deterministic generator output.
// Color advances along the path (0→1) through the gradient map (or a hue sweep
// when no map is set). Renders onto a transparent background so it composites
// over whatever surface holds it (preview canvas, card, export).

// Sample a color at t∈[0,1] along a gradient palette, or a vivid hue sweep if none.
function sampleTraceColor(palette, t) {
  if (!palette || palette.length === 0) {
    return hsv2rgb((t * 320) % 360, 0.82, 0.96);
  }
  const f = t * (palette.length - 1);
  const i0 = Math.max(0, Math.min(palette.length - 1, Math.floor(f)));
  const i1 = Math.min(palette.length - 1, i0 + 1);
  const ft = f - i0;
  const c0 = palette[i0], c1 = palette[i1];
  return [
    Math.round(c0[0] + (c1[0] - c0[0]) * ft),
    Math.round(c0[1] + (c1[1] - c0[1]) * ft),
    Math.round(c0[2] + (c1[2] - c0[2]) * ft)
  ];
}

// Snap a desired cells-per-side to a value the curve can actually tile.
function snapTraceGrid(curveType, target) {
  target = Math.max(4, Math.min(96, target));
  if (curveType === 'peano') {
    const k = Math.max(2, Math.round(Math.log(target) / Math.log(3)));
    return Math.pow(3, k); // 9, 27, 81
  }
  if (curveType === 'hilbert' || curveType === 'morton') {
    const k = Math.max(2, Math.round(Math.log2(target)));
    return 1 << k; // 4, 8, 16, 32, 64
  }
  return Math.round(target); // spiral / randomwalk: any size
}

// A true square spiral PATH (adjacent steps), center-out. The spiral sort key
// used by fill mode only orders cells by radius/angle — it is NOT a drawable
// continuous path — so trace mode walks an actual rectangular spiral instead.
function squareSpiralSequence(G) {
  const path = [];
  let l = 0, r = G - 1, t = 0, b = G - 1;
  while (l <= r && t <= b) {
    for (let x = l; x <= r; x++) path.push([x, t]);
    t++;
    for (let y = t; y <= b; y++) path.push([r, y]);
    r--;
    if (t <= b) { for (let x = r; x >= l; x--) path.push([x, b]); b--; }
    if (l <= r) { for (let y = b; y >= t; y--) path.push([l, y]); l++; }
  }
  path.reverse(); // color blooms from the center outward
  return path;
}

// Ordered visit sequence of grid cells for a curve type (G×G grid).
function buildTraceSequence(curveType, G, seed) {
  if (curveType === 'spiral') return squareSpiralSequence(G);
  const cells = new Array(G * G);
  let k = 0;
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) cells[k++] = [x, y];
  let keyOf;
  if (curveType === 'peano') {
    const order = Math.max(1, Math.round(Math.log(G) / Math.log(3)));
    keyOf = (c) => xyToPeano(c[0], c[1], order);
  } else if (curveType === 'morton') {
    keyOf = (c) => mortonEncode(c[0], c[1]);
  } else if (curveType === 'spiral') {
    keyOf = (c) => xyToSpiral(c[0], c[1], G, G);
  } else if (curveType === 'randomwalk') {
    const sm = generateRandomWalkOrder(G, G, seed);
    keyOf = (c) => sm[c[1] * G + c[0]];
  } else { // hilbert
    const order = Math.max(1, Math.round(Math.log2(G)));
    keyOf = (c) => xyToHilbert(c[0], c[1], order);
  }
  cells.sort((a, b) => keyOf(a) - keyOf(b));
  return cells;
}

// Alpha-blend a color over one pixel (premultiplied-ish, tracks max alpha).
function blendTracePixel(buffer, idx, col, a) {
  const pi = idx * 4;
  const ia = 1 - a;
  buffer[pi]     = col[0] * a + buffer[pi]     * ia;
  buffer[pi + 1] = col[1] * a + buffer[pi + 1] * ia;
  buffer[pi + 2] = col[2] * a + buffer[pi + 2] * ia;
  const na = (255 * a) | 0;
  if (na > buffer[pi + 3]) buffer[pi + 3] = na;
}

// Rasterize one anti-aliased thick segment (round caps via distance-to-segment).
function drawTraceSegment(buffer, W, H, x0, y0, x1, y1, half, col) {
  const minX = Math.max(0, Math.floor(Math.min(x0, x1) - half - 1));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1) + half + 1));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1) - half - 1));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1) + half + 1));
  const dx = x1 - x0, dy = y1 - y0;
  const len2 = dx * dx + dy * dy || 1;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let t = ((x - x0) * dx + (y - y0) * dy) / len2;
      if (t < 0) t = 0; else if (t > 1) t = 1;
      const px = x0 + t * dx, py = y0 + t * dy;
      const d = Math.hypot(x - px, y - py);
      const cov = half - d;
      if (cov <= 0) continue;
      blendTracePixel(buffer, y * W + x, col, cov >= 1 ? 1 : cov);
    }
  }
}

// Render the full trace into a transparent RGBA buffer.
function renderTrace(buffer, W, H, opts) {
  const { curveType, seed, gradientMap, traceStroke, traceDensity } = opts;
  buffer.fill(0); // transparent background
  const G = snapTraceGrid(curveType, traceDensity && traceDensity > 0 ? traceDensity : 32);
  const seq = buildTraceSequence(curveType, G, seed || 1);
  const pad = Math.round(Math.min(W, H) * 0.06);
  const spanX = (W - 2 * pad) / (G - 1);
  const spanY = (H - 2 * pad) / (G - 1);
  const half = Math.max(0.7, Math.min(spanX, spanY) * 0.18 * (traceStroke || 1));
  const palette = GRADIENT_PALETTES[gradientMap] || null;
  const M = seq.length;
  // Pen-up threshold per curve: Hilbert/Peano/Spiral are connected paths (draw
  // every segment); Morton's Z-order has block jumps (keep local steps, drop the
  // canvas-crossing ones); the random walk teleports when stuck (draw true steps
  // only). This keeps every curve a clean line instead of a slash or a dash field.
  let maxJump;
  if (curveType === 'randomwalk') maxJump = 1;
  else if (curveType === 'morton') maxJump = Math.max(2, Math.round(G / 4));
  else if (curveType === 'peano') maxJump = 2; // drop construction slashes, keep local runs
  else maxJump = Infinity; // hilbert, spiral are true continuous paths
  for (let i = 1; i < M; i++) {
    const a = seq[i - 1], b = seq[i];
    const gridDist = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
    if (gridDist <= maxJump) {
      const col = sampleTraceColor(palette, i / (M - 1));
      drawTraceSegment(buffer, W, H,
        pad + a[0] * spanX, pad + a[1] * spanY,
        pad + b[0] * spanX, pad + b[1] * spanY,
        half, col);
    }
    if ((i & 2047) === 0) self.postMessage({ progress: Math.round((i / M) * 90) });
  }
}

// ─── State ───
let isPaused = false;
let totalPixels = 0;
let filledPixels = 0;
let lastProgressUpdate = 0;
let resumeProcessing = null;

// ─── Main Worker Handler ───
self.onmessage = function (e) {
  // Control commands
  if (e.data.command) {
    if (e.data.command === 'pause') {
      isPaused = true;
      return;
    } else if (e.data.command === 'resume') {
      isPaused = false;
      if (typeof resumeProcessing === 'function') resumeProcessing();
      return;
    }
  }

  try {
    const {
      width = 128, height = 128, seed,
      distanceRandomness = 10, colorSampleSize = 100,
      growthMode = 'crystal', seedShape = 'point', symmetryMode = 'quadrantal', colorProgression = 'shuffled',
      branchingFactor = 0.5, growthRate = 1, randomness = 10,
      curveType = 'hilbert',
      patternComplexity = 128,
      optimizeForLargeExport = false,
      previewMode = false,
      exportMode = false,
      colorSpace = 'sRGB',
      dpi = 300,
      transparent = false,
      exactOutputSize = null,
      allRGBMode = false,
      // NEW parameters (backward compatible defaults)
      gradientMap = 'none',
      dithering = false,
      antiAliasing = false,
      // Trace (line) mode
      renderMode = 'fill',
      traceStroke = 1,
      traceDensity = 0
    } = e.data;

    const outputWidth = exactOutputSize || width;
    const outputHeight = exactOutputSize || height;
    const isExport = exportMode || width > 256;

    if (!checkMemory()) {
      self.postMessage({ error: "Browser memory is constrained. Try closing other tabs or restarting your browser." });
      return;
    }

    isPaused = false;
    totalPixels = width * height;
    filledPixels = 0;
    lastProgressUpdate = Date.now();

    // Clear color distance cache for fresh image generation
    clearColorDistCache();

    if (width * height > 16777216) {
      self.postMessage({ error: "Image size too large. Try a smaller export size." });
      return;
    }

    const processingSize = patternComplexity >= 4096 ? patternComplexity : Math.min(4096, patternComplexity * 2);
    const buffer = new Uint8ClampedArray(outputWidth * outputHeight * 4);

    // Initialize buffer
    const alpha = transparent ? 0 : 255;
    for (let i = 0; i < buffer.length; i += 4) {
      buffer[i] = 0; buffer[i + 1] = 0; buffer[i + 2] = 0; buffer[i + 3] = alpha;
    }

    // ─── Trace (line) mode: stroke the curve and return; bypass the fill engine ───
    if (renderMode === 'trace') {
      renderTrace(buffer, outputWidth, outputHeight, {
        curveType, seed, gradientMap, traceStroke, traceDensity
      });
      self.postMessage({ progress: 100 });
      const traceMeta = {
        width: outputWidth, height: outputHeight, colorSpace,
        patternComplexity, transparent: true, dpi
      };
      try {
        self.postMessage({ buffer, metadata: traceMeta }, [buffer.buffer]);
      } catch (err) {
        const copy = new Uint8ClampedArray(buffer.length);
        copy.set(buffer);
        self.postMessage({ buffer: copy.buffer, metadata: traceMeta }, [copy.buffer]);
      }
      return;
    }

    let actualPatternComplexity = patternComplexity;
    if (isExport) {
      const exportScale = patternComplexity >= 4096 ? 1 : Math.min(1, 512 / width);
      actualPatternComplexity = patternComplexity >= 4096 ? patternComplexity : Math.min(patternComplexity, Math.ceil(patternComplexity * exportScale));
    }

    const patternScale = patternComplexity >= 4096 ? patternComplexity / 128 : Math.max(1, Math.min(actualPatternComplexity / 128, 4));
    const steps = optimizeForLargeExport ? 16 : Math.min(32, Math.max(16, Math.floor(16 * Math.sqrt(patternScale))));

    // ─── Color Generation ───
    let colorList = [];

    if (allRGBMode) {
      self.postMessage({ progress: 1 });
      const totalColors = 256 * 256 * 256;
      const allColors = new Uint32Array(totalColors);
      let idx = 0;
      for (let r = 0; r < 256; r++) {
        for (let g = 0; g < 256; g++) {
          for (let b = 0; b < 256; b++) {
            allColors[idx++] = (r << 16) | (g << 8) | b;
          }
        }
      }
      self.postMessage({ progress: 5 });
      const rand = mulberry32(seed);
      for (let i = allColors.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [allColors[i], allColors[j]] = [allColors[j], allColors[i]];
      }
      self.postMessage({ progress: 15 });
      colorList = allColors;
      self.postMessage({ progress: 20 });
    } else {
      const maxColors = Math.min(totalPixels + 1000, 16777216);
      const neededColors = Math.min(maxColors, totalPixels + 1000);
      const localColorSteps = Math.ceil(Math.cbrt(neededColors));
      for (let r = 0; r < localColorSteps; r++) {
        for (let g = 0; g < localColorSteps; g++) {
          for (let b = 0; b < localColorSteps; b++) {
            if (colorList.length >= maxColors) break;
            colorList.push([
              Math.round((r / (localColorSteps - 1)) * 255),
              Math.round((g / (localColorSteps - 1)) * 255),
              Math.round((b / (localColorSteps - 1)) * 255)
            ]);
          }
          if (colorList.length >= maxColors) break;
        }
        if (colorList.length >= maxColors) break;
      }
    }

    const colorSteps = allRGBMode ? 256 : (isExport ? Math.min(steps, 24) : steps);

    // ─── Curve-based Color Ordering ───
    if (!allRGBMode) {
      if (curveType === 'hilbert') {
        const order = Math.ceil(Math.log2(colorSteps));
        colorList.sort((a, b) => {
          const ax = Math.floor(a[0] / 256 * (1 << order));
          const ay = Math.floor(a[1] / 256 * (1 << order));
          const bx = Math.floor(b[0] / 256 * (1 << order));
          const by = Math.floor(b[1] / 256 * (1 << order));
          return xyToHilbert(ax, ay, order) - xyToHilbert(bx, by, order);
        });
      } else if (curveType === 'morton') {
        colorList.sort((a, b) => {
          return mortonEncode(a[0], a[1]) - mortonEncode(b[0], b[1]);
        });
      } else if (curveType === 'peano') {
        const order = Math.max(1, Math.ceil(Math.log(colorSteps) / Math.log(3)));
        colorList.sort((a, b) => {
          const ax = Math.floor(a[0] / 256 * Math.pow(3, order));
          const ay = Math.floor(a[1] / 256 * Math.pow(3, order));
          const bx = Math.floor(b[0] / 256 * Math.pow(3, order));
          const by = Math.floor(b[1] / 256 * Math.pow(3, order));
          return xyToPeano(ax, ay, order) - xyToPeano(bx, by, order);
        });
      } else if (curveType === 'spiral') {
        colorList.sort((a, b) => {
          return xyToSpiral(a[0], a[1], 256, 256) - xyToSpiral(b[0], b[1], 256, 256);
        });
      } else if (curveType === 'randomwalk') {
        // Precompute walk order for a 256x256 grid, then map colors to it
        const walkOrder = generateRandomWalkOrder(256, 256, seed);
        colorList.sort((a, b) => {
          const ia = (Math.floor(a[1]) % 256) * 256 + (Math.floor(a[0]) % 256);
          const ib = (Math.floor(b[1]) % 256) * 256 + (Math.floor(b[0]) % 256);
          return walkOrder[ia] - walkOrder[ib];
        });
      }

      applyColorProgression(colorList, colorProgression, seed);
    }

    const filled = new Uint8Array(width * height);
    let allRGBColorIndex = allRGBMode ? colorList.length : 0;

    // ─── Seeded random for deterministic sampling ───
    const mainRand = mulberry32(seed ^ 0x6c078965);

    // ─── ALLRGB Ultra-Fast Path ───
    if (allRGBMode) {
      const totalPixels = width * height;
      let filledCount = 0;
      const queue = new Uint32Array(totalPixels);
      let queueHead = 0, queueTail = 0;
      const startX = (width / 2) | 0;
      const startY = (height / 2) | 0;
      const startIdx = startY * width + startX;
      queue[queueTail++] = startIdx;
      filled[startIdx] = 1;
      const dx = [1, 0, -1, 0];
      const dy = [0, 1, 0, -1];
      let lastProgress = 0;

      const progressBatch = 500000;

      while (queueHead < queueTail && allRGBColorIndex > 0) {
        const idx = queue[queueHead++];
        const x = idx % width;
        const y = (idx / width) | 0;
        allRGBColorIndex--;
        const packed = colorList[allRGBColorIndex];
        const r = (packed >> 16) & 0xFF;
        const g = (packed >> 8) & 0xFF;
        const b = packed & 0xFF;

        // AllRGB must contain every color exactly once — finish effects
        // (gradient map / dithering / anti-aliasing) are intentionally NOT
        // applied here so the result stays a true AllRGB image.

        const bufIdx = idx * 4;
        buffer[bufIdx] = r;
        buffer[bufIdx + 1] = g;
        buffer[bufIdx + 2] = b;
        buffer[bufIdx + 3] = 255;
        filledCount++;

        for (let d = 0; d < 4; d++) {
          const nx = x + dx[d];
          const ny = y + dy[d];
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const ni = ny * width + nx;
            if (!filled[ni]) {
              filled[ni] = 1;
              queue[queueTail++] = ni;
            }
          }
        }

        if (filledCount % progressBatch === 0) {
          const progress = Math.floor((filledCount / totalPixels) * 100);
          if (progress > lastProgress) {
            lastProgress = progress;
            self.postMessage({ progress: 20 + Math.floor(progress * 0.8) });
          }
        }
      }

      // (no anti-aliasing in AllRGB mode — see note above)

      self.postMessage({ progress: 100 });
      self.postMessage({
        buffer,
        metadata: {
          width: outputWidth,
          height: outputHeight,
          colorSpace,
          patternComplexity: actualPatternComplexity,
          transparent,
          dpi
        }
      }, [buffer.buffer]);
      return;
    }

    // ─── NORMAL MODE ───
    const pq = new PriorityQueue();

    // Seed initialization
    if (seedShape === 'point') {
      pq.push([(width / 2) | 0, (height / 2) | 0], 0);
    } else if (seedShape === 'dual') {
      const cx = (width / 2) | 0, cy = (height / 2) | 0;
      const offset = Math.max(2, Math.floor(Math.min(width, height) / 100));
      pq.push([cx - offset, cy], 0);
      pq.push([cx + offset, cy], 0);
      pq.push([cx, cy], 0);
    } else if (seedShape === 'circle') {
      const cx = (width / 2) | 0, cy = (height / 2) | 0;
      const r = Math.min(width, height) / 4;
      pq.push([cx, cy], 0);
      const numRings = 10;
      for (let ring = 1; ring <= numRings; ring++) {
        const ringRadius = (r * ring) / numRings;
        const circumference = 2 * Math.PI * ringRadius;
        const pointsInRing = Math.max(16, Math.floor(circumference / 2));
        for (let i = 0; i < pointsInRing; i++) {
          const angle = (2 * Math.PI * i) / pointsInRing;
          const x = Math.round(cx + ringRadius * Math.cos(angle));
          const y = Math.round(cy + ringRadius * Math.sin(angle));
          if (x >= 0 && x < width && y >= 0 && y < height) pq.push([x, y], 0);
        }
      }
    } else if (seedShape === 'line') {
      const cy = (height / 2) | 0;
      const step = Math.max(1, Math.floor(width / 100));
      for (let x = 0; x < width; x += step) pq.push([x, cy], 0);
    }

    const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const maxIterationsPerBatch = isExport ? 2000 : 10000;
    const progressUpdateInterval = isExport ? 500 : 1000;
    let iterations = 0;

    // ─── Growth-Mode Specific Setup ───

    // For Organic (DLA-style), we maintain a separate particle array.
    let organicParticles = null;
    if (growthMode === 'organic') {
      organicParticles = [];
      const particleCount = Math.min(width * height, Math.max(500, Math.floor(width * height * 0.05)));
      for (let i = 0; i < particleCount; i++) {
        // Spawn particles from edges
        const edge = Math.floor(mainRand() * 4);
        let px, py;
        if (edge === 0) { px = Math.floor(mainRand() * width); py = 0; }
        else if (edge === 1) { px = width - 1; py = Math.floor(mainRand() * height); }
        else if (edge === 2) { px = Math.floor(mainRand() * width); py = height - 1; }
        else { px = 0; py = Math.floor(mainRand() * height); }
        organicParticles.push({ x: px, y: py, active: true });
      }
    }

    // For Fractal, we use a recursive subdivision queue.
    let fractalQueue = null;
    if (growthMode === 'fractal') {
      fractalQueue = [];
      // Start with the whole canvas as a region
      fractalQueue.push({ x: 0, y: 0, w: width, h: height, depth: 0 });
    }

    // For Flow, we precompute nothing; the flowAngle function guides priorities.

    function processBatch() {
      if (isPaused) return;
      const startTime = Date.now();
      const timeLimit = isExport ? 500 : 1000;
      const checkInterval = 500;
      iterations = 0;

      while (
        (growthMode === 'fractal' ? fractalQueue.length > 0 : pq.length > 0) &&
        colorList.length > 0 &&
        iterations < maxIterationsPerBatch &&
        !isPaused
      ) {
        if (iterations % checkInterval === 0 && Date.now() - startTime > timeLimit) break;
        iterations++;

        // ─── Fractal Growth Mode ───
        // Recursively subdivide regions and fill them in quadrant order.
        if (growthMode === 'fractal') {
          const region = fractalQueue.shift();
          if (!region) continue;
          const { x, y, w, h, depth } = region;
          if (w <= 0 || h <= 0) continue;

          // Fill the border of this region first, then subdivide interior
          const perimeter = [];
          for (let ix = x; ix < x + w; ix++) {
            perimeter.push([ix, y]);
            if (h > 1) perimeter.push([ix, y + h - 1]);
          }
          for (let iy = y + 1; iy < y + h - 1; iy++) {
            perimeter.push([x, iy]);
            if (w > 1) perimeter.push([x + w - 1, iy]);
          }

          // Shuffle perimeter based on depth for variety
          const regionRand = mulberry32(seed ^ depth ^ 0x9e3779b9);
          for (let i = perimeter.length - 1; i > 0; i--) {
            const j = Math.floor(regionRand() * (i + 1));
            [perimeter[i], perimeter[j]] = [perimeter[j], perimeter[i]];
          }

          for (const [px, py] of perimeter) {
            if (px < 0 || px >= width || py < 0 || py >= height) continue;
            const pi = py * width + px;
            if (filled[pi] || colorList.length === 0) continue;
            let color = colorList.pop();
            let r = color[0], g = color[1], b = color[2];
            if (gradientMap !== 'none' && GRADIENT_PALETTES[gradientMap]) {
              [r, g, b] = applyGradientMap(r, g, b, GRADIENT_PALETTES[gradientMap]);
            }
            if (dithering) {
              [r, g, b] = applyDithering(r, g, b, px, py, 1.0);
            }
            filled[pi] = 1;
            const pBufIdx = pi * 4;
            buffer[pBufIdx] = r; buffer[pBufIdx + 1] = g; buffer[pBufIdx + 2] = b; buffer[pBufIdx + 3] = 255;
            filledPixels++;
          }

          // Subdivide interior into quadrants
          if (w > 2 && h > 2) {
            const hw = Math.floor(w / 2);
            const hh = Math.floor(h / 2);
            // Push quadrants in random order for organic feel
            const quadrants = [
              { x: x, y: y, w: hw, h: hh, depth: depth + 1 },
              { x: x + hw, y: y, w: w - hw, h: hh, depth: depth + 1 },
              { x: x, y: y + hh, w: hw, h: h - hh, depth: depth + 1 },
              { x: x + hw, y: y + hh, w: w - hw, h: h - hh, depth: depth + 1 }
            ];
            const regionRand = mulberry32(seed ^ depth ^ 0x7f4a7c15);
            for (let i = quadrants.length - 1; i > 0; i--) {
              const j = Math.floor(regionRand() * (i + 1));
              [quadrants[i], quadrants[j]] = [quadrants[j], quadrants[i]];
            }
            for (const q of quadrants) fractalQueue.push(q);
          }
          continue;
        }

        // ─── Organic Growth Mode (DLA-inspired) ───
        if (growthMode === 'organic') {
          let anyStuck = false;
          for (let p = 0; p < organicParticles.length && colorList.length > 0; p++) {
            const part = organicParticles[p];
            if (!part.active) continue;

            // Random walk step
            const dir = Math.floor(mainRand() * 4);
            const ddx = neighbors[dir][0];
            const ddy = neighbors[dir][1];
            part.x += ddx;
            part.y += ddy;

            // Bounce off walls
            if (part.x < 0) part.x = 0;
            if (part.x >= width) part.x = width - 1;
            if (part.y < 0) part.y = 0;
            if (part.y >= height) part.y = height - 1;

            const pi = part.y * width + part.x;
            if (filled[pi]) {
              // Check if any neighbor is unfilled -> "stick" adjacent to structure
              const stickDirs = [];
              for (const [sdx, sdy] of neighbors) {
                const sx = part.x + sdx, sy = part.y + sdy;
                if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
                  const si = sy * width + sx;
                  if (!filled[si]) stickDirs.push([sx, sy]);
                }
              }
              if (stickDirs.length > 0 && colorList.length > 0) {
                const [sx, sy] = stickDirs[Math.floor(mainRand() * stickDirs.length)];
                const si = sy * width + sx;
                let color = colorList.pop();
                let r = color[0], g = color[1], b = color[2];
                if (gradientMap !== 'none' && GRADIENT_PALETTES[gradientMap]) {
                  [r, g, b] = applyGradientMap(r, g, b, GRADIENT_PALETTES[gradientMap]);
                }
                if (dithering) {
                  [r, g, b] = applyDithering(r, g, b, sx, sy, 1.0);
                }
                filled[si] = 1;
                const sBufIdx = si * 4;
                buffer[sBufIdx] = r; buffer[sBufIdx + 1] = g; buffer[sBufIdx + 2] = b; buffer[sBufIdx + 3] = 255;
                filledPixels++;
                anyStuck = true;

                // Respawn particle
                const edge = Math.floor(mainRand() * 4);
                if (edge === 0) { part.x = Math.floor(mainRand() * width); part.y = 0; }
                else if (edge === 1) { part.x = width - 1; part.y = Math.floor(mainRand() * height); }
                else if (edge === 2) { part.x = Math.floor(mainRand() * width); part.y = height - 1; }
                else { part.x = 0; part.y = Math.floor(mainRand() * height); }
              } else {
                // Fully surrounded, respawn
                part.active = false;
              }
            }
          }
          // If too few active particles, respawn some
          const activeCount = organicParticles.filter(p => p.active).length;
          if (activeCount < organicParticles.length * 0.3) {
            for (let i = 0; i < organicParticles.length; i++) {
              if (!organicParticles[i].active) {
                const edge = Math.floor(mainRand() * 4);
                if (edge === 0) { organicParticles[i].x = Math.floor(mainRand() * width); organicParticles[i].y = 0; }
                else if (edge === 1) { organicParticles[i].x = width - 1; organicParticles[i].y = Math.floor(mainRand() * height); }
                else if (edge === 2) { organicParticles[i].x = Math.floor(mainRand() * width); organicParticles[i].y = height - 1; }
                else { organicParticles[i].x = 0; organicParticles[i].y = Math.floor(mainRand() * height); }
                organicParticles[i].active = true;
              }
            }
          }
          // Continue next frame if still colors and pixels left
          if (colorList.length > 0 && filledPixels < totalPixels) {
            // Progress
            const now = Date.now();
            if (now - lastProgressUpdate > progressUpdateInterval) {
              const progressPercent = Math.min(100, Math.floor((filledPixels / totalPixels) * 100));
              self.postMessage({ progress: progressPercent });
              lastProgressUpdate = now;
            }
            setTimeout(processBatch, 0);
            return;
          }
          // Fall through to final completion below
          break;
        }

        // ─── Standard Priority-Queue Growth (crystal, nebula, rings, flow) ───
        const [x, y] = pq.pop();
        // Honor every symmetry mode (incl. radial) at all sizes — exports
        // previously dropped radial silently, which broke "what you preview
        // is what you export".
        const coords = getSymmetryCoords(x, y, width, height, symmetryMode);

        let pixelsFilled = 0;
        for (const [mx, my] of coords) {
          const i = my * width + mx;
          if (mx < 0 || mx >= width || my < 0 || my >= height) continue;
          if (filled[i] || colorList.length === 0) continue;

          // Neighbor averaging for color matching
          // Optimized: loop unrolled for the 4 cardinal directions to avoid loop overhead
          let count = 0, nr = 0, ng = 0, nb = 0;

          // Right neighbor
          let nx = mx + 1, ny = my;
          if (nx < width) {
            const ni = ny * width + nx;
            if (filled[ni]) {
              nr += buffer[ni * 4 + 0];
              ng += buffer[ni * 4 + 1];
              nb += buffer[ni * 4 + 2];
              count++;
            }
          }

          // Left neighbor
          nx = mx - 1;
          if (nx >= 0) {
            const ni = ny * width + nx;
            if (filled[ni]) {
              nr += buffer[ni * 4 + 0];
              ng += buffer[ni * 4 + 1];
              nb += buffer[ni * 4 + 2];
              count++;
            }
          }

          // Down neighbor
          nx = mx; ny = my + 1;
          if (ny < height) {
            const ni = ny * width + nx;
            if (filled[ni]) {
              nr += buffer[ni * 4 + 0];
              ng += buffer[ni * 4 + 1];
              nb += buffer[ni * 4 + 2];
              count++;
            }
          }

          // Up neighbor
          ny = my - 1;
          if (ny >= 0) {
            const ni = ny * width + nx;
            if (filled[ni]) {
              nr += buffer[ni * 4 + 0];
              ng += buffer[ni * 4 + 1];
              nb += buffer[ni * 4 + 2];
              count++;
            }
          }

          let color;
          let r, g, b;
          if (count === 0) {
            color = colorList.pop();
            r = color[0]; g = color[1]; b = color[2];
          } else {
            const avg = [nr / count, ng / count, nb / count];
            let bestIdx = 0, bestDist = Infinity;
            const useExhaustive = totalPixels <= 262144;
            const searchSize = useExhaustive ? colorList.length : Math.min(colorList.length, colorSampleSize);
            if (useExhaustive) {
              for (let j = 0; j < colorList.length; j++) {
                const dist = colorDistSq(colorList[j], avg);
                if (dist < bestDist) { bestDist = dist; bestIdx = j; }
              }
            } else {
              bestIdx = pickClosestColorFromSample(colorList, avg, mainRand, searchSize);
            }
            color = colorList.splice(bestIdx, 1)[0];
            r = color[0]; g = color[1]; b = color[2];
          }

          // Apply gradient map
          if (gradientMap !== 'none' && GRADIENT_PALETTES[gradientMap]) {
            [r, g, b] = applyGradientMap(r, g, b, GRADIENT_PALETTES[gradientMap]);
          }
          // Apply dithering
          if (dithering) {
            [r, g, b] = applyDithering(r, g, b, mx, my, 1.0);
          }

          filled[i] = 1;
          pixelsFilled++;
          const bufIdx = i * 4;
          buffer[bufIdx + 0] = r;
          buffer[bufIdx + 1] = g;
          buffer[bufIdx + 2] = b;
          buffer[bufIdx + 3] = 255;

          // Add neighbors with growth-mode-specific priority
          for (const [dx2, dy2] of neighbors) {
            const nx = mx + dx2, ny = my + dy2;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const ni = ny * width + nx;
              if (!filled[ni]) {
                const isEdgePixel = nx === 0 || nx === width - 1 || ny === 0 || ny === height - 1;
                if (branchingFactor < 1 && !isEdgePixel) {
                  const branchProbability = 0.5 + branchingFactor * 0.5;
                  if (mainRand() > branchProbability) continue;
                }

                let priority;
                const dist = Math.hypot(nx - width / 2, ny - height / 2);
                // Honor distanceRandomness at every size (was hardcoded to 5 on
                // exports/large previews, so the export didn't match the preview).
                // The dist/(width/2) term normalizes the magnitude across sizes.
                const distRand = (mainRand() - 0.5) * distanceRandomness * (dist / (width / 2));

                if (growthMode === 'crystal') {
                  priority = dist + (mainRand() - 0.5) * randomness + distRand;
                } else if (growthMode === 'nebula') {
                  priority = (mainRand() - 0.5) * randomness + dist * 0.2 + distRand;
                } else if (growthMode === 'rings') {
                  const ringSpacing = width / 10;
                  priority = Math.abs(Math.sin(dist / ringSpacing * Math.PI)) * 5 + (mainRand() - 0.5) * randomness + distRand;
                } else if (growthMode === 'flow') {
                  // Flow field: priority favors moving along the local flow angle
                  const angle = flowAngle(nx, ny, width, height, seed);
                  const flowX = Math.cos(angle);
                  const flowY = Math.sin(angle);
                  const outward = (nx - width / 2) / (width / 2);
                  const upward = (ny - height / 2) / (height / 2);
                  const alignment = flowX * outward + flowY * upward;
                  priority = dist - alignment * randomness * 2 + (mainRand() - 0.5) * randomness + distRand;
                } else {
                  priority = dist + (mainRand() - 0.5) * randomness + distRand;
                }
                // Growth rate reshapes the radial gradient relative to the noise:
                // 1 = unchanged (default); higher flattens it so growth expands
                // outward faster; lower steepens it for tighter, slower growth.
                // (Identity at growthRate === 1, so default output is unchanged.)
                priority -= (growthRate - 1) * dist;
                pq.push([nx, ny], priority);
              }
            }
          }
        }

        filledPixels += pixelsFilled;

        // Batched progress updates
        const now = Date.now();
        if (now - lastProgressUpdate > progressUpdateInterval) {
          const progressPercent = Math.min(100, Math.floor((filledPixels / totalPixels) * 100));
          const previewInterval = Math.max(5, Math.floor(100 / 20));
          const shouldSendPreview = !allRGBMode && (progressPercent % previewInterval === 0 || progressPercent < 10);
          if (shouldSendPreview && progressPercent > 0) {
            const previewBuffer = buffer.slice();
            self.postMessage({
              preview: true,
              buffer: previewBuffer,
              progress: progressPercent,
              metadata: { width: outputWidth, height: outputHeight, colorSpace, filledPixels, totalPixels }
            });
          } else {
            self.postMessage({ progress: progressPercent });
          }
          lastProgressUpdate = now;
        }
      }

      // ─── Continue or finish ───
      const stillGrowing = growthMode === 'fractal'
        ? fractalQueue.length > 0
        : growthMode === 'organic'
          ? filledPixels < totalPixels && colorList.length > 0
          : pq.length > 0 && colorList.length > 0;

      if (stillGrowing && !isPaused) {
        const progressPercent = Math.min(100, Math.floor((filledPixels / totalPixels) * 100));
        self.postMessage({ progress: progressPercent });
        setTimeout(processBatch, isExport ? 10 : 0);
      } else if (isPaused) {
        // Wait for resume
      } else {
        // Finalize
        if (antiAliasing) {
          applyAntiAliasing(buffer, width, height, 0.3);
        }
        self.postMessage({ progress: 100 });
        if (!buffer || buffer.length === 0) {
          self.postMessage({ error: "Failed to generate image - buffer is empty" });
          return;
        }
        try {
          self.postMessage({
            buffer,
            metadata: {
              width: outputWidth,
              height: outputHeight,
              colorSpace,
              patternComplexity: actualPatternComplexity,
              transparent,
              dpi
            }
          }, [buffer.buffer]);
          resumeProcessing = null;
        } catch (err) {
          console.error("Error transferring buffer:", err);
          const bufferCopy = new Uint8ClampedArray(buffer.length);
          bufferCopy.set(buffer);
          self.postMessage({
            buffer: bufferCopy.buffer,
            metadata: {
              width: outputWidth,
              height: outputHeight,
              colorSpace,
              patternComplexity: actualPatternComplexity,
              transparent,
              dpi
            }
          }, [bufferCopy.buffer]);
          resumeProcessing = null;
        }
      }
    }

    resumeProcessing = processBatch;
    processBatch();

  } catch (error) {
    resumeProcessing = null;
    console.error("Worker error:", error);
    self.postMessage({ error: error.message || "Unknown error in worker" });
  }
};
