# Synth Overview

A local, dependency-free dashboard for comparing current hardware synths at a glance:
brand, model, price, image, and the specs you actually pick a synth on — voices,
voicing, keys, sequencer, arp, FX, MIDI, USB, CV, audio I/O, power and preset memory.

## Run

```bash
node serve.js 8123
```

Then open http://localhost:8123. (Opening `index.html` straight from disk does not
work — the browser blocks `fetch` of the JSON over `file://`.)

## Files

| File               | What it is                                                                     |
| ------------------ | ------------------------------------------------------------------------------ |
| `data/synths.json` | The whole dataset. One object per model. Edit this to add or correct anything. |
| `index.html`       | Markup: top bar, filter sidebar, results area.                                 |
| `app.js`           | Filtering, sorting, card/table rendering, detail dialog. No framework.         |
| `styles.css`       | Styling, light and dark.                                                       |
| `serve.js`         | ~30-line static file server so `fetch` works.                                  |
| `images/`          | Optional product photos.                                                       |

## Using it

- **Search** matches every field, so `303`, `paraphonic`, `patchbay` and `battery` all work. Press `/` to jump to the box.
- **Filters** stack: brand and form factor are OR within a group, AND across groups. "Must have" filters are all-of.
- **Cards / Table** — cards for browsing, table for spec-by-spec comparison across all 19 columns.
- Click any card or row for the full spec sheet plus a link to the manufacturer page.

## Adding a model

Append an object to `data/synths.json` and reload. Field notes:

- `id` — unique slug, also the image filename.
- `category` — `"synth"`, `"sequencer"` (sequencers/controllers with no synth engine,
  e.g. Behringer Swing) or `"effects"` (FX-only boxes, e.g. Korg NTS-3). Drives the
  Category filter, which defaults to `synth` only on a first visit.
- `polyphony` — free text, but include the word `Mono`, `Para` or nothing (treated as poly);
  the Voicing filter reads this.
- `seq`, `fx`, `cv`, `keys` — write `"None"` when absent; the feature filters treat
  `"None"` / `"n/a"` / empty as missing.
- `power` — mentioning `USB`, `batter` or `AA` marks it as portable-powered.
- `price_eur` — number, no currency symbol.

## Images

58 of 60 entries have a real product photo in `images/`, fetched from Thomann product
pages (`"image": "images/<id>.jpg"` in the data file, 600×600 JPG). `korg-ms20-fs` and
`te-op-z` have no current Thomann listing, so they fall back to the generated
placeholder — same as any future entry you add without a photo.

To replace or add one: drop a file in `images/` and point the entry's `image` field at
it. An external URL works too, but then the dashboard stops being fully offline.

Photos © their respective manufacturers/Thomann — fine for this local reference tool,
not meant for redistribution or a public deployment.

## Data caveat

Prices are indicative EU street prices and specs were compiled by hand from
manufacturer documentation — treat both as a starting point, not a source of truth,
and check the manufacturer page before buying. Nothing here refreshes automatically.
