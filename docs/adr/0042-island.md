# ADR 0042: The Island Every Learner Owns

## Status

Accepted on 8 November 2026.

## Context

The owner confirmed the Nakafa Consumer plan on 8 November 2026 (tracker artifact `SM36LQgx3VKih6NUs4swRs`, section Pulau, goals W1 to W10, decisions D13 to D18, D26, D28). Gamification is the foundation of retention: every learner owns a small floating island that grows as they learn, decorates it block by block, farms over real days, and shares it so friends can visit. The world is called Pulau in Indonesian and Malay, Island in English, and Insel in German (D13). The goal is simply the nicest island, and a shared island doubles as marketing, so it has to be cute.

The owner's reference is an isometric pixel-art island cut as a cube over clouds, with a see-through water cross-section, soil layers with stones, a red-tile cottage, a big tree, a pier and a boat. The style is 2D inside 3D (D28): ground, water and buildings are 3D geometry drawn as clean pixels, while animals, small plants and effects are 2D pixel sprites standing in that world. Every character is an animal (D14), Nina swims in the pond, and no asset comes from an image or audio model.

Three constraints shape everything below. The island's code must never enter a route's first JavaScript (ADR 0039). The economy must be impossible to farm, because Bintang (Stars, Sterne) are earned only from learning and buy nothing with money (D15). And one fact has one owner (the root guide), so nothing below is stored twice.

## Decision

### Data

D1. `packages/backend/confect/island` owns the domain: its contracts, rules, catalog and functions. The web app imports its contracts from there, as it imports every other domain's.

D2. Two tables.

| Table | One row per | Fields | Indexes |
| --- | --- | --- | --- |
| `islands` | learner | `userId`, `lifetime` (every Star ever granted), `layout` (packed placements, D4), `version`, `badges`, `visibility` (`private`, `link`, `public`), `timeZone`, `harvested` (every material its harvests gave, D13), `learned` (the day of the newest grant, which watering reads, D13) | `by_userId` |
| `islandAwards` | grant | `userId`, `kind`, `key`, `stars`, `day`, `subject` when a lesson grants it | `by_userId_and_key`, `by_userId_and_day`, `by_userId_and_kind` |

D3. Level, spendable Stars and size are derived, never stored.

- Level is read from `lifetime` through the level table (D10).
- Spendable Stars are `lifetime` minus what the layout's placements paid (D4). A balance column would be a second owner of what the ledger and the layout already say, and could drift from them.
- The island's size comes from its level.

`lifetime` is the one aggregate the ledger keeps beside its rows, written in the same transaction as each grant, because summing an unbounded ledger on every read is not an option.

D4. The layout is one `ArrayBuffer` of fixed 10-byte placement records: item (u16), x, y, z (u8 each), rotation and stage (u8, two and three bits), the Stars this placement paid (u16), and growth (u16, the days a plant was watered). A Convex array holds at most 8,192 values, and a 24 by 24 island with a few layers of blocks passes that; packed records also keep each write small, which is what Convex bills. `island/layout.ts` owns the codec and its Schema, and the server decodes, validates and re-encodes on every write. `version` rises by one on every write, so an edit made against an older layout is refused instead of overwriting a newer one.

D5. Removing a placement refunds what it paid, so building is free to experiment with and an undo is exact: placing costs the price, removing returns it, an upgrade adds its step, and a downgrade returns that step. A new island starts with the starter set (a small hut and a big tree) as placements that paid nothing. They can be moved, rotated and upgraded, never removed, so a gift never becomes Stars.

D6. A visitor reads an island only when its owner made it `link` or `public`; a new island is `private`. The public read returns the layout, the level, the badges, the owner's username, name and animal, and nothing else: no Stars, no ledger, no school, no score.

D7. Account deletion removes the island and its ledger through `auth/cleanup/island.ts`, one bounded batch at a time like every other step.

### Awards

D8. `island/award.ts` is the one seam that grants Stars: `grantAward(userId, source)`. A source is a tagged Schema union, and each kind declares its Stars, its key, and its daily count. A grant:

