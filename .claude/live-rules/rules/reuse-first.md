---
description: Reuse-first implementation
priority: 90
---
- Before changing code, trace the real flow through the island, the lib module, and the CSS token
  it consumes; decide whether the ask needs new code at all.
- Reuse in this order: an existing house path (src/lib, the chip family, the overlay wipe, the drag
  engine), then a platform capability, then a dependency already in package.json. Never add a
  package for one call site.
- When code must change, fix the smallest shared root cause. Delete code when behavior survives.
  Skip speculative guards, abstractions, and config nobody asked for.
- Keep checks where accessibility, data loss, or the Sanity write path requires them.
- Run the smallest focused check that exercises the change while implementing. One integration
  owner runs the full build after merged work. Never claim a result you did not observe.
