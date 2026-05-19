# Algorithmic Art Gallery

A browser-based generative art studio that uses space-filling curves, symmetry rules, and deterministic seeds to create exportable artwork. The project was inspired by Corridor Crew's [I Made Art That HACKS Your Eyes](https://www.youtube.com/watch?v=SxsN6FRXMWQ).

Live demo: https://art.jonathanrreed.com

## Highlights

- Deterministic generation, so the same settings reproduce the same image
- Multiple curve and growth modes for varied visual output
- Local gallery for saving favorite studies in the browser
- PNG and PDF export for portfolio sharing and printing
- Responsive layout with keyboard-friendly navigation and skip link support

## Quick start

### Requirements

- Node.js 18 or newer
- bun 1.0+ recommended

### Install

```sh
bun install
```

### Run locally

```sh
bun run dev
```

Then open the local URL shown by Astro, usually `http://localhost:4321`.

### Production checks

```sh
bun run check
bun run build
```

## Notes for reviewers

- The app is static Astro output, so deployment is suitable for Netlify, Vercel, Cloudflare Pages, or similar static hosts.
- Settings are stored locally in the browser. No account or backend is required.

## Technologies

- Astro
- React
- Tailwind CSS
- Web Workers
- LocalStorage

## License

MIT
