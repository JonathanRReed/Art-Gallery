# Algorithmic Art Gallery

Generate art from space-filling curves, symmetry rules, and deterministic seeds. The same settings reproduce the same image. Save studies in the browser, then export PNGs or PDFs.

[Live demo](https://art.jonathanrreed.com) · Inspired by Corridor Crew's [I Made Art That HACKS Your Eyes](https://www.youtube.com/watch?v=SxsN6FRXMWQ)

## Run locally

Requires Node.js 18+. Bun 1.0+ is recommended.

```sh
bun install
bun run dev
```

Open the URL Astro prints, usually `http://localhost:4321`.

## Check and build

```sh
bun run check
bun run build
```

The app uses Astro, React, Tailwind CSS, and Web Workers. Static output can run on Cloudflare Pages, Netlify, Vercel, or another static host. Settings and saved studies stay in browser storage; no account or backend is required.

The interface includes several curve and growth modes, keyboard navigation, and skip links.

## License

MIT.
