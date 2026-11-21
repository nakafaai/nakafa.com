# ADR 0039: What A Slow Phone Pays For

## Status

Accepted on 31 October 2026.

## Context

The owner saw the production home page red on a phone-sized Lighthouse run while a default run on this Mac scored 98. Both were true, and the Mac's number was the wrong one.

Default Lighthouse slows the CPU by 4. This Mac measures a benchmark index of 3,204 to 3,716, so a 4x run here scored 98 while a 12x run reproduced the red the owner saw. Measured on production `/id`, 31 October 2026:

| Run                        | Score                          | Blocking time | Main thread |
| -------------------------- | ------------------------------ | ------------- | ----------- |
| Simulated, 4x, on the Mac  | 98                             | 130 ms        | 3.8 s       |
| Simulated, 12x, on the Mac | 71                             | 1.7 to 2.1 s  | 16 s        |
| DevTools throttling, 4x    | none: the page never went idle | none          | 32.8 s      |

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

| Graph                             | Encoded before | Encoded after | Decoded before | Decoded after | Decoded limit          |
| --------------------------------- | -------------- | ------------- | -------------- | ------------- | ---------------------- |
| Indonesian Quran, normal prefetch | 833,187        | 822,414       | 2,306,088      | 2,456,884     | 2,445,000 to 2,605,000 |
| English Memory, signed in         | 1,049,988      | 1,049,197     | 2,944,185      | 3,156,362     | 3,121,000 to 3,346,000 |

Lighthouse on a GitHub runner, mobile, at a slowdown scaled to the runner, median of five runs: script requests fell from 356 to 423 to 32 to 40 on the home page, School, a lesson and the Quran, and main-thread time fell 15 to 33%.

D10. A static page preloads only what its first paint runs (15 November 2026). TanStack Start lists every `?tsr-split=` chunk of a route as its preload, the chunks of its `errorComponent` and `notFoundComponent` included, so every page fetched them and never ran them: WebKit flagged the `$locale` error and not-found parts and `components/state/app.tsx` as preloaded and unused on every load of `/en`. The build records each client chunk with its address, its static imports and the route parts it holds, and the loader starts the entry, the preloads that hold a route `component`, and what those import statically (`readFirstLoad` in `apps/www/src/lib/static/chunks.ts`). The router loads an error or not-found part when it shows one. A preload the build recorded no chunk for stays and counts toward `BOOT_SCRIPT_LIMIT`, and a build that recorded no chunk fails.

D11. A lesson's first visual draws with MathVisual (15 November 2026). The retired lesson visuals moved onto MathVisual (#2385 and the Aksara content it pins), and every visual serves every content kind, by the owner's rule of 15 November 2026. So the measured lesson, Hyperbola, draws its first visual card with MathVisual's renderer, which the budget counts because the card is near enough to the first screen to load. D9 measured the Quran and Memory graphs again and left the lesson at 3,524,499 decoded bytes, 0.6% under its 3,545,000 limit instead of the spec's 6%. Measured on the production build of 15 November 2026 against D9's own build, the lesson grew by 94,630 decoded bytes:

| Owner                                                 | Decoded bytes |
| ----------------------------------------------------- | ------------- |
| MathVisual: its renderer, its 3D names and its slider | 49,185        |
| The order wrappers of D9's copied chunks              | 36,447        |
| Base UI's composite, copied into five chunks          | 14,188        |
| Icons, the sibling crumbs, the mascot and the flags   | 28,656        |
| Modules that left the graph                           | -38,215       |
| Line breaks, which no source map attributes           | 4,369         |

The composite copies are a known cost of D9's inlined common chunks, which keep every page under Google's render cap; this change does not touch them. The same day, the School form's language field moved out of the language menu's module into `apps/www/src/components/tenant/settings/language.tsx`: a chunk holds whole modules, so every header and sidebar that drew the menu had loaded the field's Select, Field and their Base UI internals. That took the English pricing graph from 2,059,999 to 2,002,367 decoded bytes and the homepage from 2,704,059 to 2,639,727, both under their limits again. The lesson, at 1,160,551 encoded and 3,619,129 decoded bytes, takes a decoded limit of 3,837,000 by D9's rule: the measurement plus 6%, rounded up to the next thousand. Its encoded limit holds.

