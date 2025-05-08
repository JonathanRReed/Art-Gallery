# Algorithmic Art Gallery (Astro) — Design Doc

---

## 1. Project Overview

A **modern, minimal** web app built with **Astro**, showcasing 4096×4096 algorithmic color‑space posters (all 16,777,216 RGB triplets via a 24‑bit Hilbert curve) in a sleek, gallery‑style interface. Users adjust generation parameters in a left‑hand “island” panel and see a live canvas preview on the right. A dedicated **Gallery** page presents saved posters as frosted‑glass cards, emulating a contemporary art exhibit. The website font will the NeublaSans-Book.ttf in the public folder

---

## 2. Objectives & Success Criteria

* **Real‑Time Generation**

  * Parameter tweaks (curve, seed, ordering) update canvas in ≤ 2 s.
* **Minimal Gallery Aesthetic**

  * Crisp grid, thoughtful whitespace, subtle hover animations, neon accent.
* **Frosted‑Glass Display**

  * Cards use `backdrop-filter` blur and translucent tints.
* **Robust Export**

  * Download 300 dpi sRGB PNG, plus print‑preset PDF.

---

## 3. User Personas

| Persona       | Goals                                                                    |
| ------------- | ------------------------------------------------------------------------ |
| **Creator**   | Experiment with color‑space parameters and see instant visual feedback.  |
| **Designer**  | Preview and adjust export settings for gallery‑worthy prints.            |
| **Collector** | Curate and browse a personal collection in a minimal art‑gallery layout. |

---

## 4. User Stories

1. **Creator:** “I tweak the curve type and seed, then hit Generate to watch the poster redraw instantly.”
2. **Designer:** “I preview the poster full‑screen, choose 300 dpi export, and download a print‑ready file.”
3. **Collector:** “I visit the Gallery page to see all my saved posters as frosted‑glass cards in a clean grid.”

---

## 5. Core Features

### 5.1 Generation Page

* **Controls Panel (Astro Island)**

  * **Curve Type**: Hilbert | Morton
  * **Seed**: Numeric input + “Randomize”
  * **Color Ordering**: RGB→XYZ permutations
  * **Generate**: Renders to preview with a progress spinner
* **Live Preview Canvas (Island)**

  * 4096×4096 render area via Web Worker
  * Export panel beneath (DPI select, profile toggle, Download buttons)

### 5.2 Gallery Page

* **Responsive Grid**

  * 2–4 columns, generous gutters
  * Frosted‑glass cards (`backdrop-filter: blur(12px)`, `rgba(30,30,30,0.5)`)
* **Card Interactions**

  * Hover glow (`box-shadow: 0 0 12px #ff4dc4`)
  * “View” opens full‑screen preview; “Delete” removes from gallery

---

## 6. Technical Architecture

```
src/
├─ components/
│   ├─ ControlsPanel.jsx    # client:idle island
│   ├─ PreviewCanvas.jsx    # client:load island
│   └─ ExportPanel.jsx      # client:visible island
│
├─ layouts/
│   └─ BaseLayout.astro     # dark‑mode, global styles, frosted glass wrapper
│
├─ pages/
│   ├─ index.astro          # Generation + Preview
│   └─ gallery.astro        # Saved‑posters grid
│
└─ public/
    └─ worker/
        └─ color-mapper.js  # Web Worker for pixel mapping
```

* **Framework:** Astro
* **Styling:** Tailwind CSS via `@astrojs/tailwind`
* **Interactivity:** Astro Islands (React/Vue components)
* **State:** Local component state + `localStorage` for saved posters
* **Build:** `astro build` (Vite under the hood)

---

## 7. UI/UX Design

### 7.1 Color Palette & Typography

* **Background:** `#121212`
* **Frosted Cards:** `rgba(30,30,30,0.5)` + `backdrop-filter: blur(12px)`
* **Accent:** Neon pink `#ff4dc4`
* **Font:** Sans‑serif, light weights, generous line‑height

### 7.2 Layout & Interactions

```
┌────────────────────────────┬──────────────────────────────────┐
│ Controls Panel (300px)     │ Live Preview Canvas (flex-grow)  │
│ • Curve [dropdown]         │ • Canvas + spinner               │
│ • Seed [input][randomize]  │ • Export Panel                   │
│ • Ordering [dropdown]      │                                  │
│ • Generate [button]        │                                  │
└────────────────────────────┴──────────────────────────────────┘
```

* **Spacing:** 2 rem gutters
* **Animations:**

  * Button hover: scale(1.02) + neon glow
  * Card hover: lift (`translateY(-4px)`) + glow

---

## 8. Export & Print Specifications

* **PNG:** Full‑res sRGB, metadata intact
* **PDF Preset:**

  * Letter/A4 templates with bleed and alignment marks
  * Print notes: 300 dpi, color‑managed frosted‑glass materials

---

## 9. Success Metrics

* **Generation Time:** ≤ 2 s for full render
* **Gallery Usage:** ≥ 80% of users save ≥ 2 posters
* **Export Count:** ≥ 150 downloads in first month
* **UI Responsiveness:** No noticeable jank during parameter changes

---

*This design leverages Astro’s static‑first + island architecture to deliver a lightning‑fast, visually stunning minimal gallery—perfect for creators, designers, and collectors alike.*
