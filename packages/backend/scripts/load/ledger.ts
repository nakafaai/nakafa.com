import {
  Array as Arr,
  Equivalence,
  Option,
  Order,
  pipe,
  Record,
  Schema,
} from "effect";

/** The options a load test student chose in one choice question. */
export const Choice = Schema.Array(Schema.String);

/**
 * One answer whose write the server acknowledged to the student: the attempt, the question, the
 * version it was numbered with, and the options chosen.
 */
export const Acknowledged = Schema.Struct({
  attempt: Schema.String,
  question: Schema.String,
  response: Choice,
  version: Schema.Int,
});
export type Acknowledged = typeof Acknowledged.Type;

/** One stored answer row as the database holds it after the run. */
export const StoredAnswer = Schema.Struct({
  attempt: Schema.String,
  question: Schema.String,
  response: Choice,
  version: Schema.Int,
});
export type StoredAnswer = typeof StoredAnswer.Type;

/**
 * What the database holds against what the students were told. `lost` counts questions whose
 * latest acknowledged answer the database does not hold, or holds at an older version;
 * `mismatched` counts a stored answer at the acknowledged version with other options;
 * `duplicated` counts every row beyond the first of one question; `ahead` counts a stored
 * version newer than the latest acknowledgement, a write that committed while its student was
 * cut off; and `unacknowledged` counts stored questions that no student was told about.
 */
export const Audit = Schema.Struct({
  acknowledged: Schema.Int,
  ahead: Schema.Int,
  duplicated: Schema.Int,
  lost: Schema.Int,
  mismatched: Schema.Int,
  stored: Schema.Int,
  unacknowledged: Schema.Int,
});
export type Audit = typeof Audit.Type;

/** The key of one question of one attempt. */
const keyOf = (row: { readonly attempt: string; readonly question: string }) =>
  `${row.attempt}:${row.question}`;

const sameChoice = Arr.makeEquivalence(Equivalence.String);

/** The latest acknowledged answer of each question of each attempt. */
const latestOf = (written: readonly Acknowledged[]) =>
  Record.map(Arr.groupBy(written, keyOf), (answers) =>
    Arr.max(
      answers,
      Order.mapInput(Order.Number, (answer: Acknowledged) => answer.version)
    )
  );

/** How one question's stored row stands against its latest acknowledgement. */
const standingOf = (expected: Acknowledged, row: Option.Option<StoredAnswer>) =>
  Option.match(row, {
    onNone: () => "lost" as const,
    onSome: (stored) => {
      if (stored.version < expected.version) {
        return "lost" as const;
      }
      if (stored.version > expected.version) {
        return "ahead" as const;
      }
      return sameChoice(stored.response, expected.response)
        ? ("kept" as const)
        : ("mismatched" as const);
    },
  });

/** Audits the stored answers against every acknowledged write of the run. */
export const audit = (
  written: readonly Acknowledged[],
  stored: readonly StoredAnswer[]
): Audit => {
  const latest = latestOf(written);
  const rows = Arr.groupBy(stored, keyOf);
  const standings = Arr.map(Record.toEntries(latest), ([key, expected]) =>
    standingOf(expected, pipe(Record.get(rows, key), Option.flatMap(Arr.head)))
  );
  const count = (standing: (typeof standings)[number]) =>
    Arr.filter(standings, (each) => each === standing).length;
  return {
    acknowledged: Record.size(latest),
    ahead: count("ahead"),
    duplicated: Arr.reduce(
      Record.values(rows),
      0,
      (total, group) => total + group.length - 1
    ),
    lost: count("lost"),
    mismatched: count("mismatched"),
    stored: stored.length,
    unacknowledged: Arr.filter(
      Record.keys(rows),
      (key) => !Record.has(latest, key)
    ).length,
  };
};