D12. A long page skips each part once, and a jump lays out the parts above its target first (16 November 2026). D3's box (`LaterSection`) and each part's own section (`content-auto-section`) both set `content-visibility: auto`. Inside the two skipped boxes, WebKit's `scrollIntoView` did nothing for an element of a part, and Firefox and WebKit dropped the section's `scroll-mt-16`. A jump also landed on the placeholders' heights: a box holds one screen for its part until it is laid out, the School exams part is 1,251 px tall, and laying it out after the scroll moved the target. Scroll anchoring did not take that back. Measured at 1440x900, as the top of `#reports` relative to the header's bottom after the header's School › Report cards link: Chromium +128 px, Firefox -64, WebKit -900. The box is now the one skipping layer, the `later-section` utility, because D3 makes it the owner of a part under the first screen; `MarketingSection` no longer skips, and the pricing page's schools and questions go through `LaterSection` like the other long pages. A jump marks its target, by the browser's `:target` for a loaded `#part` address and by `data-jump` for a navigation to a hash (`followHashJumps` in `apps/www/src/components/marketing/shared/jump.ts`, on the router's `onResolved`, which comes after the page commits and before the router's one hash scroll). `later-section` lays out every box that holds or precedes the target, so that scroll lands on real heights with the section's margin, in Chromium, Firefox and WebKit within 1 px, and nothing moves after it. The boxes below the target stay skipped, and a load without a hash lays out nothing more. `apps/www/e2e/marketing/jump.browser.ts` holds both jumps to that bound.

D13. A formula that mounts only in the browser carries the markup the server drew (16 November 2026). Since #2475 a lesson's data carries each formula's TeX, and a formula the browser hydrates keeps the server's markup, so a page's first load runs no KaTeX. A scene's labels never hydrate: MathVisual's `labels`, the quadratic room's side labels and the other content nodes a scene draws mount in its canvas overlay, which only the browser renders. Each one drew itself with KaTeX, so the measured lesson, Hyperbola, loaded KaTeX (77,493 bytes gzip) for the nine labels of its first visual card. The content tree now renders every element inside another renderer's prop with the component its renderer marks for a prop (`IN_PROP` in `apps/www/src/lib/content/renderer/prop.ts`), and a formula there carries the markup `drawMath` drew for it, which `FormulaDrawing` shows as it mounts. `drawMath` stays the one drawer, and the body's formulas still carry only their TeX. On the production build of 16 November 2026 with #2578 applied:

|                                 | Before                            | After                             |
| ------------------------------- | --------------------------------- | --------------------------------- |
| Lesson graph, encoded / decoded | 1,240,806 / 3,885,821, 76 scripts | 1,162,484 / 3,625,112, 74 scripts |
| Hyperbola HTML, decoded / gzip  | 582,684 / 71,384                  | 618,566 / 73,560                  |
| Static answers, all 822 files   | 46,526,579 bytes                  | 49,716,782 bytes                  |

The lesson's limits hold. The 219 answers whose content draws a formula in a prop grew, by at most 35,158 bytes before compression, the price of drawing a label without KaTeX; a page drawn in the browser still loads KaTeX for the body's formulas when it shows them.

D14. A WebGL scene on a lesson's first screen waits for the reader's first gesture (a scroll, a pointer move, a touch or a key, Tab included; `untilReaderGesture`), and until then its card shows the scene's still, drawn from the same geometry and camera into the page's HTML (`MathPicture`), never a blank frame or a skeleton (16 November 2026).

