# ADR 0039: What A Slow Phone Pays For

## Status

Accepted on 31 October 2026.

## Context

The owner saw the production home page red on a phone-sized Lighthouse run while a default run on this Mac scored 98. Both were true, and the Mac's number was the wrong one.

Default Lighthouse slows the CPU by 4. This Mac measures a benchmark index of 3,204 to 3,716, so a 4x run here scored 98 while a 12x run reproduced the red the owner saw. Measured on production `/id`, 31 October 2026:

| Run | Score | Blocking time | Main thread |
| --- | --- | --- | --- |
| Simulated, 4x, on the Mac | 98 | 130 ms | 3.8 s |
| Simulated, 12x, on the Mac | 71 | 1.7 to 2.1 s | 16 s |
| DevTools throttling, 4x | none: the page never went idle | none | 32.8 s |

Four causes held that main thread:

- One rule, `html:has([data-slot="drawer-popup"][data-open])`, made the root answer for every node in the document, so an inserted node could restyle all 3,291 elements: 24 full recalculations and 109,795 elements restyled in one load at 4x. Without the rule the same bytes took 4 and 26,928.
- Decoration ran on every frame for good. Nina's life and the particles took 26.6 s of the 32.8 s, so the page never reached a quiet window on a slow CPU.
- Hydration paid for the whole page: 393 scripts and 1.2 MB of JavaScript, 275 of those scripts under 2 KB decoded, for sections the reader had not reached.
- Lessons ran Shiki in the browser after the first paint, so code changed colour on screen.

## Decision

D1. Lighthouse is measured at 12x CPU on this Mac, and with `--throttling-method=devtools` when a number looks too good. A default run is never evidence.

D2. No `:has()` on `html`, `body` or `:root`. A state that the root must know is an attribute on the root. `scripts/check/sheets.ts` rejects the rule.

D3. A section under the first screen of a long page goes through `LaterSection`. Its HTML stays whole for readers and crawlers, its code loads when the page has settled and the section is near the screen, and a client navigation loads it before the page commits. The boundary sits under a box with no state, because an update into a boundary that still waits for its code would throw its HTML away.

D4. Decoration waits for `untilPageRead`: the reader's first gesture, or ten seconds on a page nobody touches. A slow phone is still hydrating a few seconds after the load, so the wait has to reach past that and past the five quiet seconds that mark a page interactive. At six, on production `/id` with DevTools throttling, particles made about 185 ms of the 372 ms of blocking time. The analytics SDK waits there too.

D5. A loop that runs by itself keeps to `createFramePace`: it rests seven times as long as it worked, an eighth of the thread at most. The pace is measured, never guessed from a device's name, so a phone that is busy with something else slows the loop too.

D6. What the build can draw, the build draws. Lesson code is highlighted in `CodeBlockServer`, as the line cards draw their facts in `line.server.tsx`.

D7. A route's loader is a chunk of its own, which the router loads for a navigation and a hydrated page never asks for. By default the router plugin splits only the components, so every route's loader sat in the first bundle with all it imports: 505 KB decoded on every page. What a route's `head`, `beforeLoad` and `validateSearch` import stays in that bundle, because the plugin cannot split them, so a heavy module belongs in the loader or the component.

## Consequences

Positive: every page loses those recalculations, the home page's first JavaScript no longer holds the sections under its first screen, and decoration leaves the thread to the reader.

Negative: a press on a section that is still loading its code is lost until the section hydrates, which the near-screen margin makes rare; a link still navigates. Toys and Nina wait for a gesture or ten seconds. An end-to-end spec that waits for a far section to hydrate has to walk down the page.
