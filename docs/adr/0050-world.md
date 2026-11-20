# ADR 0050: The World Has No Edge

## Status

Accepted on 20 November 2026, on the owner's go-ahead of that day after playing the prototype. It replaces these decisions of ADR 0047: D3 (the world is blocks), D5's block gestures, D6 (edits as packed blocks), D7's shelves of blocks by level, D10's village laid from blocks, D13's block book, D14 (blocks settle), D16 (farming on block soil), D17 (the home's tiers of blocks), D23's ring of six isles, D37's synthesized sound and D45 (cottages with rooms). ADR 0047 D1 (a full-screen route), D2 (a renderer of our own), D4's palette, D9 (the budget), D11 and D25 (the species and their models), D20 (crisp pixels), D21 and D22 (true bodies with room), D24 and D50 (the living sea), D29 to D31 (levels, medals, the run of days), D32 and D33 (one wind, weather that lands), D43 and D51 (water with depth that mirrors its banks, a sun that casts shadows), D48 and D49 (bodies that move) and D54 (the villagers' day) hold and are carried onto the new world.

## Context

On 20 November the owner asked for the game to be designed again from its foundation: a world with no edge, a camera and a HUD of world class that work on a phone held either way, real shapes and scale, physics with weight, recorded sound, weather that follows the real weather, a living land and sea, broad building, and sharing and visiting that truly work. A prototype outside this repository settled the look, the HUD and the play over five rounds with the owner, who approved it and asked for it in production at a higher quality than the prototype.

Reading the game as it stands found two faults under the owner's reports, beside the look:

| Report                          | Cause                                                                                                                                                                 |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every press ends in an error    | A build refused as stale reloaded the route, but the game's store is made once and kept the old version, so every later build was refused (fixed first, in its own change) |
| Sharing leads nowhere           | Share copied the link of the learner's own game, a private route that always opens the visitor's own island; no world has an address anyone else can open             |

### What the reference does and where it falls short

| Reference                                                                 | Studied                                                                    | Takes from it                                                                                               | Falls short on                                                                                        |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| A 3D pixel-art world in Godot, the owner's reference of 20 November       | its published video, frame by frame                                        | smooth land drawn small and enlarged in whole pixels, flat clean tones, dense blade grass, water in bands with a white line along the shore | a look alone: nothing to build, nobody living in it, no reason to come back, and no phone layout      |
| Cozy life sims with visits                                                | their published rules of play                                              | no timers and no loss, building that costs nothing, visits that need no shared hour                          | free text between strangers, and private leaderboards, neither of which a school product can carry    |

Nothing is copied: every shape, tone and layout is drawn from data in this repository, as ADR 0047 D4 requires.

## Decision

### W1. The land is a height field from a seed, with no edge

- One unit is one block of ADR 0047 D10, 0.9 m, so every model and every measure of that record still holds. The sea's face stays 8 blocks above the floor.
- The land is generated at lattice points one block apart, in chunks of 32 by 32 points with signed coordinates (`lib/island/land`): a continent's elevation from slow noise, cut into terraces 6 blocks high with a slope to walk up here and there, hills that grow with the elevation, rivers along the zero line of a warped field that fall as waterfalls where they cross a terrace, lakes on the terraces, beaches, meadows and forests by moisture, and a sea floor that falls away from the coast. Between lattice points the ground is read by bilinear blending, so nothing in the world is a cube.
- The land is never stored and has no footprint. A level opens no land: all of it is open from the first day, and levels stay the learner's rank (ADR 0047 D29).
- The learner's home is found from the seed: the flattest dry terrace near the origin with water a short walk away. Every world opens there, on a small camp.

### W2. Building is things and brushes

- A thing is a whole model set on the ground at half a block's grid, turned in quarter turns: plants, rocks, benches, lamps, wells, bridges, boats, cottages, a windmill, a lighthouse. It is refused where it would stand in another thing, on water it cannot float on, or on ground too steep, and the ground under a building is levelled as it lands.
- A brush changes the land itself in a round stroke: raise, lower, level, a pond, and the surfaces path, sand, meadow and grass, and one that clears wild plants.
- Undo and redo take back a whole stroke or a whole thing.
- Blocks, their gravity, block soil and the home's tiers end. Their modules and their tables' block fields leave in the change that makes the new world the game.

