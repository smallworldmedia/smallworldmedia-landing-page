---
description: Motion and layout changes are verified on screen, not by a build pass
globs: ["src/styles/**", "src/components/**", "src/pages/**"]
priority: 60
---
- A green `npm run build` is not verification for motion, layout, or chrome. Before calling a
  change done, capture a Playwright shot or probe against the dev server at 1440 and 390 wide, or
  say plainly that it was not verified.
- Headless Chromium starves /work's main thread. Launch with `--use-angle=swiftshader
  --enable-unsafe-swiftshader`, wait ~250ms before reading state attributes, and treat
  `.fp.is-pager-engaged` as the imperative truth. scripts/pager-probe.mjs carries this doctrine.
- Never click top-center to blur; [PREVIOUS] sits there.
- Real-device feel (touch gain, scroll triggers) stays a Nathan-at-machine call; do not tune it blind.
