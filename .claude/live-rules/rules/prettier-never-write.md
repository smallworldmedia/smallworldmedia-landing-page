---
description: No prettier --write (the repo has no prettier config)
globs: ["src/**", "scripts/**", "*.mjs", "*.ts"]
priority: 60
---
- This repo has no prettier config. Never run `prettier --write` or any formatter across a file;
  it rewrites every line and buries the real diff.
- Match the surrounding file's indentation, quote style, and line breaks by hand.
- Keep the diff to the lines the change needs.
