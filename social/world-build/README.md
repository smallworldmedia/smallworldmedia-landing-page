# WORLD BUILD — Instagram carousel system

Editorial carousel templates for the Featured Projects — the detail page,
re-cut for the feed at 1080×1350 (4:5). Cover: **WORLD BUILD** with the SWM
globe mark as the O, client name, service tags. Then the detail-page blurb
elaborated across three swipe beats on black, closing on **YOUR WORLD NEXT**.
Everything is set in the site's own faces, tokens, and chrome registers.

## Layout iterations

| Key | Name | Site grammar it extends |
|---|---|---|
| `masthead` | A — The Masthead | np-band (mono label / 1px rule / squeezed display / tags) + info-panel blue emphasis; fixed horizon rule crosses every slide; giant blue page index bleeds off-canvas |
| `osboot` | B — Project_## (OS Boot) | /work World identity card (PROJECT_## tab, centered squeezed stack, white fp-tags); narrative slides are a boot log whose block meter (░▒▓█) fills as you swipe |
| `panel` | C — Detail Panel | /work/[slug] vertical rhythm verbatim: black masthead / blue ClientPanel band / near-black blurb surface with client·date·stage detail-fields; last beat inverts full blue (the light-up) |
| `thread` | D — The Thread | process-page language: seeded Fragment scatter, the Thread crossing every slide at one fixed edge height (y=675), STAGE_ tabs + caption pings, blue light-up, Thread terminates in the assembled Core |

## Files

```
content.mjs        one record per featured project (client, tags, years, arc
                   beats with [[…]] emphasis markers) — sourced from the same
                   Sanity `project` docs the site reads
lib.mjs            shared kit: global.css token mirror, embedded site fonts,
                   the swm-globe-mark inline SVG, mulberry32/hashSeed (the
                   seededLayout.js technique), richText
templates/*.mjs    one module per iteration: meta / css() / slides(project, series)
build.mjs          emits dist/slides/*.html (one self-contained file per slide,
                   exact 1080×1350) + per-deck contact sheets + manifest.json
render.mjs         headless-Chromium screenshots → dist/png/*.png
                   (needs `pip install pillow` once — new-headless pads the
                   capture past the viewport, so we render tall and crop)
gallery.mjs        the design-review page (dist/gallery.html): live slides in
                   IG-style snap reels, entrance choreography on every swipe
```

## Regenerate

```sh
node build.mjs && node render.mjs          # 40 post-ready PNGs → dist/png/
node gallery.mjs                           # review page → dist/gallery.html
node render.mjs --only panel-coco          # one deck only
```

## Add a project

Add a record to `content.mjs`: client, slug, clientType, years, up to four
tags, and the detail-page description cut into three `arc` beats
(discovery → core_identity → living_world — the process-page stages), each
with one `[[…]]` payoff phrase. Rebuild. Every template renders every project.

## Motion layer

Slide markup carries inert `m-scr / m-rise / m-pop / m-fade / m-draw` hooks
with per-element `--d` delays. Static renders ignore them; the gallery plays
them on the house tokens (scramble charset + 1.4s cadence from
`src/lib/scramble.js`, `--ease-panel`, 0.35–0.8s durations, 122bpm pulse on
the Thread cover ring). To produce a video slide 1, screen-record the cover
entrance from `dist/gallery.html` (or a slide page with the `.play` class) —
the rotating outline globe GIF at the repo root is the O for video covers.

## Archival

Finished decks archive per client under the existing CMS carousel convention
(CONTEXT.md): `mediaType: carousel-slide`, one `displayGroup` per deck
(e.g. `world-build-01-coco`), slides sequenced by `sortOrder`.