D15. Motion loads with the parts that move (16 November 2026). The root document and `DesignSystemProvider` each wrapped every page in Motion's `MotionConfig` for its reduced-motion policy, and `lib/attribute.ts` read two SVG helpers from the `motion` barrel. Under `strictExecutionOrder` (D9) that one root import kept 198 of motion-dom's 252 modules and 82 of framer-motion's 179 in the boot chunk, drag, layout and scroll included, though no first paint moves anything. Each part that animates a transform now sets the policy itself (the chart's reveal, as the ancient atom and sequence labs already did; the streak reads `useReducedMotion`), the other islands animate only opacity, path length or a scroll-bound style, and `attribute.ts` keeps the 23 SVG names itself. Measured on the production build of `fdb589be51` behind a Brotli proxy, Lighthouse mobile at 12x CPU, median of 5:

|                                           | Before                                | After                                 |
| ----------------------------------------- | ------------------------------------- | ------------------------------------- |
| Boot chunk, decoded                       | 1,304,596                             | 1,130,507                             |
| Sign-in first JavaScript, transfer        | 490,592                               | 435,174                               |
| School landing first JavaScript, transfer | 707,687                               | 676,394                               |
| Home, article, Quran, search, transfer    | 852,332 / 762,513 / 746,537 / 707,749 | 855,847 / 765,794 / 749,716 / 711,006 |

A page whose links warm a `_main` page (D3) still loads Motion within the window, now as its own chunks, about 3 KB more. Performance scores moved within the run-to-run spread (sign-in 81 to 85 before, 86 after).

D16. The boot chunk holds only what a first load runs (21 November 2026). Under D9 the boot chunk holds every module the browser entry imports statically, and the entry imports the route tree, so it held each route's options with the router: every search schema, guard, head and loader, and all they import. A slow phone evaluates that chunk in one task before hydration, so a module one route's option imports cost every page. On production `/id` at 12x the chunk was 1,434 KB and its task took 656 ms. A set page's `loaderDeps` read `attemptOf` from the learner's live reads, which imported the Convex client, Confect's React bindings and the attempt's schemas down to Aksara's formula parser; its loader warmed those reads; the root's price currency read the country registry, which read the school schemas and every mascot family through their animal codes; school routes read their params and guards from the forum's and the tenancy's schemas. Each now reads a module of its own: `attemptOf` lives with the address intent, `canManageSchool` in `lib/tenant/manage.ts`, a class's address parts in `classroom/address.ts`, and a country profile's schema in `country/profile.ts`, so the registry imports no school schema. Every route's loader loads with its route (`codeSplittingOptions` in `apps/www/vite.config.ts`): hydration runs no loader, and D10 already preloads only a route's `component`. `verifyBootChunk` in `apps/www/output.config.ts` fails a build whose boot chunk is over `BOOT_CHUNK_BYTES` or holds a module only a signed-in island runs (`readBootProblems` in `apps/www/src/lib/static/boot.ts`).

Measured on the production build of `2a878e38b54` and the same build with this change, served by the acceptance runtime on this Mac, Lighthouse mobile at 12x CPU, median of 5:

|                            | Before    | After     |
| -------------------------- | --------- | --------- |
| Boot chunk                 | 1,434,463 | 1,041,544 |
| `/id` blocking time        | 733 ms    | 465 ms    |
| `/id` boot task            | 664 ms    | 379 ms    |
| `/en/school` blocking time | 729 ms    | 712 ms    |
| `/en/school` boot task     | 657 ms    | 401 ms    |

The School landing's own code now evaluates in its hydration task (377 ms instead of 158), so its blocking time holds; its gain needs its own first paint lighter. A warmed route fetches its loader as a file of its own, so the JavaScript budget's graphs count a few more files and a little more text: the homepage, Quran and Memory limits moved by D9's rule, and main already measured the homepage and Quran over their old limits.

## Consequences

Positive: every page loses those recalculations, the home page's first JavaScript no longer holds the sections under its first screen, and decoration leaves the thread to the reader.

Negative: a press on a section that is still loading its code is lost until the section hydrates, which the near-screen margin makes rare; a link still navigates. Toys and Nina wait for a gesture or ten seconds. An end-to-end spec that waits for a far section to hydrate has to walk down the page. Since D9 the build's JavaScript is 32 MB instead of 27, a page that warms others decodes up to 7% more, every module carries an init wrapper, and the inline option is experimental in Rolldown, which Vite pins.
