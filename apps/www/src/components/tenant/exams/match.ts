import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import {
  CHOICE_OPTIONS_MAX,
  CHOICE_OPTIONS_MIN,
} from "@repo/backend/confect/exams/question";
import { Array as Arr, Option } from "effect";
import { emptyLabel, type OptionLabel } from "@/components/tenant/exams/answer";

/** The match interaction, which a matching question holds. */
type Match = Extract<Interaction, { kind: "match" }>;

/** One pair of a match, as its key holds it: a statement and the answer it takes. */
type Pair = Extract<InteractionKey, { kind: "match" }>["pairs"][number];

/** The first match of a question's answers, or none when the answers hold no match. */
export const matchOf = (
  answers: readonly Interaction[]
): Option.Option<Match> =>
  Arr.findFirst(answers, (answer): answer is Match => answer.kind === "match");

/**
 * The two sides of a match, the statements a student pairs and the answers each one takes, with the
 * prefix that numbers each side's parts from one.
 */
const PART_PREFIX = { sources: "source", targets: "target" } as const;

/** One side of a match: its statements or its answers. */
export type MatchSide = keyof typeof PART_PREFIX;

/** The number that a part ID holds after its side's prefix, when it holds one. */
const PART_NUMBER = /^(?:source|target)-(\d+)$/u;

/**
 * The ID of a new part on one side: the side's prefix and the number after the largest one its parts
 * hold, so a new part never shares an ID with a part the match still holds.
 */
const nextPartId = (match: Match, side: MatchSide) => {
  const largest = Arr.reduce(match[side], 0, (most, part) => {
    const digits = PART_NUMBER.exec(part.id)?.[1];
    return digits === undefined ? most : Math.max(most, Number(digits));
  });
  return `${PART_PREFIX[side]}-${largest + 1}`;
};

/** The answers with one match changed by `change`, and every other interaction as it was. */
const changeMatch = (
  answers: Arr.NonEmptyReadonlyArray<Interaction>,
  change: (match: Match) => Match
): Arr.NonEmptyArray<Interaction> =>
  Arr.map(answers, (answer) =>
    answer.kind === "match" ? change(answer) : answer
  );

/** The answers with the label of one statement or answer replaced by the document its editor holds. */
export const withPartLabel = (
  answers: Arr.NonEmptyReadonlyArray<Interaction>,
  partId: string,
  label: OptionLabel
) =>
  changeMatch(answers, (match) => ({
    ...match,
    sources: Arr.map(match.sources, (part) =>
      part.id === partId ? { ...part, label } : part
    ),
    targets: Arr.map(match.targets, (part) =>
      part.id === partId ? { ...part, label } : part
    ),
  }));

/** The answers with one empty part added at the end of a side, unless that side holds the most it may. */
export const withPartAdded = (
  answers: Arr.NonEmptyReadonlyArray<Interaction>,
  side: MatchSide
) =>
  changeMatch(answers, (match) =>
    match[side].length < CHOICE_OPTIONS_MAX
      ? {
          ...match,
          [side]: [
            ...match[side],
            { id: nextPartId(match, side), label: emptyLabel(), maxMatches: 1 },
          ],
        }
      : match
  );

/** The answers with one part taken out of its side, unless that side holds the fewest it may. */
export const withPartRemoved = (
  answers: Arr.NonEmptyReadonlyArray<Interaction>,
  partId: string
) =>
  changeMatch(answers, (match) => ({
    ...match,
    sources:
      match.sources.length > CHOICE_OPTIONS_MIN
        ? Arr.filter(match.sources, (part) => part.id !== partId)
        : match.sources,
    targets:
      match.targets.length > CHOICE_OPTIONS_MIN
        ? Arr.filter(match.targets, (part) => part.id !== partId)
        : match.targets,
  }));

/** The pairs a key makes for a match, or none while the key is absent or pairs no match. */
export const keyPairs = (
  key: readonly InteractionKey[] | null
): readonly Pair[] =>
  Option.match(
    Arr.findFirst(
      key ?? [],
      (answer): answer is Extract<InteractionKey, { kind: "match" }> =>
        answer.kind === "match"
    ),
    { onNone: () => [], onSome: (answer) => answer.pairs }
  );

/**
 * The key of a match from its pairs, once they pair every statement of it: one answer for each match of
 * the answers. A key that pairs fewer statements is null, since the server takes only a key that pairs
 * every statement, and the teacher's pairs wait on screen until then.
 */
export const pairsKey = (
  answers: Arr.NonEmptyReadonlyArray<Interaction>,
  pairs: readonly Pair[]
): Arr.NonEmptyArray<InteractionKey> | null =>
  Option.match(matchOf(answers), {
    onNone: () => null,
    onSome: (match) =>
      Arr.isReadonlyArrayNonEmpty(pairs) &&
      pairs.length === match.sources.length
        ? [{ interaction: match.id, kind: "match", pairs }]
        : null,
  });

/** The key once a part leaves its match: the pairs of every other part, which no longer pair every statement. */
export const keyWithoutPart = (
  answers: Arr.NonEmptyReadonlyArray<Interaction>,
  key: readonly InteractionKey[] | null,
  partId: string
) =>
  pairsKey(
    answers,
    Arr.filter(
      keyPairs(key),
      (pair) => pair.source !== partId && pair.target !== partId
    )
  );
