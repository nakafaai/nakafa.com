# ADR 0043: The Player Owns The Question Kinds

## Status

Accepted on 8 November 2026.

## Context

GLOSSARY.md says the Player knows questions, answers and time, and nothing of try-out routes or Convex functions, so a School assessment binds the same parts. The code said otherwise. The question kinds a learner answers, a choice, a true or false table and a matching, lived in three homes:

| Kind | Home before | Bound by |
| --- | --- | --- |
| Choice (radio, check box, reviewed) | `tryout/runtime/choice/surface.tsx` | try-out fields and review, School sitting, the exam editor |
| True or false table | `tryout/runtime/choice/table.tsx` | the same four |
| Matching board | `exams/lines/*` | School sitting, the exam editor and its key |
| Their response model (`choiceOf`, `pairingOf`, `tableOf`, `toggleOption`, `pairedWith`, `markedWith`) | `exams/sitting/response.ts` | School, the editor, and try-out fields |

So School's editor and sitting imported try-out's runtime, try-out imported School's sitting, and the table read its words from the try-out dictionary. Each kind's row had already moved to one marked line in the design system (#2205), so the kinds themselves were the last part on the wrong side of the seam.

## Decision

D1. The question kinds live in the Player: `player/choice.tsx` (`ChoiceRadio`, `ChoiceCheck`, `ChoiceReviewed`), `player/table.tsx` (`ChoiceTable`), `player/lines/*` (the matching board), `player/response.ts` (the response model) and `player/tone.ts` (an answer's tone: open, chosen, correct or wrong).

D2. Try-out and School are two adapters of the same kinds. Try-out binds them in `tryout/runtime/response` to its corpus questions and its keys; School binds them in `exams/sitting` to its paper, and the exam editor composes them around its rich texts. Neither imports the other.

D3. The kinds read their words from the `Player` dictionary namespace (`answer`, `statement`, `correct`, `incorrect`), so a School page never reads try-out copy.

D4. Each kind draws every answer on the design system's marked line (`components/ui/line`): the kinds own what an answer means, the marked line owns how its marker and words stand.

## Consequences

- A new question kind is added once, in the Player, and both adapters bind it.
- `tryout/runtime/choice`, `exams/lines` and `exams/sitting/response.ts` are gone; their tests moved with them.
- A try-out question kind and a School question kind can no longer drift apart, since they are one component.
