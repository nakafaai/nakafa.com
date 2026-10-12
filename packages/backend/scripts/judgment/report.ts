import { Array as Arr, Record as Rec, Schema, String as Str } from "effect";

/**
 * One message of the labelled set as one judgment measured it: its number in
 * the set, the label it should get, and the probability the judgment gave.
 * `languages` and `form` describe the message without quoting it.
 */
const Point = Schema.Struct({
  form: Schema.optionalKey(Schema.String),
  label: Schema.Boolean,
  languages: Schema.String,
  probability: Schema.Finite,
  row: Schema.Int,
});

export type Point = typeof Point.Type;

/** What kept a message from a measure: the routing facts of a failed request. */
const Failure = Schema.Struct({
  reason: Schema.String,
  status: Schema.optionalKey(Schema.Finite),
  type: Schema.optionalKey(Schema.String),
});

export type Failure = typeof Failure.Type;

/** Probabilities come as hundredths, so a threshold is looked for in steps of one hundredth. */
const STEPS = 100;

/** Buckets of the table of probabilities, a tenth wide. */
const BUCKETS = 10;

/** A fraction, and nothing when there is nothing to divide by. */
function ratio(part: number, whole: number) {
  return whole === 0 ? 0 : part / whole;
}

/** How many points hold for a predicate. */
function count(points: readonly Point[], predicate: (point: Point) => boolean) {
  return Arr.length(Arr.filter(points, predicate));
}

/** Whether a threshold judges a message to be yes: from the threshold on, the threshold included. */
function judgedYes(point: Point, threshold: number) {
  return point.probability >= threshold;
}

/**
 * What a threshold makes of the points. `found` are the messages labelled yes
 * that count as yes and `missed` those that do not; `wrong` are the messages
 * labelled no that count as yes and `cleared` those that do not.
 */
export function confusion(points: readonly Point[], threshold: number) {
  return {
    cleared: count(
      points,
      (point) => !(point.label || judgedYes(point, threshold))
    ),
    found: count(points, (point) => point.label && judgedYes(point, threshold)),
    missed: count(
      points,
      (point) => point.label && !judgedYes(point, threshold)
    ),
    wrong: count(
      points,
      (point) => !point.label && judgedYes(point, threshold)
    ),
  };
}

/**
 * How well a threshold separates the labels: the mean of the share of yes
 * messages it finds and the share of no messages it clears, so that a rare
 * label weighs as much as a common one.
 */
export function balance(points: readonly Point[], threshold: number) {
  const { cleared, found, missed, wrong } = confusion(points, threshold);
  return (ratio(found, found + missed) + ratio(cleared, cleared + wrong)) / 2;
}

/**
 * The threshold that separates the labels best, in steps of one hundredth. The
 * thresholds that tie for the best balance form a stretch, and the middle of
 * it is the one that tolerates the most change in the probabilities.
 */
export function bestThreshold(points: readonly Point[]) {
  const scored = Arr.makeBy(STEPS, (index) => {
    const threshold = (index + 1) / STEPS;
    return { balance: balance(points, threshold), threshold };
  });
  const best = Arr.reduce(scored, 0, (most, { balance: value }) =>
    Math.max(most, value)
  );
  // The best balance is one of the scores, so at least one threshold has it.
  const ties = Arr.filter(scored, ({ balance: value }) => value === best);
  return ties[Math.floor((Arr.length(ties) - 1) / 2)].threshold;
}

/** The messages a threshold judges wrongly, in the order of the set. */
export function wrongly(points: readonly Point[], threshold: number) {
  return Arr.filter(
    points,
    (point) => point.label !== judgedYes(point, threshold)
  );
}

/** The probabilities by label: for each tenth, how many yes and no messages fall in it. */
export function histogram(points: readonly Point[]) {
  const bucketOf = (point: Point) =>
    Math.min(
      BUCKETS - 1,
      Math.floor(Math.round(point.probability * STEPS) / (STEPS / BUCKETS))
    );
  return Arr.makeBy(BUCKETS, (bucket) => ({
    from: bucket / BUCKETS,
    no: count(points, (point) => !point.label && bucketOf(point) === bucket),
    yes: count(points, (point) => point.label && bucketOf(point) === bucket),
  }));
}

/** A value in a column of a width, right aligned. */
function column(value: number | string, width: number) {
  return Str.padStart(width)(String(value));
}

/** The four counts of a threshold as a small table with its balance. */
function matrix(points: readonly Point[], threshold: number) {
  const { cleared, found, missed, wrong } = confusion(points, threshold);
  return [
    "                labelled yes  labelled no",
    `  judged yes  ${column(found, 12)}  ${column(wrong, 11)}`,
    `  judged no   ${column(missed, 12)}  ${column(cleared, 11)}`,
    `  balance ${balance(points, threshold).toFixed(3)}`,
  ];
}

/** One line for a message judged wrongly: its number, label, probability, language and form. */
function wrongLine(point: Point) {
  return Arr.join(
    [
      column(point.row, 5),
      point.label ? "yes" : "no ",
      point.probability.toFixed(2),
      point.languages,
      point.form ?? "",
    ],
    "  "
  );
}

/**
 * The table of one judgment: the probabilities by label, the counts at the
 * threshold the deployment holds, the threshold that separates best with its
 * counts, and the messages the held threshold judges wrongly. A message is
 * named by its number and described by its language and form; it is never
 * quoted.
 */
export function judgmentTable(
  name: string,
  threshold: number,
  points: readonly Point[]
) {
  const best = bestThreshold(points);
  return Arr.join(
    [
      `judgment ${name}: ${count(points, (point) => point.label)} messages labelled yes, ${count(points, (point) => !point.label)} labelled no`,
      "probability   yes    no",
      ...Arr.map(
        histogram(points),
        ({ from, no, yes }) =>
          `${from.toFixed(1)} to ${(from + 1 / BUCKETS).toFixed(1)}  ${column(yes, 4)}  ${column(no, 4)}`
      ),
      `at the threshold of the deployment, ${threshold.toFixed(2)}:`,
      ...matrix(points, threshold),
      `at the threshold that separates best, ${best.toFixed(2)}:`,
      ...matrix(points, best),
      `judged wrongly at ${threshold.toFixed(2)} (message, label, probability, language, form):`,
      ...Arr.map(wrongly(points, threshold), wrongLine),
    ],
    "\n"
  );
}

/** One kind of failure as a line of words: its reason, its status and its type, when it has them. */
function kindOf({ reason, status, type }: Failure) {
  return Arr.join(
    Arr.filter(
      [reason, status === undefined ? "" : String(status), type ?? ""],
      Str.isNonEmpty
    ),
    " "
  );
}

/** How many messages each kind of failure kept from the measure, on one line. */
export function failureLine(failures: readonly Failure[]) {
  const kinds = Rec.toEntries(Arr.groupBy(failures, kindOf));
  return `${Arr.length(failures)} messages failed: ${Arr.join(
    Arr.map(kinds, ([kind, group]) => `${kind} (${Arr.length(group)})`),
    ", "
  )}`;
}
