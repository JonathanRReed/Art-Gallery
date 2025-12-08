// color-mapper.js (Web Worker)
// Seeded shuffle (Fisher-Yates)
function seededShuffle(array, seed) {
  function mulberry32(a) {
    return function () {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
  }
  const rand = mulberry32(seed);
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return rand;
}

// Priority queue for organic growth
class PriorityQueue {
  constructor() { this.data = []; }
  push(item, priority) {
    this.data.push({ item, priority });
  }
  pop() {
    if (this.data.length === 0) return null;
    let minIdx = 0;
    for (let i = 1; i < this.data.length; i++) {
      if (this.data[i].priority < this.data[minIdx].priority) minIdx = i;
    }
    const [entry] = this.data.splice(minIdx, 1);
    return entry.item;
  }
  get length() { return this.data.length; }
}

// Helper to mirror coordinates for quadrantal symmetry
function mirrorCoords(x, y, width, height) {
  const mx = width - 1 - x;
  const my = height - 1 - y;
  return [
    [x, y],
    [mx, y],
    [x, my],
    [mx, my]
  ];
}

function colorDistSq(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function pickClosestColorFromSample(palette, target, rand, sampleSize = 100) {
  let bestIdx = 0, bestDist = Infinity;
  for (let s = 0; s < sampleSize && palette.length > 0; s++) {
    const j = Math.floor(rand() * palette.length);
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

function permuteHSV(h, s, v, curveType, colorOrdering) {
  // Permute HSV axes based on colorOrdering and curveType
  let arr = [h, s, v];
  // Color ordering: treat as permutation of HSV
  const order = (colorOrdering || 'hsv').toLowerCase();
  let idx = [0, 1, 2];
  if (order === 'hsv') idx = [0, 1, 2];
  else if (order === 'hvs') idx = [0, 2, 1];
  else if (order === 'shv') idx = [1, 0, 2];
  else if (order === 'svh') idx = [1, 2, 0];
  else if (order === 'vhs') idx = [2, 0, 1];
  else if (order === 'vsh') idx = [2, 1, 0];
  // Curve type: rotate hue for Morton, etc.
  if (curveType === 'morton') arr[0] = (arr[0] + 120) % 360;
  if (curveType === 'hilbert') arr[0] = (arr[0] + 240) % 360;
  return [arr[idx[0]], arr[idx[1]], arr[idx[2]]];
}

function simpleHash(x, y, seed) {
  // Simple hash for pseudo-randomness
  let h = x * 374761393 + y * 668265263 + seed * 982451653;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

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
    const theta = Math.atan2(dy, dx);
    const n = 8; // 8-fold radial
    const coords = [];
    for (let i = 0; i < n; i++) {
      const angle = theta + (2 * Math.PI * i) / n;
      const rx = Math.round(cx + r * Math.cos(angle));
      const ry = Math.round(cy + r * Math.sin(angle));
      if (rx >= 0 && rx < width && ry >= 0 && ry < height) coords.push([rx, ry]);
    }
    return coords;
  }
  return [[x, y]];
}

// Helper function to check available memory (approximate)
function checkMemory() {
  try {
    // Try to allocate a large array to test memory
    const testSize = 1024 * 1024 * 10; // 10MB test
    const testArray = new Uint8Array(testSize);
    // Fill with data to ensure it's allocated
    testArray[0] = 1;
    testArray[testSize - 1] = 1;
    return true; // Memory available
  } catch (e) {
    console.error("Memory test failed:", e);
    return false; // Memory constrained
  }
}

// Track processing state
let isPaused = false;
let totalPixels = 0;
let filledPixels = 0;
let lastProgressUpdate = 0;

// Handle messages
self.onmessage = function (e) {
  // Check for control commands
  if (e.data.command) {
    if (e.data.command === 'pause') {
      isPaused = true;
      console.log("Worker paused");
      return;
    } else if (e.data.command === 'resume') {
      isPaused = false;
      console.log("Worker resumed");
      processBatch(); // Resume processing
      return;
    }
  }

  try {
    const {
      width = 128, height = 128, seed,
      symmetry = true, distanceRandomness = 10, colorSampleSize = 100,
      growthMode = 'crystal', seedShape = 'point', symmetryMode = 'quadrantal', colorProgression = 'shuffled',
      branchingFactor = 0.5, growthRate = 1, randomness = 10,
      curveType = 'hilbert', colorOrdering = 'hsv',
      patternComplexity = 128, // Parameter for pattern detail
      optimizeForLargeExport = false, // Flag for large exports
      previewMode = false, // Flag for preview mode
      exportMode = false, // Flag for export mode
      colorSpace = 'sRGB', // Color profile
      dpi = 300, // DPI for exports
      transparent = false, // Whether background should be transparent
      exactOutputSize = null, // Force specific output size for exports
      allRGBMode = false // NEW: True AllRGB mode - all 16.7M colors, each used exactly once
    } = e.data;

    // If exactOutputSize is provided, override width and height for output
    const outputWidth = exactOutputSize || width;
    const outputHeight = exactOutputSize || height;

    // Log important parameters for debugging
    console.log(`Worker processing: width=${width}, height=${height}, patternComplexity=${patternComplexity}, outputSize=${outputWidth}x${outputHeight}`);
    console.log(`Params: colorSpace=${colorSpace}, transparent=${transparent}, isExport=${exportMode}`);

    // Additional debug for size settings
    if (patternComplexity >= 4096) {
      console.log('⚠️ EXTREME SIZE DETECTED: Using special processing for 4096px pattern');
    }

    // First, check if this is an export or preview
    const isExport = exportMode || width > 256;

    // Check for memory constraints
    if (!checkMemory()) {
      self.postMessage({ error: "Browser memory is constrained. Try closing other tabs or restarting your browser." });
      return;
    }

    // Calculate expected memory usage
    const estimatedMem = width * height * 4 * 2; // Image buffer plus overhead
    console.log(`Estimated memory usage: ${Math.round(estimatedMem / (1024 * 1024))}MB`);

    // Reset tracking variables
    isPaused = false;
    totalPixels = width * height;
    filledPixels = 0;
    lastProgressUpdate = Date.now();

    // Catch potential memory issues for very large generations
    if (width * height > 16777216) { // 4096 * 4096
      self.postMessage({ error: "Image size too large. Try a smaller export size." });
      return;
    }

    try {
      // We'll use a fixed pattern size for processing regardless of output size
      // For Extreme (4096) setting, use the full size, otherwise limit to 4096
      const processingSize = patternComplexity >= 4096 ?
        patternComplexity : // Use exact size for Extreme setting
        Math.min(4096, patternComplexity * 2); // Otherwise use standard scaling logic

      // Pre-allocate buffer for the requested output size
      const buffer = new Uint8ClampedArray(outputWidth * outputHeight * 4);
      console.log(`Buffer allocated: ${buffer.byteLength} bytes for ${outputWidth}x${outputHeight} output image`);

      // Initialize buffer with transparency
      for (let i = 0; i < buffer.length; i += 4) {
        buffer[i] = 0;     // R
        buffer[i + 1] = 0;   // G
        buffer[i + 2] = 0;   // B
        buffer[i + 3] = transparent ? 0 : 255; // A (transparent if requested)
      }

      // For exports, limit pattern complexity based on export size to prevent timeouts
      let actualPatternComplexity = patternComplexity;
      if (isExport) {
        // Scale down pattern complexity for exports to prevent timeouts
        // But respect the 4096 setting for "Extreme" pattern size - no scaling down
        const exportScale = patternComplexity >= 4096 ? 1 : Math.min(1, 512 / width);
        actualPatternComplexity = patternComplexity >= 4096 ?
          patternComplexity : // Never reduce 4096 setting
          Math.min(patternComplexity, Math.ceil(patternComplexity * exportScale));
        console.log(`Adjusted pattern complexity for export: ${actualPatternComplexity} (original: ${patternComplexity})`);
      }

      // Special color profile handling for Display P3
      // In the future, could implement color space transformations
      const useWideGamut = colorSpace === 'Display P3';
      if (useWideGamut) {
        console.log("Using Display P3 wide color gamut");
      }

      // Define scaling factor based on pattern complexity
      // Allow full scaling for Extreme (4096) setting with no limits
      const patternScale = patternComplexity >= 4096 ?
        patternComplexity / 128 : // Full scale for Extreme with no max limit
        Math.max(1, Math.min(actualPatternComplexity / 128, 4)); // Previous limit

      // Calculate color steps - simplified to avoid excessive computation
      const steps = optimizeForLargeExport ? 16 : Math.min(32, Math.max(16, Math.floor(16 * Math.sqrt(patternScale))));

      // For exports, reduce sample size and randomness to improve performance
      const actualSampleSize = optimizeForLargeExport ? Math.min(30, colorSampleSize) :
        isExport ? Math.min(50, colorSampleSize) : colorSampleSize;
      const actualRandomness = optimizeForLargeExport ? randomness * 0.5 :
        isExport ? randomness * 0.7 : randomness;

      // ========== HILBERT CURVE IMPLEMENTATION ==========
      // Convert (x, y) to Hilbert curve index
      function xyToHilbert(x, y, order) {
        let rx, ry, s, d = 0;
        const n = 1 << order; // 2^order
        for (s = n / 2; s > 0; s = Math.floor(s / 2)) {
          rx = (x & s) > 0 ? 1 : 0;
          ry = (y & s) > 0 ? 1 : 0;
          d += s * s * ((3 * rx) ^ ry);
          // Rotate
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

      // Convert Hilbert index to (x, y)
      function hilbertToXY(d, order) {
        let rx, ry, s, t = d;
        const n = 1 << order;
        let x = 0, y = 0;
        for (s = 1; s < n; s *= 2) {
          rx = 1 & Math.floor(t / 2);
          ry = 1 & (t ^ rx);
          // Rotate
          if (ry === 0) {
            if (rx === 1) {
              x = s - 1 - x;
              y = s - 1 - y;
            }
            [x, y] = [y, x];
          }
          x += s * rx;
          y += s * ry;
          t = Math.floor(t / 4);
        }
        return [x, y];
      }

      // ========== MORTON (Z-ORDER) CURVE IMPLEMENTATION ==========
      // Interleave bits for Morton code
      function mortonEncode(x, y) {
        function spreadBits(v) {
          v = (v | (v << 8)) & 0x00FF00FF;
          v = (v | (v << 4)) & 0x0F0F0F0F;
          v = (v | (v << 2)) & 0x33333333;
          v = (v | (v << 1)) & 0x55555555;
          return v;
        }
        return spreadBits(x) | (spreadBits(y) << 1);
      }

      // Decode Morton code to (x, y)
      function mortonDecode(z) {
        function compactBits(v) {
          v = v & 0x55555555;
          v = (v | (v >> 1)) & 0x33333333;
          v = (v | (v >> 2)) & 0x0F0F0F0F;
          v = (v | (v >> 4)) & 0x00FF00FF;
          v = (v | (v >> 8)) & 0x0000FFFF;
          return v;
        }
        return [compactBits(z), compactBits(z >> 1)];
      }

      // ========== RGB TO HSV CONVERSION ==========
      function rgbToHSV(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const d = max - min;
        let h = 0, s = max === 0 ? 0 : d / max, v = max;
        if (max !== min) {
          switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
          }
          h /= 6;
        }
        return [h * 360, s, v]; // h in degrees, s and v normalized
      }

      // ========== COLOR ORDERING (HSV PERMUTATIONS) ==========
      function getColorSortKey(color, ordering) {
        const [h, s, v] = rgbToHSV(color[0], color[1], color[2]);
        const order = (ordering || 'hsv').toLowerCase();
        // Return sort key based on ordering - each component weighted for proper sorting
        switch (order) {
          case 'hsv': return h * 10000 + s * 100 + v;
          case 'hvs': return h * 10000 + v * 100 + s;
          case 'shv': return s * 10000 + h * 100 + v;
          case 'svh': return s * 10000 + v * 100 + h / 360;
          case 'vhs': return v * 10000 + h * 100 + s;
          case 'vsh': return v * 10000 + s * 100 + h / 360;
          default: return h * 10000 + s * 100 + v;
        }
      }

      // ========== COLOR PROGRESSION MODES ==========
      function applyColorProgression(colors, mode, seed) {
        if (mode === 'sequential') {
          // Sort by HSV for smooth gradient-like progression
          return colors.sort((a, b) => getColorSortKey(a, colorOrdering) - getColorSortKey(b, colorOrdering));
        } else if (mode === 'base-distance') {
          // Sort by distance from a base color (seed-determined)
          const rand = mulberry32(seed);
          const baseIdx = Math.floor(rand() * colors.length);
          const baseColor = colors[baseIdx] || [128, 128, 128];
          return colors.sort((a, b) => {
            const distA = colorDistSq(a, baseColor);
            const distB = colorDistSq(b, baseColor);
            return distA - distB;
          });
        } else {
          // 'shuffled' - use seeded shuffle (already implemented)
          seededShuffle(colors, seed);
          return colors;
        }
      }

      // Seeded random generator for color progression
      function mulberry32(a) {
        return function () {
          var t = a += 0x6D2B79F5;
          t = Math.imul(t ^ t >>> 15, t | 1);
          t ^= t + Math.imul(t ^ t >>> 7, t | 61);
          return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
      }

      // ========== ALLRGB MODE: Generate ALL 16,777,216 unique colors ==========
      let colorList = [];
      let colorSet = null; // For AllRGB mode tracking

      if (allRGBMode) {
        console.log('🎨 AllRGB Mode: Generating all 16,777,216 unique colors...');
        self.postMessage({ progress: 1 });

        // For AllRGB, we need exactly 4096x4096 = 16,777,216 pixels
        // Each pixel gets a unique color from 256^3 = 16,777,216 colors
        const totalColors = 256 * 256 * 256;

        // Generate all colors - use Uint32Array for memory efficiency
        // Pack RGB into single integers for faster lookup
        const allColors = new Uint32Array(totalColors);
        let idx = 0;
        for (let r = 0; r < 256; r++) {
          for (let g = 0; g < 256; g++) {
            for (let b = 0; b < 256; b++) {
              allColors[idx++] = (r << 16) | (g << 8) | b;
            }
          }
        }
        console.log(`Generated ${allColors.length} packed colors`);
        self.postMessage({ progress: 5 });

        // Create a seeded random function for shuffling
        const rand = mulberry32(seed);

        // Fisher-Yates shuffle on the packed colors
        for (let i = allColors.length - 1; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1));
          [allColors[i], allColors[j]] = [allColors[j], allColors[i]];
        }
        console.log('Shuffled all colors');
        self.postMessage({ progress: 15 });

        // OPTIMIZATION: Keep colors packed as Uint32Array instead of unpacking
        // This saves ~50MB memory and avoids 16.7M array allocations
        // We'll unpack on-demand when setting pixels
        colorList = allColors; // Keep as Uint32Array!
        console.log(`AllRGB: Using packed Uint32Array with ${colorList.length} colors (saved ~50MB)`);
        self.postMessage({ progress: 20 });

      } else {
        // Original non-AllRGB color generation
        // Limit colors for export to improve performance
        const maxColors = isExport ? (optimizeForLargeExport ? 10000 : 20000) : 100000;

        // Generate a smaller palette for exports
        const localColorSteps = isExport ? Math.min(steps, 24) : steps;
        for (let r = 0; r < localColorSteps; r++) {
          for (let g = 0; g < localColorSteps; g++) {
            for (let b = 0; b < localColorSteps; b++) {
              // Stop adding colors if we've reached the limit
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

      // Define colorSteps for curve ordering (256 for AllRGB, calculated for normal mode)
      const colorSteps = allRGBMode ? 256 : (isExport ? Math.min(steps, 24) : steps);

      // ========== APPLY CURVE TYPE TO COLOR ORDERING ==========
      // SKIP for AllRGB - sorting 16.7M colors is extremely slow!
      // AllRGB colors are already shuffled and will look good with growth pattern
      if (!allRGBMode) {
        if (curveType === 'hilbert') {
          // Sort colors using Hilbert curve for better locality
          const order = Math.ceil(Math.log2(colorSteps));
          colorList.sort((a, b) => {
            // Map color to position in color space cube
            const ax = Math.floor(a[0] / 256 * (1 << order));
            const ay = Math.floor(a[1] / 256 * (1 << order));
            const bx = Math.floor(b[0] / 256 * (1 << order));
            const by = Math.floor(b[1] / 256 * (1 << order));
            return xyToHilbert(ax, ay, order) - xyToHilbert(bx, by, order);
          });
          console.log('Applied Hilbert curve ordering to colors');
        } else if (curveType === 'morton') {
          // Sort colors using Morton/Z-order curve
          colorList.sort((a, b) => {
            const ax = Math.floor(a[0]);
            const ay = Math.floor(a[1]);
            const bx = Math.floor(b[0]);
            const by = Math.floor(b[1]);
            return mortonEncode(ax, ay) - mortonEncode(bx, by);
          });
          console.log('Applied Morton curve ordering to colors');
        }

        // ========== APPLY COLOR PROGRESSION ==========
        applyColorProgression(colorList, colorProgression, seed);
        console.log(`Applied ${colorProgression} color progression, generated ${colorList.length} colors`);
      } else {
        console.log(`AllRGB: Skipped curve ordering and progression (16.7M colors already shuffled)`);
      }


      const filled = new Uint8Array(width * height);

      // For AllRGB: track index into packed Uint32Array
      let allRGBColorIndex = allRGBMode ? colorList.length : 0;

      // ========== ALLRGB ULTRA-FAST PATH ==========
      // Use simple BFS instead of priority queue for massive speedup
      if (allRGBMode) {
        console.log('🚀 AllRGB: Using ultra-fast BFS fill algorithm');
        const totalPixels = width * height;
        let filledCount = 0;

        // Simple queue using array with head pointer (faster than shift())
        const queue = new Uint32Array(totalPixels); // Store pixel indices
        let queueHead = 0;
        let queueTail = 0;

        // Start from center
        const startX = (width / 2) | 0;
        const startY = (height / 2) | 0;
        const startIdx = startY * width + startX;
        queue[queueTail++] = startIdx;
        filled[startIdx] = 1;

        // Neighbors: right, down, left, up
        const dx = [1, 0, -1, 0];
        const dy = [0, 1, 0, -1];

        const startTime = Date.now();
        let lastProgress = 0;

        // BFS fill - no priority, no averaging, just fill!
        while (queueHead < queueTail && allRGBColorIndex > 0) {
          const idx = queue[queueHead++];
          const x = idx % width;
          const y = (idx / width) | 0;

          // Get next color from packed array
          allRGBColorIndex--;
          const packed = colorList[allRGBColorIndex];
          const r = (packed >> 16) & 0xFF;
          const g = (packed >> 8) & 0xFF;
          const b = packed & 0xFF;

          // Set pixel
          const bufIdx = idx * 4;
          buffer[bufIdx] = r;
          buffer[bufIdx + 1] = g;
          buffer[bufIdx + 2] = b;
          buffer[bufIdx + 3] = 255;
          filledCount++;

          // Add unfilled neighbors to queue
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

          // Progress update every 500K pixels
          if (filledCount % 500000 === 0) {
            const progress = Math.floor((filledCount / totalPixels) * 100);
            if (progress > lastProgress) {
              lastProgress = progress;
              self.postMessage({ progress: 20 + Math.floor(progress * 0.8) }); // 20-100%
              console.log(`AllRGB: ${progress}% complete (${filledCount.toLocaleString()} pixels, ${((Date.now() - startTime) / 1000).toFixed(1)}s)`);
            }
          }
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✅ AllRGB complete: ${filledCount.toLocaleString()} pixels in ${elapsed}s`);

        // Send the result
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
        return; // Exit early - we're done!
      }

      // ========== NORMAL MODE (non-AllRGB) ==========
      const pq = new PriorityQueue();

      // Add initial seeds
      if (seedShape === 'point') {
        pq.push([(width / 2) | 0, (height / 2) | 0], 0);
      } else if (seedShape === 'circle') {
        const cx = (width / 2) | 0, cy = (height / 2) | 0;
        // Improve circle radius calculation - make it more substantial
        const r = Math.min(width, height) / 4;

        // Improve sampling to ensure dense coverage without gaps
        // Use angle-based sampling for more uniform distribution
        const numSamples = Math.max(100, r * 2); // Ensure enough seed points

        // First add center point
        pq.push([cx, cy], 0);

        // Add points in concentric rings
        const numRings = 10;
        for (let ring = 1; ring <= numRings; ring++) {
          const ringRadius = (r * ring) / numRings;
          const circumference = 2 * Math.PI * ringRadius;
          const pointsInRing = Math.max(16, Math.floor(circumference / 2));

          for (let i = 0; i < pointsInRing; i++) {
            const angle = (2 * Math.PI * i) / pointsInRing;
            const x = Math.round(cx + ringRadius * Math.cos(angle));
            const y = Math.round(cy + ringRadius * Math.sin(angle));

            if (x >= 0 && x < width && y >= 0 && y < height) {
              pq.push([x, y], 0);
            }
          }
        }
      } else if (seedShape === 'line') {
        const cy = (height / 2) | 0;
        // Make line step size reasonable
        const step = Math.max(1, Math.floor(width / 100));
        for (let x = 0; x < width; x += step) pq.push([x, cy], 0);
      }

      // Use simpler neighborhood for better performance
      const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];

      // For efficiency, limit batch iterations - AllRGB needs much larger batches
      const maxIterationsPerBatch = allRGBMode ? 50000 : (isExport ? 2000 : 10000);
      const progressUpdateInterval = allRGBMode ? 5000 : (isExport ? 500 : 1000);
      let iterations = 0;

      // Run a single batch with a timeout to prevent hanging
      function processBatch() {
        // If paused, don't process
        if (isPaused) return;

        const startTime = Date.now();
        // AllRGB needs much longer batches to be practical
        const timeLimit = allRGBMode ? 10000 : (isExport ? 500 : 1000); // ms per batch
        const checkInterval = allRGBMode ? 5000 : 500; // How often to check time

        iterations = 0;
        while (pq.length && (allRGBMode ? allRGBColorIndex > 0 : colorList.length > 0) && iterations < maxIterationsPerBatch && !isPaused) {
          // Check if we've exceeded the time limit (less frequently for AllRGB)
          if (iterations % checkInterval === 0 && Date.now() - startTime > timeLimit) {
            console.log(`Breaking batch after ${iterations} iterations (time limit reached)`);
            break;
          }

          iterations++;
          const [x, y] = pq.pop();

          // Get symmetry coordinates - simplified for export
          // AllRGB: Skip symmetry entirely - each pixel needs unique color
          let coords;
          if (allRGBMode) {
            coords = [[x, y]]; // No symmetry for AllRGB
          } else if (isExport && symmetryMode !== 'none') {
            // Use simplified symmetry for exports
            if (symmetryMode === 'bilateral') {
              const mx = width - 1 - x;
              coords = [[x, y], [mx, y]];
            } else if (symmetryMode === 'quadrantal') {
              const mx = width - 1 - x, my = height - 1 - y;
              coords = [[x, y], [mx, y], [x, my], [mx, my]];
            } else {
              coords = [[x, y]];
            }
          } else {
            // Use full symmetry for preview
            coords = getSymmetryCoords(x, y, width, height, symmetryMode);
          }

          // Process each coordinate
          let pixelsFilled = 0;
          for (const [mx, my] of coords) {
            const i = my * width + mx;
            if (mx < 0 || mx >= width || my < 0 || my >= height) continue;
            if (filled[i] || (allRGBMode ? allRGBColorIndex === 0 : colorList.length === 0)) continue;

            // Find average color of filled neighbors
            let count = 0, nr = 0, ng = 0, nb = 0;
            for (const [dx2, dy2] of neighbors) {
              const nx = mx + dx2, ny = my + dy2;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const ni = ny * width + nx;
                if (filled[ni]) {
                  nr += buffer[ni * 4 + 0];
                  ng += buffer[ni * 4 + 1];
                  nb += buffer[ni * 4 + 2];
                  count++;
                }
              }
            }

            // Get color - AllRGB uses ultra-fast path, others use matching
            let color;
            let r, g, b;
            if (allRGBMode) {
              // AllRGB: colorList is a Uint32Array - decrement index and unpack
              allRGBColorIndex--;
              const packed = colorList[allRGBColorIndex];
              r = (packed >> 16) & 0xFF;
              g = (packed >> 8) & 0xFF;
              b = packed & 0xFF;
            } else if (count === 0) {
              color = colorList.pop();
              r = color[0]; g = color[1]; b = color[2];
            } else {
              const avg = [nr / count, ng / count, nb / count];

              // Simplified color selection for better performance
              if (isExport || optimizeForLargeExport) {
                const randIdx = Math.floor(Math.random() * Math.min(colorList.length, 10));
                color = colorList.splice(randIdx, 1)[0];
              } else {
                // Use more advanced color selection for preview
                let bestIdx = 0, bestDist = Infinity;
                const sampleSize = Math.min(colorList.length, actualSampleSize);
                for (let j = 0; j < sampleSize; j++) {
                  const idx = Math.floor(Math.random() * colorList.length);
                  const dist = colorDistSq(colorList[idx], avg);
                  if (dist < bestDist) {
                    bestDist = dist;
                    bestIdx = idx;
                  }
                }
                color = colorList.splice(bestIdx, 1)[0];
              }
              r = color[0]; g = color[1]; b = color[2];
            }

            // Set pixel color
            filled[i] = 1;
            pixelsFilled++;
            const bufIdx = i * 4;
            buffer[bufIdx + 0] = r;
            buffer[bufIdx + 1] = g;
            buffer[bufIdx + 2] = b;
            buffer[bufIdx + 3] = 255;

            // Add neighbors - simplified for export
            // BUT NOT for AllRGB - we need to reach ALL pixels
            if (!allRGBMode && isExport && pq.length > width * height / 4) {
              // For exports, limit queue size to improve performance
              continue;
            }

            for (const [dx2, dy2] of neighbors) {
              const nx = mx + dx2, ny = my + dy2;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const ni = ny * width + nx;
                if (!filled[ni]) {
                  // ========== BRANCHING FACTOR IMPLEMENTATION ==========
                  // branchingFactor controls how many neighbors get added
                  // 0 = very few branches (linear growth), 1 = all branches (full expansion)
                  // Skip for AllRGB - we need to fill ALL pixels
                  if (!allRGBMode) {
                    const branchProbability = 0.25 + branchingFactor * 0.75; // Range: 0.25 to 1.0
                    if (Math.random() > branchProbability) {
                      continue; // Skip this neighbor to create less branching
                    }
                  }

                  // Use simplified priority calculation for exports
                  let priority;
                  const dist = Math.hypot(nx - width / 2, ny - height / 2);
                  const distRand = isExport ?
                    (Math.random() - 0.5) * 5 : // Less randomness for exports
                    (Math.random() - 0.5) * distanceRandomness * (dist / (width / 2));

                  if (growthMode === 'crystal') {
                    priority = dist + (Math.random() - 0.5) * actualRandomness + distRand;
                  } else if (growthMode === 'nebula') {
                    priority = (Math.random() - 0.5) * actualRandomness + dist * 0.2 + distRand;
                  } else if (growthMode === 'rings') {
                    const ringSpacing = width / 10;
                    priority = Math.abs(Math.sin(dist / ringSpacing * Math.PI)) * 5 + (Math.random() - 0.5) * actualRandomness + distRand;
                  } else {
                    priority = dist + (Math.random() - 0.5) * actualRandomness + distRand;
                  }

                  // Adjust priority by growth rate
                  priority /= growthRate;

                  pq.push([nx, ny], priority);
                }
              }
            }
          }

          // Update filled pixel count for progress reporting
          filledPixels += pixelsFilled;

          // Send progress updates periodically
          const now = Date.now();
          if (now - lastProgressUpdate > progressUpdateInterval) {
            const progressPercent = Math.min(100, Math.floor((filledPixels / totalPixels) * 100));
            self.postMessage({ progress: progressPercent });
            lastProgressUpdate = now;
          }
        }

        // Check if we need to continue processing or if we're done
        if (pq.length > 0 && (allRGBMode ? allRGBColorIndex > 0 : colorList.length > 0) && !isPaused) {
          // If export and more than 80% filled, finish early for better performance
          // BUT NOT for AllRGB - we need ALL pixels filled with unique colors
          if (isExport && !allRGBMode && filledPixels / totalPixels > 0.8) {
            console.log("Export 80% complete, finishing early");
            self.postMessage({ progress: 100 });

            // Verify buffer is valid before sending
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
            } catch (err) {
              console.error("Error transferring buffer:", err);
              // Try creating a copy if transfer failed
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
            }
            return;
          }

          // Send a progress update 
          const progressPercent = Math.min(100, Math.floor((filledPixels / totalPixels) * 100));
          self.postMessage({ progress: progressPercent });

          // Schedule next batch with a lower priority for exports
          setTimeout(processBatch, isExport ? 10 : 0);
        } else if (isPaused) {
          // If paused, do nothing and wait for resume command
          console.log("Processing paused");
        } else {
          // We're done, send final progress update and the result
          self.postMessage({ progress: 100 });

          // Verify buffer is valid before sending
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
          } catch (err) {
            console.error("Error transferring buffer:", err);
            // Try creating a copy if transfer failed
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
          }
        }
      }

      // Start the processing
      processBatch();

      // Before final completion, if we need to scale to a different output size
      if (processingSize !== outputWidth || processingSize !== outputHeight) {
        console.log(`Scaling output from ${processingSize}x${processingSize} to ${outputWidth}x${outputHeight}`);

        // Create scaled output buffer
        try {
          // Here you'd add code to scale the pattern to the exact output size
          // For now, we'll just send what we have and handle any scaling on the client side
        } catch (scaleError) {
          console.error("Error scaling image:", scaleError);
        }
      }

    } catch (memoryError) {
      console.error("Memory allocation failed:", memoryError);
      self.postMessage({ error: "Not enough memory to create this image. Try a smaller export size." });
    }

  } catch (error) {
    console.error("Worker error:", error);
    self.postMessage({ error: error.message || "Unknown error in worker" });
  }
};

