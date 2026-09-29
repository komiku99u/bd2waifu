# My 9 Waifu

A mobile-first fan-made web app inspired by the "My 9 Games" layout. It uses the supplied Brown Dust 2 master data, lets visitors choose 9 waifu, optionally choose costumes, generates a 3×3 PNG, creates a shareable URL, and can show a community popularity ranking.

## Project structure

- `index.html` — main UI
- `assets/style.css` — all styling
- `assets/app.js` — selection, costume picker, image generation, sharing, popularity UI
- `data/master-data.json` — converted copy of the supplied `master data(1).md`
- `data/waifu-ids.js` — curated list of character IDs used as waifu choices; edit this list if you want to add/remove characters
- `functions/api/image.js` — Cloudflare Pages image proxy for reliable canvas generation
- `functions/api/popular.js` — Cloudflare Pages API for popularity counts
- `schema.sql` — Cloudflare D1 table
- `wrangler.toml` — Cloudflare configuration

## GitHub + Cloudflare Pages

1. Create a GitHub repository and upload the contents of this folder.
2. In Cloudflare, create a Pages project from the GitHub repository.
3. This is a static site with Pages Functions, so no framework/build step is required.
4. Set the Pages build command to empty / none and the output directory to `.` if Cloudflare asks for one.
5. Deploy.

### Enable Popular Waifu

The selection and image generation work without a database. Popular Waifu needs D1.

1. Create a Cloudflare D1 database.
2. Run `schema.sql` against it.
3. In the Pages project, open **Settings → Functions → D1 database bindings**.
4. Bind the database using the variable name `DB`.
5. Redeploy.

After that, each completed 9-waifu generation increments the selected characters' counters, and the Popular Waifu section reads the top 12 from D1.

## Local preview

A normal static server can display the UI, but the `/api/*` Pages Functions require the Cloudflare Pages runtime. For a full local test, use Wrangler/Pages tooling with the project directory.

## Editing the waifu pool

The master data contains both female and male/game/NPC characters. The app does not modify the supplied master data. The file `data/waifu-ids.js` controls which IDs appear in the picker. This keeps the original source data intact and makes the waifu selection easy to maintain.

## Notes

- The share URL stores the selected character and costume IDs in the URL hash; no account is required.
- The generated image is created entirely in the browser using Canvas.
- Images are proxied through the Pages Function only for canvas/CORS reliability.
- Popularity is intentionally based on actual completed selections rather than a pre-filled/fake ranking.
