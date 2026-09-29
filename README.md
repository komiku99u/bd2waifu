# My 9 Waifu

Static mobile-first Brown Dust 2 fan project for choosing 9 waifu and generating a shareable 3x3 image.

## Pages
- `index.html` — landing page, example, and Popular Waifu ranking.
- `make.html` — character selection, costume selection, image generation, and sharing.

## Data
- `data/master-data.json` — character/costume master data.
- `data/waifu-ids.js` — active waifu pool.

## Cloudflare
- `functions/api/image.js` — image proxy.
- `functions/api/popular.js` — D1 popularity API.
- D1 binding name: `DB`.


### Character pool
The picker uses every character present in `data/master-data.json`, including characters without costumes. Characters with no costume show a `No costume available` note. Costume selection is inline directly below each character card.
