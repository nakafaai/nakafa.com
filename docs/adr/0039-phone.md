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

D7. A rule's subject never sits under a `:has()` or a child position: no `group-has-*`, `peer-has-*`, `has-*:*:*`, `group-first`, `group-last`, or an arbitrary variant that goes on past its `:has()`. Chrome cannot tell which elements such a rule reaches, so every element inserted anywhere restyles the whole document, and an element appended to `body` flips the app root's `:last-child` the same way. The element that holds the state sets a custom property on itself, and the descendant reads it, or a sibling combinator says the same thing. On one lesson at 4x this took 38 whole-page style passes to 2. `scripts/check/tailwind.ts` rejects the variants.

D8. A static page starts its app once it has painted, never at the reader's first gesture or after a wait. A start held for a gesture made a visitor's first press on any control without `data-press` only start the page: a dead click (#2181, closed). It took Lighthouse's blocking time to 0 only because nothing ran inside the window Lighthouse watches. A start held for an idle moment moves the same work inside that window and removes none of it. Hydration already runs in a transition (`startTransition` in TanStack Start's client entry), so React yields between its slices. What remains is the document and the code's evaluation. On production `/id` at 12x on 8 November 2026 (benchmark index 3,689), blocking time was the only metric under 100, at 830 ms: FCP and LCP 1.5 s, CLS 0. The document took 1,822 ms of the main thread, unattributed work 1,584 ms, and the entry script 1,225 ms, mostly evaluation. Its HTML is 531 KB (92 KB with Brotli): 196 KB of 124 inline SVGs, 158 KB of class attributes, a 79 KB router payload, 3,318 elements. A phone's next gain is a lighter document, not a later start.

D9. A page boots in a few files (13 November 2026). Google's renderer, which AdSense's site review, the Search Console live test and the Rich Results Test share, loads about 250 of a page's resources and fails the rest, and a module graph that misses one module never runs. Every page booted 246 to 399 scripts, so none ran for Google and AdSense read the site as down. `apps/www/output.config.ts` puts every module the browser entry imports statically into one boot chunk, and Rolldown copies each shared chunk under 16 KB into the chunks that use it (`experimentalInlineCommonChunks`), which runs every module in its source order (`strictExecutionOrder`). The build fails a page that boots more than 60 scripts (`BOOT_SCRIPT_LIMIT` in `apps/www/src/lib/static/scripts.ts`), and the JavaScript budget fails a route graph of more than 120 (`ROUTE_MAX_SCRIPTS`). On the 795 prerendered pages the boot scripts went from 246 / 357 / 399 (min / median / max) to 14 / 24 / 36, and a page's first JavaScript transfers 3 to 9% less.

The copies and the order wrappers add text that compression removes, so a graph that warms other pages decodes more while it transfers the same or less. Two decoded limits of `apps/www/e2e/budget/javascript.browser.ts` moved; each keeps the spec's headroom (the measurement plus 6%, rounded up to the next thousand), and no encoded limit moved. Before is the spec's baseline of 8 November 2026, after the Chromium run of 13 November:

| Graph | Encoded before | Encoded after | Decoded before | Decoded after | Decoded limit |
| --- | --- | --- | --- | --- | --- |
| Indonesian Quran, normal prefetch | 833,187 | 822,414 | 2,306,088 | 2,456,884 | 2,445,000 to 2,605,000 |
| English Memory, signed in | 1,049,988 | 1,049,197 | 2,944,185 | 3,156,362 | 3,121,000 to 3,346,000 |

Lighthouse on a GitHub runner, mobile, at a slowdown scaled to the runner, median of five runs: script requests fell from 356 to 423 to 32 to 40 on the home page, School, a lesson and the Quran, and main-thread time fell 15 to 33%.

## Consequences

Positive: every page loses those recalculations, the home page's first JavaScript no longer holds the sections under its first screen, and decoration leaves the thread to the reader.

Negative: a press on a section that is still loading its code is lost until the section hydrates, which the near-screen margin makes rare; a link still navigates. Toys and Nina wait for a gesture or ten seconds. An end-to-end spec that waits for a far section to hydrate has to walk down the page. Since D9 the build's JavaScript is 32 MB instead of 27, a page that warms others decodes up to 7% more, every module carries an init wrapper, and the inline option is experimental in Rolldown, which Vite pins.