1. builds the source's key and returns `duplicate` when a ledger row already holds it;
2. reads the owner's grants of the current day in the island's zone (`by_userId_and_day`, at most a few dozen rows);
3. returns `capped`, writing nothing, when the kind's daily count or the 150-Star daily total is reached, so the same learning can still earn it on another day;
4. otherwise writes the row with what remains of the total, at most the kind's Stars, raises `lifetime`, and creates the island with the starter set when the learner has none yet;
5. grants every badge the new row completes (D11).

| Kind | Key | Stars | Daily count |
| --- | --- | --- | --- |
| `lesson` | the content | 5 | 6 |
| `section` | the try-out set and section | 15 | none |
| `set` | the try-out set | 40 | none |

The daily total is 150. A key is held for good, so repeating a lesson or a set, or signing in, never grants twice.

D9. Each source calls the seam in the transaction that proves the learning. A try-out section grants when `finalizeSectionAttempt` closes it with at least one answer, and a set grants when that closes its last section. A lesson grants through `contents.views.finishLesson`, which the lesson page calls once its end comes into view; the server refuses it unless the signed-in learner opened that lesson at least 45 seconds earlier. Latihan, the tryout lane's practice mode, adds its kinds (first correct answer, 1 Star, 40 a day; a corrected mistake, 2 Stars, 20 a day) as two members of the source union and two rows of the rule table, with no other change.

D10. The island grows by level.

| Level | Lifetime Stars | Size | Opens |
| --- | --- | --- | --- |
| 1 | 0 | 6 by 6 | grass, soil, trees, the hut |
| 2 | 150 | 8 by 8 | pond with its cross-section, pier, boat |
| 3 | 400 | 10 by 10 | garden, fence, path, ducks |
| 4 | 900 | 12 by 12 | house, lamps, the first animal villager |
| 5 | 1,800 | 16 by 16 | library, lab, observatory through subject badges |
| 6 | 3,500 | 20 by 20 | school, Nakafa's mission building |
| 7 | 6,000 | 24 by 24 | high layers |

D11. Badges are kept on the island row, because there are a dozen at most and every island read needs them. A badge is granted once, in the grant that completes it:

| Badge | Completed by | Opens |
| --- | --- | --- |
| Explorer | grants on 7 different days within 10 | lighthouse |
| Try-out Fighter | 10 sets finished | school |
| Mathematics, Physics, Chemistry, Biology | 10 lessons of that subject finished | clock tower, observatory, laboratory, greenhouse |

The plan names subject mastery of 10 topics; until Latihan measures mastery, a finished lesson stands for it, and Latihan moves the rule to mastery in its own change. Score medals (bronze, silver, gold statues and flags) arrive with the upgrade paths in W4.

### Building

D12. Build mode sends a batch of operations with the version it edited: place, move, rotate, remove, upgrade, downgrade. The server applies them in order to the decoded layout and refuses the whole batch on the first failure: outside the island, overlapping, unsupported, locked by level or badge, unaffordable, removing a starter piece, or a stale version. The client applies the same operations at once (one Schema and one rule module serve both sides) and rolls back when the server refuses. Undo sends the inverse batch.

D13. Plants grow over real days. Watering takes one tap and is possible once a day, on a day the owner learned (a grant exists for that day); a plant's stage follows the days it was watered. A harvest gives building materials, never Stars, so learning stays the only source of the currency.

### Renderer

D14. The island draws in its own React Three Fiber canvas under `apps/www/src/components/island`, separate from the design system's visual canvas, because it needs an orthographic camera, a pixel pipeline and no anti-aliasing. That module and three.js load with `import()` on intent and never reach a route's first JavaScript.

D15. The pixel pipeline:

- The canvas's drawing buffer is the art resolution: its CSS size divided by the art pixel, and the browser enlarges it with `image-rendering: pixelated`, so no upscale pass runs. The art pixel is 3 CSS pixels by default; zoom moves it between whole numbers (2 to 6) and never to a fraction, so every art pixel stays square and sharp. The canvas's CSS size is a whole multiple of the art pixel.
- The camera is orthographic, turned 45 degrees and tilted 30 degrees, which draws every grid edge as a clean two-across, one-up staircase. True isometric (35.26 degrees) draws 1.73-to-1 lines that stutter, so the plan's angle was refined to the one pixel artists use. The camera turns in 90-degree steps, and its position is snapped to the art-pixel grid.
- One cell spans 16 art pixels across, and a model has 8 voxels to a cell edge, so one voxel is about two art pixels.
- Faces are lit flat and in bands: the sun's angle picks one of four tones of the face's color ramp, so shading is made of palette colors, never gradients.
- A post pass reads depth and normals: a dark line where a surface stands in front of a farther one, a light line on a convex crease. The same pass maps every color to the nearest palette color, which keeps water, fog and the night tint inside the palette.
- Sprites are drawn one texel to one art pixel. Their screen position is snapped to the art-pixel grid, and every texel of a sprite takes the depth of its base, so an animal is hidden by a house it walks behind and never cut by the ground it stands on.

D16. Assets are data, written in the repository, never images:

- The palette is one list of named colors grouped in ramps of four (shadow, base, light, highlight): grass, soil, stone, wood, roof red, roof blue, water, foliage, fur and feathers, cloud, glass, light. Night is a tint of the same colors.
- A voxel model is a short list of shape operations over its own grid (box, hollow box, gable roof, cylinder, blob, carve, stripe, single voxel), each naming a ramp, with a seeded per-voxel jitter between neighbouring tones for texture. The renderer evaluates it once per model, stage and rotation, merges its faces greedily into one geometry, and instances repeated blocks.
- A sprite is a few rows of characters per frame with a key from character to palette color, and a frame rate.
- The island body (grass top, soil, stone layers, the cut faces with stones) is generated from the level's size and a seed, never stored.

The first set follows the reference: grass, soil, stone, water with its cross-section, the hut, the big tree, the pier, the boat, clouds, ducks, fish and Nina.

D17. Performance budget:

| Budget | Value |
| --- | --- |
| A route's first JavaScript | unchanged; the budget spec measures the home and island routes |
| Island chunk | loaded with `import()` only on intent or when the frame nears the screen after `untilPageRead` |
| Drawing | on demand; ambient life at 30 frames a second at most, kept to `createFramePace`, stopped while the page is hidden or the canvas is off screen |
| Drawing buffer | a ninth of the canvas's CSS pixels at the default art pixel |
| A 24 by 24 island | under 60 draw calls and 50,000 triangles |
| Sound | synthesized in Web Audio, no files |

### Life, sound and sharing

D18. Day and night follow the owner's local time, also for a visitor (D17 of the plan), from the island's `timeZone`, which the owner's own visit keeps current. Weather comes from the existing `/api/weather` route; a visitor sees the owner's weather, read on the server, so a visitor never learns where the owner is.

D19. Music is generated: the scale and tempo follow the hour, the instruments follow the weather, and it starts after the first tap with one mute control (D26). Ambient sounds and effects are synthesized too.

D20. Sharing: a public link at `/{locale}/island/{username}`, an OpenGraph image from a snapshot the owner's browser renders and stores in R2, a short clip the browser records from the canvas, read-only visits with preset hearts and stickers (D16 of the plan), and live co-visits last through the installed `@convex-dev/presence`.

## Consequences

- A learner's island grows from every lesson and try-out from the day this lands, before they first open it.
- The Stars a learner can spend are always exactly what the ledger granted minus what their island paid, so no repair job can ever be needed.
- Adding an award kind is one Schema member and one rule row, and Latihan plugs in without touching the island.
- Changing a price never changes a learner's balance, because each placement keeps what it paid.
- The art stays consistent because every color comes from one palette and every model from the same handful of shapes; a new asset is a few lines of data.
- The home page keeps its first JavaScript, and a phone that never comes near the island never downloads three.js.
