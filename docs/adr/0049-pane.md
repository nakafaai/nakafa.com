# ADR 0049: Every Try-Out Set Opens In A Pane Beside Its Track

## Status

Accepted on 20 November 2026, from the owner's notes and prototype review of the same day. It amends ADR 0047, D27: the try-out pages compose the progress cards, and the set's pane is where they do.

## Context

A set with parts, such as an SNBT set, opened a page of its own whose body was a list of its parts and whose pane stood empty until the attempt ended. A set without parts, such as a TKA set, opened its paper's page. The owner found the page empty, its header and title repeating each other, a description reading "0 parts" for a set without parts, and cards nested in cards. The track's level column drew every level as the same outlined badge, so a learner could not scan which sets are easy and which are hard.

## Decisions

### D1. The set's address opens its pane

Every set opens in the pane at the right of its track's table, at the set's own address, so a learner can send it and the table stays where it is. The track's layout route (`$track/route.tsx`) owns the track's loader, its catalog query and its table, and draws the set route as the pane's body. A part's page stays a whole page: its route is the non-nested `$track_/$set/$section`, which loads no table. A track with no set open keeps its own head in its index route, which reads the layout's answer, since links from every match join the document's head.

### D2. A paper takes the whole page

An address that opens a paper skips the table: `?mode=practice` for every set, and, for a set entered by its one section, `?attemptId`, which shows that attempt's player while it runs and its review once it ends (`opensSetPaper`). A running attempt's address always names it, so a running TKA attempt always opens its player. On a set with parts, `?attemptId` shows that attempt in the pane.

### D3. The pane shows, it does not tell

The header holds the set's title over the learner's level bar, which draws the Stars the set still gives in a lighter yellow after the fill; a visitor reads the set's question count and time instead. The body holds, each split by a line across the pane:

1. The attempt, with no title: the picker of the set's scored attempts across the pane's width, each with its score at its end, then the time left on a clock that rolls each second and the parts done, or the result with its rank on the set's board and its date.
2. The parts as one path: a step for each part, done, next, missed or still to do, each a link to its part with the Stars it still gives, ending at the set's finish, which shows the Petarung medal it counts toward.
3. Rewards: a grant for the parts and one for the set, each ticked once held, and the Petarung and Penuntas medals with what the set adds on their way.
4. The set's leaderboard: the first five learners by best score, all ten on request, and the learner's own row under them.

The footer is one row: the set's level, a button that copies the set's link, and the set's one primary action.

### D4. Levels read by length and colour

A level draws four rising bars that fill one more for each level, from green through yellow and orange to red, with its name beside them. Cooked also names itself in red.

### D5. A set's board is kept as its scores arrive

`tryoutSetBests` keeps each learner's best published score on a set, and the `tryoutSetRanks` aggregate orders them by set, so a board reads its first ten, its size and any score's place in a few reads. The score's finalizer writes the best in the attempt's transaction; deleting an account removes its bests. No backfill ships (packages/backend AGENTS.md), so a board fills from its first scored attempt after release. The unused `globalLeaderboard` component is removed.

### D6. The pane reads the learner's island lightly

`island.queries.growth` answers the learner's lifetime Stars and tally without the world they built, and `island.queries.claims` answers which grants of one set they hold, from one point read and one range read of the ledger. The track's layout loads the Island messages, so only try-out tracks carry them.

## Consequences

- The set page's overview, its parts list and its parts' result pane are gone; the pane replaces them.
- A part's page and a paper's page are unchanged.
- A leaderboard is empty for a set until a learner finishes it after release.