### W3. What a world stores

Only what the learner changed, by chunk: the height each lattice point was moved by, in eighths of a block; the surface each point was painted; the wild plants cleared; and the things set down, each with its kind, its place and its turn. Chunks are rows of their own, read as the learner nears them, so the size of a world limits nothing and a visit reads only where the visitor walks.

### W4. Changes are sent as operations and never taken back by a reload

The browser applies a change at once and sends it as an operation: a stroke of a brush, a thing set, moved, turned or taken away. The server checks each against the rules it can know without the land (the kind is one the learner opened, the numbers are in range, the chunk is not full) and writes it. It never refuses a change for being made against an older copy: two operations on one lattice point or one thing settle by the order the server received them. A refused operation is taken back alone, with a note, and the game goes on.

### W5. Stars open blueprints

Stars come only from learning (ADR 0042 D8 and D9, unchanged) and are never bought. A learner spends them once to open a blueprint of their choice, and builds that thing as often as they like afterwards. ADR 0047 refused spending Stars on single blocks because a balance could drift from the ledger; here the balance is the lifetime Stars less the price of the blueprints opened, both read from the server's own rows, and nothing is ever refunded because a blueprint cannot be sold. A world opens with the plants, the rocks, the bench, the fence and the lamp, and with a camp fire as a gift.

### W6. A world has an address, and a visit changes nothing

- Every world has a short address under the learner's profile that needs no account to open. Its owner chooses private, by link (the default) or public.
- A visitor walks, strokes the animals and kicks the ball, and cannot build, clear or take. A signed-in visitor may leave one sticker from a fixed set in the guest book. There is no free text anywhere in the game.
- Visits need no shared hour: nobody sees another learner move. The owner reads who came when they next enter.

### W7. One HUD in three layouts

Flat white panels, one radius, one primary: Learn. Identity and Stars top left; the map, the clock and the weather top right; the tools bottom centre (Explore, Build, Landscape, then Animals, Class, Share, then Learn). The shelf reads as header, body and footer on every screen: tabs of kinds, the things, then undo, redo and turn, every control a tile 44 px high with its icon over its label. On an upright phone the shelf stands over the tools; on a phone held sideways it stands at the left for the screen's whole height.

### W8. Every sound is a recording

ADR 0047 D8 and D37 synthesized the island's sound. The owner refused synthesized sound twice. Every bed, call and effect is now a recording in the public domain or under CC0, listed with its source beside the files, loaded after the first press, and mixed by the same deciders as before (the hour, the weather, the wind, the footing). No oscillator or noise buffer remains.

### W9. Life follows the learner

The species, their models, the shoals, the reef, the hunt, the breach and the villagers' day are kept. They no longer keep rounds about the middle of one island: each habitat is filled about the camera from the land it finds there (open sea, shallows, reef, river, lake, shore, meadow, forest, highland), by the seed, the place and the day, so the same learner meets the same herd at the same bay.

### W10. The engine stays ours

ADR 0047 D2 holds. The prototype drew with three.js to move fast; the game keeps its own WebGL2 renderer and gains three passes in the layout it already has: the land's mesh with its flat tones, the grass as instanced blades, and things as bodies, so shadows, outlines, the water's depth and mirror, and the quality ladder cover the new world without a second engine in the chunk.

## Considered Designs

**Keep blocks and make their world endless.** Rejected: the owner approved land with no cubes in it, and a block world streamed without an edge needs meshing and light the height field does not.

**Bring three.js into the game.** Rejected: the lessons' three.js is not on the game's route, the passes the prototype needs are three shaders, and the bodies, outlines and shadows the game already draws would be rebuilt on it.

**Refuse a change made against an older copy.** Rejected: it is what locked the game. Order of receipt is enough for changes that each name one point or one thing.

**Let visitors build.** Rejected: a visit that can change a world needs moderation the product does not have.

## Consequences

- The worlds learners built from blocks do not carry over: their block edits are cleared when the new world becomes the game, as ADR 0047 D6 cleared the first island's placements. Stars, levels, medals and the run of days are untouched.
- The work lands as a stack: the land and what a world stores; the server's rows and operations; things, brushes and life on the land; the renderer, the HUD and the recordings, which is the change that makes it the game and removes the blocks; then addresses, visits and the guest book.
- The game's words are written in every locale the dictionary holds.
