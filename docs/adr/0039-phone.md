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

D10. A static page preloads only what its first paint runs (15 November 2026). TanStack Start lists every `?tsr-split=` chunk of a route as its preload, the chunks of its `errorComponent` and `notFoundComponent` included, so every page fetched them and never ran them: WebKit flagged the `$locale` error and not-found parts and `components/state/app.tsx` as preloaded and unused on every load of `/en`. The build records each client chunk with its address, its static imports and the route parts it holds, and the loader starts the entry, the preloads that hold a route `component`, and what those import statically (`readFirstLoad` in `apps/www/src/lib/static/chunks.ts`). The router loads a not-found part when it shows one. An error part stays in its route's own module instead (21 November 2026): a page breaks when the chunks it asks for cannot load, because a deploy replaced them or the network went, and a split error part could not load then either, so the reader met a blank page instead of the broken state that `e2e/state/broken.browser.ts` proves. Each error part is a few hundred bytes over modules the boot chunk already holds. A preload the build recorded no chunk for stays and counts toward `BOOT_SCRIPT_LIMIT`, and a build that recorded no chunk fails.

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

D12. A long page skips each part once, and a jump lays out the parts above its target first (16 November 2026). D3's box (`LaterSection`) and each part's own section (`content-auto-section`) both set `content-visibility: auto`. Inside the two skipped boxes, WebKit's `scrollIntoView` did nothing for an element of a part, and Firefox and WebKit dropped the section's `scroll-mt-16`. A jump also landed on the placeholders' heights: a box holds one screen for its part until it is laid out, the School exams part is 1,251 px tall, and laying it out after the scroll moved the target. Scroll anchoring did not take that back. Measured at 1440x900, as the top of `#reports` relative to the header's bottom after the header's School › Report cards link: Chromium +128 px, Firefox -64, WebKit -900. The box is now the one skipping layer, the `later-section` utility, because D3 makes it the owner of a part under the first screen; `MarketingSection` no longer skips, and the pricing page's schools and questions go through `LaterSection` like the other long pages. A jump lays out every box that holds or precedes its target (`data-laid-out`, which `later-section` reads; since D17 no `:has()` finds the target): `LOADED_JUMP_SCRIPT` at the end of the body does it for a loaded `#part` address, before the browser's fragment scroll, and `followHashJumps` in `apps/www/src/components/marketing/shared/jump.ts` for a navigation to a hash, on the router's `onResolved`, which comes after the page commits and before the router's one hash scroll. Laying them out first makes that scroll land on real heights with the section's margin, in Chromium, Firefox and WebKit within 1 px, and nothing moves after it. The boxes below the target stay skipped, and a load without a hash lays out nothing more. `apps/www/e2e/marketing/jump.browser.ts` holds both jumps to that bound.

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

D17. Nothing that a first load does not need restyles or runs inside its window (21 November 2026). A trace of production `/id` at 12x after D16 showed four passes over the whole page after hydration, each about 100 ms, and two route chunks evaluating, none of them the page's own work:

- UI SDK registered its popup room and sheet drag properties and wrote its `ui-sdk-hidden` and `ui-sdk-popover-reset` sheets at the first idle moment after hydration. A registered property restyles the root, and a new `@layer ui-sdk` sheet re-collects the font faces and lays out every object. `UI_SDK_HEAD_SCRIPT` and `UI_SDK_STYLES` in `packages/design-system/lib/sdk.ts` register the properties and render both sheets with UI SDK's own text in the head, and record every popup as prepared in UI SDK's reset registry, so its writes change nothing (vercel-labs/ui#1001). This replaces the scroll area's own head script.
- `warmLinks` evaluated the pages on the first screen (a learn page's `_main` chunk took 180 ms) and inserted their sheets, a full restyle each. A warm now waits for `untilPageRead`, as D4's decoration does.
- A later section near the first screen loaded and evaluated its code once the page settled: the School landing's forum section took 244 ms. `LaterSection` now waits for `untilPageRead` too; a press made before hydration still loads the section at once.
- The `later-section` utility matched a jump's target with two `:has()` rules on every box. It now reads `data-laid-out`, which D12's scripts set.

The JavaScript graph of `apps/www/e2e/budget/javascript.browser.ts` moves the pointer once the page took over, so it still counts the warmed pages. `prepareClientNavigation` moves it too before it waits for a later section's link.

Measured on the acceptance runtime on this Mac, Lighthouse mobile at 12x CPU, median of 5, before (D16) and after:

|                            | Before | After  |
| -------------------------- | ------ | ------ |
| `/id` blocking time        | 465 ms | 378 ms |
| `/en/school` blocking time | 712 ms | 256 ms |

What blocks now is the boot task itself, about 330 ms on `/id`, about 140 ms of it Effect's own module initialization.

D18. The boot chunk starts in phases, one task each (21 November 2026). After D17 the largest task of a first load was the evaluation of the boot chunk: every module's top level ran in one task, about 330 ms on `/id` at 12x, and production measured it at 406 ms. `apps/www/src/client.tsx` replaces TanStack Start's default browser entry. It imports React and the `effect/Effect` module alone (Effect's index would start every module of the library before the first phase), then starts the boot chunk's modules through dynamic imports, ending the task between them with `Effect.yieldNow`, which Effect's default scheduler resumes from a timer in a browser: Effect's schema tree (`effect/SchemaAST`), the locale schemas, the address rewrites, the localized states with the design system's parts, the root route, the rest of the route tree, and Start's client with React's DOM renderer, which then hydrates. A dynamic import of a module the chunk holds fetches nothing: Rolldown compiles it to a call of the module's lazy initializer (D9's `strictExecutionOrder`). The boot group now captures the entry's phase modules by name (`BOOT_MODULES` in `apps/www/output.config.ts`) with everything they import, because the entry no longer reaches them statically. `verifyBootChunk` fails a build whose phase lies outside the boot chunk: a first cut that started `lib/settle` made it a chunk of its own, one more script to fetch before hydration, and took a try-out page to 61 boot scripts, over `BOOT_SCRIPT_LIMIT`. Importing `effect/SchemaAST` keeps every export of that module, about 8.6 KB more in the boot chunk.

The early-press mark is now `data-early-press`. UI SDK draws `data-pressed` on a toggle that starts pressed, so `holdsEarlyPress` read the home page's lesson section, whose toggles start pressed, as pressed before hydration, and loaded its code at once (78 ms) despite D17.

Measured on the acceptance runtime on this Mac, 12x CPU, the largest boot task on `/id` went from 330 ms to about 110 ms, the phases taking 31 to 81 ms each. Lighthouse mobile at 12x, median of 5, lists no task of the app's scripts as blocking on `/id` or `/en/school` (blocking time 0 ms in both, from 378 and 256).

D19. A formula after the first screen preloads no math face (21 November 2026). The server render preloads the KaTeX faces each formula draws (`MathFontPreload`), so a lesson's math draws with the page. The home page draws a formula in its lesson section, below the first screen of a phone, and its two preloads, `KaTeX_Main-Regular` and `KaTeX_Math-Italic`, about 44 KB, went out at high priority beside the global stylesheet and the text face while the page waited for that stylesheet to paint. `LaterSection` now wraps its section in `LaterMath`, under which `MathFontPreload` preloads nothing; the faces load when the browser first lays the formula out, which the section's `later-section` box holds back until it nears the screen. A lesson keeps its preloads.

D20. The head registers a scroll area's progress too (21 November 2026). UI SDK registers `--scroll-area-progress-x` and `--scroll-area-progress-y` when a scroll area's code first runs, and the head script of D17 registered neither, so the sidebar's scroll area restyled every element of the page once its code arrived: 7,490 elements and 95 ms on a lesson at 4x CPU in production. `UI_SDK_HEAD_SCRIPT` now registers both the way UI SDK does, to take any value without inheriting, in every engine.

D21. The text face is Allo, rounded, cut to what a page draws (21 November 2026). The owner chose Allo (`joshpuckett/allo` v1.0.3, commit `60992c5e12a4`, SIL OFL 1.1 with no Reserved Font Name) as Nakafa's face, warm and rounded, with the vertical metrics of the face it replaces: 2048 units per em, ascent 1984, descent -494, no line gap, capital 1490. Its variable font has three axes, weight 100 to 900, optical size 9 to 32 and roundness 0 to 100 (default 50). `bun run fonts:allo` (`scripts/fonts/allo.ts`) downloads the pinned font, checks its SHA-256, and cuts one instance with hb-subset (`subset-font` 2.9.0): roundness pinned to 100, optical size to 14 (Allo's Text size), weight kept from 400 to 600, and the layout features the app reads (calt, case, ccmp, kern, liga, locl, mark, mkmk, tnum). It subsets that instance into Google Fonts' latin, latin-ext and vietnamese ranges; Cyrillic and Greek, which Allo does not draw, fall through to the system stack. As WOFF2 the Latin face weighs 32,560 bytes, against 48.8 KB for the Latin file of the face before it; with weights 300 to 700 it weighed 55,308, with 400 to 700 44,444, and with the optical size range 135 KB. Latin-ext weighs 19,832 bytes and Vietnamese 8,208. Font bytes a page requests before its largest paint count in Lighthouse's LCP, so the type scale is 400, 500 and 600: `b`, `strong` and `th` draw at 600 from the design system's base layer, the three classes that asked for 300 or 700 ask for 400 or 600, and the social image's copyright line draws at 600.

The generator writes the faces and their license into `packages/design-system/fonts/allo`; the `@font-face` rules into `styles/allo.css`, which the design system's global stylesheet imports, so the faces arrive in the main stylesheet instead of in a render-blocking stylesheet of their own; and `packages/backend/confect/pdf/allo.ts`, which carries the faces to the PDF renderer as Base64 because a Convex action reads no file of the design system, kept equal to the served files by `allo.test.ts`. The root document preloads the Latin face. Until Allo arrives the text draws in Arial or Roboto scaled to its width. Measured in Chromium with canvas `measureText` at 100px over the English, Indonesian and German dictionaries (their Latin-1 characters), Allo's lines are 1.0433, 1.0323 and 1.0414 times as wide as Arial's, a mean of 1.0390, so "Allo Fallback Arial" takes `size-adjust` 103.90%, `ascent-override` 93.24% and `descent-override` 23.22%, and "Allo Fallback Roboto" takes the same width through Capsize's Roboto to Arial ratio (107.355 over 107.119): 104.13%, 93.03% and 23.16%. Social images draw in Allo's Latin face, documents in all three faces with Noto Naskh Arabic for Arabic, and the toast's line counts follow Allo's average widths, 968 units at weight 500 and 958 at 400.

D22. A visual of a served lesson hydrates once it nears the screen (21 November 2026). Every lesson visual, a chart, a scene or a lab, has its own hydration boundary (`withHydrationBoundary` in `lib/content/renderer/client/boundary.tsx`), and each loaded its code and drew right after the lesson hydrated, wherever it stood: on `/en/subjects/ai-ds/linear-methods/all-eigenvalues-calculation` in production at 4x CPU, Recharts drew in tasks of 284, 162, 77 and 67 ms, the lesson's largest after the first layout. The boundary now waits, on a served lesson, until its box comes within half a screen of the screen (`untilNearScreen`, as `LaterSection` does), and React keeps the server's HTML of the visual until then. A visual of a client navigation draws at once, as before, because the loader settles its code with the page's tree. The box is a plain `div` around the visual, with no class; no rule of the lesson reads the visual card's place among its siblings.

## Consequences

Positive: every page loses those recalculations, the home page's first JavaScript no longer holds the sections under its first screen, and decoration leaves the thread to the reader.

Negative: a press on a section that is still loading its code is lost until the section hydrates, which the near-screen margin makes rare; a link still navigates. Toys and Nina wait for a gesture or ten seconds. An end-to-end spec that waits for a far section to hydrate has to walk down the page. Since D9 the build's JavaScript is 32 MB instead of 27, a page that warms others decodes up to 7% more, every module carries an init wrapper, and the inline option is experimental in Rolldown, which Vite pins.
