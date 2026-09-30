# Kyoto(kens) — Pacing the Frontier

A static, single-page Three.js browser game. You play Kyoto, a golden retriever let loose on a
stylized San Francisco: collect the **K Y O T O** letters, bark at agents, hack drones, chase the
CEO duo, snap 15 album photos, and surf out to Alcatraz.

There is **no build step** — the files in this repo are the shipped game. No server code, no
database. Non-commercial parody fan game.

**Play:** <https://claude.ai/artifact/Xt7w9RygtqKaSxX92AwrpS>

## Run locally

The game is plain static files, but it loads ES-free `<script>` tags and uses `fetch` for its
models, so it must be served over HTTP (opening `index.html` from the filesystem will fail).

```sh
python3 -m http.server 8765
```

Then open <http://localhost:8765>.

Any static file server works; the only requirement is that `.json` files are served with a sane
MIME type, which `python3 -m http.server` does.

### Silent run

Append `?mute=1` to start with all audio muted (handy for automated checks):

<http://localhost:8765/?mute=1>

## Controls

| Input | Action |
|---|---|
| `W` `A` `S` `D` (or arrows) | Move |
| `Shift` | Sprint |
| `Space` | Jump |
| `B` | Bark (scares pedestrians, stuns agents) |
| `Q` | Open the Kyotoken wheel, then `1`–`8` to deploy an ability |
| `E` / `Enter` | Interact with whatever is in front of you |
| `L` | Map |
| `Tab` | Photo album |
| `J` | Family album |
| `P` | Pause / resume |
| `Esc` | Close the open panel / release the mouse |
| Mouse drag | Look around |
| Click | Start the run; click prompts to act |

On touch devices a virtual stick, jump/bark buttons, and an action bar appear automatically.

## Folder map

```
index.html        entry point: markup, styles, and the ordered <script> list
src/              game code, loaded in order (core, world, actors, ui, music,
                  then feat_* feature modules, then main.js)
models/           hand-built low-poly city/character geometry as glTF .json bundles
assets/
  ext/            characters + manifest.json (which models the crowd may use)
  npc/            specific NPC model bundles (dog, worker, skateboarder, ...)
tex/              runtime textures (billboards, murals, magazines, fur, ground detail)
  assets/         Poly Haven-derived ground textures + LICENSES.md and the generator
  assets/src/     unmodified 1K Poly Haven sources (provenance only, not loaded)
photos/           album photos (photos/web/) plus the Alcatraz PNG
art/              CEO portraits and cut-out art, family postcards, sign art
```

## Assets and CDN

Three.js **r128** and the GLTFLoader / SkeletonUtils / BufferGeometryUtils examples load from
`cdn.jsdelivr.net`, and the display fonts (Bangers, Titan One, Nunito) load from Google Fonts.
Everything else — models, textures, photos, art — is a local static file in this repo.

Served assets are cache-busted with a single `?v=` string that matches `K.VER` in `index.html`;
bump both together when changing anything in `src/` or the texture set.