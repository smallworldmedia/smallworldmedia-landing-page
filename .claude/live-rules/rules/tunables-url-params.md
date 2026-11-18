---
description: Tunables land as ?param first, bake only on Nathan's values
prompt: ["tunable", "tunables", "knob", "bake", "?param", "bench", "dial"]
globs: ["src/**"]
priority: 55
---
- A new knob ships as a URL `?param` read the house way (module-load or mount-effect, see
  docs/tunables-guide.md "How tunables work") with a bench row, so Nathan can dial it live.
- Bake a value only when Nathan states the number. Baking writes his number into the default the
  guide's `bake` column names (docs/tunables-guide.md, "Bake law"); the param read stays so he can
  re-dial it. When he retires a dial, its read, its guide row and any panel control go together.
- After adding, renaming, or baking a param: run `node scripts/tunables-keys.mjs --check` and add
  or update the row in docs/tunables-guide.md so the check passes.
- Watch for same-key collisions across routes and for `?lenistune` style flags that silently revert
  a bake.
